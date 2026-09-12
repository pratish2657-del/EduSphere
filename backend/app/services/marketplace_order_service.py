from decimal import Decimal

from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
)
from app.database import get_connection
from app.services.marketplace_inventory_service import finalize_order_inventory

# ============================================================
# INTERNAL — GET OR CREATE CART
# ============================================================


def _get_or_create_cart(cursor, buyer_id):

    cursor.execute(
        """
        SELECT
            id
        FROM marketplace_carts
        WHERE buyer_id = %s
        """,
        (buyer_id,),
    )

    cart = cursor.fetchone()

    if cart:
        return cart["id"]

    cursor.execute(
        """
        INSERT INTO marketplace_carts (
            buyer_id
        )
        VALUES (%s)
        """,
        (buyer_id,),
    )

    return cursor.lastrowid


# ============================================================
# GET CART
# BUYER
# ============================================================


def get_cart(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cart_id = _get_or_create_cart(cursor, user_id)

        cursor.execute(
            """
            SELECT
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,

                mp.seller_id,
                seller.full_name AS seller_name,

                mp.name,
                mp.description,
                mp.category,
                mp.product_type,
                mp.condition_type,
                mp.price,
                (mp.quantity - mp.reserved_quantity) AS available_quantity,
                mp.is_active,

                (
                    mp.price * ci.quantity
                ) AS subtotal

            FROM marketplace_cart_items ci

            INNER JOIN marketplace_products mp
                ON ci.product_id = mp.id

            INNER JOIN users seller
                ON mp.seller_id = seller.id

            WHERE ci.cart_id = %s

            ORDER BY ci.created_at DESC
            """,
            (cart_id,),
        )

        items = cursor.fetchall()

        total = Decimal("0.00")

        for item in items:
            total += Decimal(str(item["subtotal"]))

        return {
            "cart_id": cart_id,
            "count": len(items),
            "items": items,
            "total": total,
        }

    finally:
        connection.close()


# ============================================================
# ADD TO CART
# BUYER
# ============================================================


def add_to_cart(user_id, product_id, quantity):

    if quantity < 1:
        raise BadRequestError("Quantity must be at least 1")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Get product
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                seller_id,
                institution_id,
                name,
                price,
                quantity,
                reserved_quantity,
                product_type,
                is_active

            FROM marketplace_products

            WHERE id = %s

            FOR UPDATE
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError("Marketplace product not found")

        if not product["is_active"]:
            raise BadRequestError("This product is no longer available")

        # ----------------------------------------------------
        # Prevent buying own product
        # ----------------------------------------------------

        if product["seller_id"] == user_id:
            raise BadRequestError("You cannot purchase your own product")

        # ----------------------------------------------------
        # Check stock
        # ----------------------------------------------------

        if (product["quantity"] - product["reserved_quantity"]) < quantity:
            raise BadRequestError(
                "Requested quantity is greater than available stock"
            )

        # ----------------------------------------------------
        # Get cart
        # ----------------------------------------------------

        cart_id = _get_or_create_cart(cursor, user_id)

        # ----------------------------------------------------
        # Check existing cart item
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                quantity
            FROM marketplace_cart_items

            WHERE cart_id = %s
              AND product_id = %s

            FOR UPDATE
            """,
            (cart_id, product_id),
        )

        existing = cursor.fetchone()

        if existing:
            new_quantity = existing["quantity"] + quantity

            if new_quantity > (product["quantity"] - product["reserved_quantity"]):
                raise BadRequestError(
                    "Total requested quantity exceeds available stock"
                )

            cursor.execute(
                """
                UPDATE marketplace_cart_items

                SET
                    quantity = %s

                WHERE id = %s
                """,
                (new_quantity, existing["id"]),
            )

        else:
            cursor.execute(
                """
                INSERT INTO marketplace_cart_items (
                    cart_id,
                    product_id,
                    quantity
                )
                VALUES (
                    %s, %s, %s
                )
                """,
                (cart_id, product_id, quantity),
            )

        connection.commit()

        return {
            "message": "Product added to cart",
            "cart_id": cart_id,
            "product_id": product_id,
            "quantity_added": quantity,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE CART ITEM
# BUYER
# ============================================================


def update_cart_item(user_id, product_id, quantity):

    if quantity < 1:
        raise BadRequestError("Quantity must be at least 1")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cart_id = _get_or_create_cart(cursor, user_id)

        cursor.execute(
            """
            SELECT
                ci.id,
                ci.quantity AS current_quantity,

                (mp.quantity - mp.reserved_quantity) AS available_quantity,
                mp.is_active,
                mp.seller_id

            FROM marketplace_cart_items ci

            INNER JOIN marketplace_products mp
                ON ci.product_id = mp.id

            WHERE ci.cart_id = %s
              AND ci.product_id = %s

            FOR UPDATE
            """,
            (cart_id, product_id),
        )

        item = cursor.fetchone()

        if not item:
            raise NotFoundError("Product is not in your cart")

        if not item["is_active"]:
            raise BadRequestError("This product is no longer available")

        if item["seller_id"] == user_id:
            raise BadRequestError("You cannot purchase your own product")

        if quantity > item["available_quantity"]:
            raise BadRequestError("Requested quantity exceeds available stock")

        cursor.execute(
            """
            UPDATE marketplace_cart_items

            SET
                quantity = %s

            WHERE cart_id = %s
              AND product_id = %s
            """,
            (quantity, cart_id, product_id),
        )

        connection.commit()

        return {
            "message": "Cart quantity updated",
            "product_id": product_id,
            "quantity": quantity,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# REMOVE FROM CART
# BUYER
# ============================================================


def remove_from_cart(user_id, product_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cart_id = _get_or_create_cart(cursor, user_id)

        cursor.execute(
            """
            DELETE FROM marketplace_cart_items

            WHERE cart_id = %s
              AND product_id = %s
            """,
            (cart_id, product_id),
        )

        if cursor.rowcount == 0:
            raise NotFoundError("Product is not in your cart")

        connection.commit()

        return {
            "message": "Product removed from cart",
            "product_id": product_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# CHECKOUT
# BUYER
#
# IMPORTANT:
# This creates a PENDING order.
# Payment will be handled in 36G.
# ============================================================


def checkout(user_id, institution_id, payment_method="ONLINE", shipping_address=None):

    payment_method = str(payment_method or "ONLINE").strip().upper()
    if payment_method not in {"ONLINE", "COD"}:
        raise BadRequestError("Unsupported payment method. Choose ONLINE or COD.")

    if payment_method == "COD" and (not shipping_address or len(shipping_address.strip()) < 10):
        raise BadRequestError("A valid delivery address is required for Cash on Delivery.")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Verify institution
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM institutions
            WHERE id = %s
            """,
            (institution_id,),
        )

        institution = cursor.fetchone()

        if not institution:
            raise NotFoundError("Institution not found")

        # ----------------------------------------------------
        # Get cart
        # ----------------------------------------------------

        cart_id = _get_or_create_cart(cursor, user_id)

        cursor.execute(
            """
            SELECT
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,

                mp.seller_id,
                mp.institution_id AS product_institution_id,

                mp.name,
                mp.price,
                (mp.quantity - mp.reserved_quantity) AS available_quantity,
                mp.product_type,
                mp.is_active

            FROM marketplace_cart_items ci

            INNER JOIN marketplace_products mp
                ON ci.product_id = mp.id

            WHERE ci.cart_id = %s

            FOR UPDATE
            """,
            (cart_id,),
        )

        items = cursor.fetchall()

        if not items:
            raise BadRequestError("Your cart is empty")

        # ----------------------------------------------------
        # Validate everything BEFORE creating order
        # ----------------------------------------------------

        has_physical = any(
            str(item["product_type"]).upper() == "PHYSICAL" for item in items
        )
        if has_physical and (not shipping_address or len(shipping_address.strip()) < 10):
            raise BadRequestError("A valid delivery address is required for physical products.")

        total = Decimal("0.00")

        for item in items:
            if not item["is_active"]:
                raise BadRequestError(
                    f"Product '{item['name']}' is no longer available"
                )

            if item["seller_id"] == user_id:
                raise BadRequestError(
                    f"You cannot purchase your own product: {item['name']}"
                )

            if item["quantity"] < 1:
                raise BadRequestError("Invalid cart quantity")

            if item["quantity"] > item["available_quantity"]:
                raise BadRequestError(
                    f"Insufficient stock for '{item['name']}'"
                )

            if payment_method == "COD" and item["product_type"] == "DIGITAL":
                raise BadRequestError(
                    "Cash on Delivery is available only for physical products. "
                    "Please choose online payment for digital products."
                )

            # ------------------------------------------------
            # DIGITAL products must have a seller-uploaded file
            # before they can be purchased.
            # ------------------------------------------------

            if item["product_type"] == "DIGITAL":
                cursor.execute(
                    """
                    SELECT 1
                    FROM marketplace_attachments
                    WHERE product_id = %s
                    LIMIT 1
                    """,
                    (item["product_id"],),
                )
                if not cursor.fetchone():
                    raise BadRequestError(
                        f"Digital product '{item['name']}' is not available for purchase yet because its file has not been uploaded."
                    )

            # ------------------------------------------------
            # Server-side price calculation
            # ------------------------------------------------

            unit_price = Decimal(str(item["price"]))

            subtotal = unit_price * item["quantity"]

            total += subtotal

        total = total.quantize(Decimal("0.01"))

        # ----------------------------------------------------
        # EduSphere marketplace fee
        # Seller-funded: buyer pays the listed total, while
        # 5% is deducted from seller earnings.
        # ----------------------------------------------------

        platform_fee_percent = Decimal("5.00")
        platform_fee_amount = (
            total * platform_fee_percent / Decimal(100)
        ).quantize(Decimal("0.01"))
        seller_net_amount = (
            total - platform_fee_amount
        ).quantize(Decimal("0.01"))

        # ----------------------------------------------------
        # Create order
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO marketplace_orders (
                buyer_id,
                institution_id,
                total_amount,
                platform_fee_percent,
                platform_fee_amount,
                seller_net_amount,
                shipping_address,
                expires_at,
                status
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                CASE WHEN %s = 'COD' THEN NULL ELSE DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) END,
                %s
            )
            """,
            (
                user_id,
                institution_id,
                total,
                platform_fee_percent,
                platform_fee_amount,
                seller_net_amount,
                shipping_address.strip() if has_physical else None,
                payment_method,
                "CONFIRMED" if payment_method == "COD" else "PENDING",
            ),
        )

        order_id = cursor.lastrowid

        # ----------------------------------------------------
        # Create order items + reserve stock
        # ----------------------------------------------------

        seller_gross: dict[int, Decimal] = {}

        for item in items:
            unit_price = Decimal(str(item["price"]))

            subtotal = unit_price * item["quantity"]

            subtotal = subtotal.quantize(Decimal("0.01"))
            seller_id = int(item["seller_id"])
            seller_gross[seller_id] = seller_gross.get(
                seller_id, Decimal("0.00")
            ) + subtotal

            cursor.execute(
                """
                INSERT INTO marketplace_order_items (
                    order_id,
                    product_id,
                    seller_id,
                    product_name,
                    unit_price,
                    quantity,
                    subtotal
                )
                VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s
                )
                """,
                (
                    order_id,
                    item["product_id"],
                    item["seller_id"],
                    item["name"],
                    unit_price,
                    item["quantity"],
                    subtotal,
                ),
            )

            # ------------------------------------------------
            # Reserve stock until payment succeeds/fails.
            # quantity is the physical stock; reserved_quantity
            # prevents two pending checkouts from claiming it.
            # ------------------------------------------------

            cursor.execute(
                """
                UPDATE marketplace_products

                SET
                    reserved_quantity = reserved_quantity + %s

                WHERE id = %s
                  AND (quantity - reserved_quantity) >= %s
                  AND is_active = TRUE
                """,
                (
                    item["quantity"],
                    item["product_id"],
                    item["quantity"],
                ),
            )

            if cursor.rowcount != 1:
                raise BadRequestError(
                    f"Stock changed while checking out "
                    f"'{item['name']}'. "
                    "Please try again."
                )

        # ----------------------------------------------------
        # Create seller payout ledger entries.
        # A seller with a verified Razorpay Route Linked Account
        # can later receive the seller_amount automatically.
        # ----------------------------------------------------

        allocated_fee = Decimal("0.00")
        seller_ids = list(seller_gross.keys())

        for index, seller_id in enumerate(seller_ids):
            gross = seller_gross[seller_id].quantize(Decimal("0.01"))

            if index == len(seller_ids) - 1:
                fee = (platform_fee_amount - allocated_fee).quantize(Decimal("0.01"))
            else:
                fee = (gross * platform_fee_percent / Decimal(100)).quantize(Decimal("0.01"))
                allocated_fee += fee

            seller_amount = (gross - fee).quantize(Decimal("0.01"))

            cursor.execute(
                """
                INSERT INTO marketplace_seller_payout_transactions (
                    order_id,
                    seller_id,
                    gross_amount,
                    platform_fee_percent,
                    platform_fee_amount,
                    seller_amount,
                    currency,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'INR', 'PENDING')
                """,
                (
                    order_id,
                    seller_id,
                    gross,
                    platform_fee_percent,
                    fee,
                    seller_amount,
                ),
            )

        if payment_method == "COD":
            # COD is a committed physical order: consume the reservation now,
            # but keep the payment itself PENDING until staff confirms cash collection.
            finalize_order_inventory(order_id, cursor)

            cursor.execute(
                """
                INSERT INTO marketplace_payments (
                    order_id,
                    buyer_id,
                    amount,
                    currency,
                    payment_method,
                    gateway,
                    status
                )
                VALUES (%s, %s, %s, 'INR', 'COD', 'COD', 'PENDING')
                """,
                (order_id, user_id, total),
            )

        # ----------------------------------------------------
        # Clear cart
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM marketplace_cart_items
            WHERE cart_id = %s
            """,
            (cart_id,),
        )

        connection.commit()

        return {
            "message": "COD order placed successfully" if payment_method == "COD" else "Order created successfully",
            "order_id": order_id,
            "status": "CONFIRMED" if payment_method == "COD" else "PENDING",
            "payment_method": payment_method,
            "payment_required": payment_method == "ONLINE",
            "total_amount": total,
            "platform_fee_percent": platform_fee_percent,
            "platform_fee_amount": platform_fee_amount,
            "seller_net_amount": seller_net_amount,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET BUYER ORDERS
# ============================================================


def get_buyer_orders(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                o.id AS order_id,
                o.institution_id,
                o.total_amount,
                o.status,
                o.shipping_address,
                mpay.payment_method,
                mpay.status AS payment_status,
                o.created_at,
                o.updated_at,
                oi.product_id,
                oi.product_name,
                mp.product_type,
                ma.id AS attachment_id,
                ma.file_name,
                ma.file_type,
                ma.file_size

            FROM marketplace_orders o

            LEFT JOIN marketplace_order_items oi
                ON oi.order_id = o.id

            LEFT JOIN marketplace_products mp
                ON mp.id = oi.product_id

            LEFT JOIN marketplace_attachments ma
                ON ma.product_id = oi.product_id
               AND mp.product_type = 'DIGITAL'
               AND o.status IN ('CONFIRMED', 'PROCESSING', 'COMPLETED')

            LEFT JOIN marketplace_payments mpay
                ON mpay.order_id = o.id

            WHERE o.buyer_id = %s

            ORDER BY o.created_at DESC, oi.id ASC, ma.id ASC
            """,
            (user_id,),
        )

        rows = cursor.fetchall()
        orders_by_id = {}

        for row in rows:
            order_id = row["order_id"]
            order = orders_by_id.get(order_id)

            if order is None:
                order = {
                    "order_id": order_id,
                    "institution_id": row["institution_id"],
                    "total_amount": row["total_amount"],
                    "status": row["status"],
                    "payment_method": row.get("payment_method"),
                    "payment_status": row.get("payment_status"),
                    "shipping_address": row.get("shipping_address"),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "digital_files": [],
                    "_digital_file_ids": set(),
                }
                orders_by_id[order_id] = order

            attachment_id = row.get("attachment_id")
            if attachment_id is not None and attachment_id not in order["_digital_file_ids"]:
                order["digital_files"].append(
                    {
                        "attachment_id": attachment_id,
                        "product_id": row["product_id"],
                        "product_name": row["product_name"],
                        "file_name": row["file_name"],
                        "file_type": row["file_type"],
                        "file_size": row["file_size"],
                    }
                )
                order["_digital_file_ids"].add(attachment_id)

        orders = list(orders_by_id.values())
        for order in orders:
            order.pop("_digital_file_ids", None)

        return {"count": len(orders), "orders": orders}

    finally:
        connection.close()


# ============================================================
# GET SINGLE BUYER ORDER
# ============================================================


def get_buyer_order(order_id, user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id AS order_id,
                buyer_id,
                institution_id,
                total_amount,
                status,
                created_at,
                updated_at

            FROM marketplace_orders

            WHERE id = %s
              AND buyer_id = %s
            """,
            (order_id, user_id),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError("Order not found")

        cursor.execute(
            """
            SELECT
                oi.id AS order_item_id,
                oi.product_id,
                oi.seller_id,
                seller.full_name AS seller_name,

                oi.product_name,
                oi.unit_price,
                oi.quantity,
                oi.subtotal

            FROM marketplace_order_items oi

            INNER JOIN users seller
                ON oi.seller_id = seller.id

            WHERE oi.order_id = %s

            ORDER BY oi.id ASC
            """,
            (order_id,),
        )

        items = cursor.fetchall()

        return {"order": order, "items": items}

    finally:
        connection.close()


# ============================================================
# GET SELLER ORDERS
# ============================================================


def get_seller_orders(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                oi.id AS order_item_id,
                oi.order_id,

                oi.product_id,
                oi.product_name,

                oi.unit_price,
                oi.quantity,
                oi.subtotal,

                o.buyer_id,
                buyer.full_name AS buyer_name,

                o.status AS order_status,
                o.created_at

            FROM marketplace_order_items oi

            INNER JOIN marketplace_orders o
                ON oi.order_id = o.id

            INNER JOIN users buyer
                ON o.buyer_id = buyer.id

            WHERE oi.seller_id = %s

            ORDER BY o.created_at DESC
            """,
            (user_id,),
        )

        orders = cursor.fetchall()

        return {"count": len(orders), "orders": orders}

    finally:
        connection.close()