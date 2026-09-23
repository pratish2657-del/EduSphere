from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection
from app.schemas.marketplace import MarketplaceCheckoutRequest

# ============================================================
# CONFIG
# ============================================================

DEFAULT_TAX_PERCENT = Decimal("5.00")
ORDER_EXPIRY_MINUTES = 15


# ============================================================
# HELPERS
# ============================================================

def _money(value: Decimal | float | str) -> Decimal:
    """
    Normalize monetary values to 2 decimal places.
    """
    return Decimal(str(value)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def _get_tax_percent() -> Decimal:
    """
    Read marketplace tax percentage from environment.

    Falls back to 5% if the environment variable is missing
    or invalid.
    """
    import os

    raw = os.getenv("MARKETPLACE_TAX_PERCENT")

    if not raw:
        return DEFAULT_TAX_PERCENT

    try:
        value = Decimal(raw)
        if value < 0:
            return DEFAULT_TAX_PERCENT
        return value
    except InvalidOperation:
        return DEFAULT_TAX_PERCENT


# ============================================================
# CART
# ============================================================

def get_or_create_cart(user_id: int):
    """
    Get the user's marketplace cart.

    Creates one when the user does not have a cart yet.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                created_at,
                updated_at
            FROM marketplace_carts
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        cart = cursor.fetchone()

        if cart:
            return cart

        cursor.execute(
            """
            INSERT INTO marketplace_carts (user_id)
            VALUES (%s)
            """,
            (user_id,),
        )

        connection.commit()

        cart_id = cursor.lastrowid

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                created_at,
                updated_at
            FROM marketplace_carts
            WHERE id = %s
            LIMIT 1
            """,
            (cart_id,),
        )

        return cursor.fetchone()

    finally:
        connection.close()


def add_cart_item(
    user_id: int,
    product_id: int,
    quantity: int = 1,
):
    """
    Add a product to the user's cart.

    If the product already exists in the cart, its quantity
    is increased.
    """
    if quantity < 1:
        raise BadRequestError("Quantity must be at least 1.")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Check product
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id,
                name,
                product_type,
                is_active,
                quantity,
                reserved_quantity
            FROM marketplace_products
            WHERE id = %s
            LIMIT 1
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError("Product not found.")

        if not product["is_active"]:
            raise BadRequestError("This product is no longer available.")

        available_quantity = (
            product["quantity"] - product["reserved_quantity"]
        )

        if available_quantity < quantity:
            raise ConflictError("Insufficient product quantity.")

        # ----------------------------------------------------
        # Get/create cart
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM marketplace_carts
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        cart = cursor.fetchone()

        if cart:
            cart_id = cart["id"]
        else:
            cursor.execute(
                """
                INSERT INTO marketplace_carts (user_id)
                VALUES (%s)
                """,
                (user_id,),
            )

            cart_id = cursor.lastrowid

        # ----------------------------------------------------
        # Check existing item
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                quantity
            FROM marketplace_cart_items
            WHERE cart_id = %s
              AND product_id = %s
            LIMIT 1
            """,
            (cart_id, product_id),
        )

        existing = cursor.fetchone()

        if existing:
            new_quantity = existing["quantity"] + quantity

            if available_quantity < new_quantity:
                raise ConflictError(
                    "Requested quantity exceeds available stock."
                )

            cursor.execute(
                """
                UPDATE marketplace_cart_items
                SET quantity = %s
                WHERE id = %s
                """,
                (new_quantity, existing["id"]),
            )

            item_id = existing["id"]

        else:
            cursor.execute(
                """
                INSERT INTO marketplace_cart_items (
                    cart_id,
                    product_id,
                    quantity
                )
                VALUES (%s, %s, %s)
                """,
                (cart_id, product_id, quantity),
            )

            item_id = cursor.lastrowid

        connection.commit()

        return {
            "id": item_id,
            "cart_id": cart_id,
            "product_id": product_id,
            "quantity": (
                new_quantity
                if existing
                else quantity
            ),
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def update_cart_item(
    user_id: int,
    product_id: int,
    quantity: int,
):
    """
    Replace the quantity of an existing cart item.
    """
    if quantity < 1:
        raise BadRequestError("Quantity must be at least 1.")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ci.id,
                ci.quantity,
                p.quantity AS stock_quantity,
                p.reserved_quantity,
                p.is_active
            FROM marketplace_cart_items ci
            INNER JOIN marketplace_carts c
                ON c.id = ci.cart_id
            INNER JOIN marketplace_products p
                ON p.id = ci.product_id
            WHERE c.user_id = %s
              AND ci.product_id = %s
            LIMIT 1
            """,
            (user_id, product_id),
        )

        item = cursor.fetchone()

        if not item:
            raise NotFoundError("Cart item not found.")

        if not item["is_active"]:
            raise BadRequestError("This product is no longer available.")

        available_quantity = (
            item["stock_quantity"] - item["reserved_quantity"]
        )

        if quantity > available_quantity:
            raise ConflictError(
                "Requested quantity exceeds available stock."
            )

        cursor.execute(
            """
            UPDATE marketplace_cart_items
            SET quantity = %s
            WHERE id = %s
            """,
            (quantity, item["id"]),
        )

        connection.commit()

        return {
            "id": item["id"],
            "product_id": product_id,
            "quantity": quantity,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def remove_cart_item(
    user_id: int,
    product_id: int,
):
    """
    Remove a product from the user's cart.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE ci
            FROM marketplace_cart_items ci
            INNER JOIN marketplace_carts c
                ON c.id = ci.cart_id
            WHERE c.user_id = %s
              AND ci.product_id = %s
            """,
            (user_id, product_id),
        )

        if cursor.rowcount == 0:
            raise NotFoundError("Cart item not found.")

        connection.commit()

        return {
            "product_id": product_id,
            "removed": True,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def get_cart(user_id: int):
    """
    Return the complete cart with current product information
    and calculated subtotal.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                c.id AS cart_id,
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,
                p.name,
                p.description,
                p.category,
                p.product_type,
                p.condition_type,
                p.price,
                p.quantity AS stock_quantity,
                p.reserved_quantity,
                p.preview_image_path,
                p.is_active,
                p.institution_id,
                u.full_name AS seller_name
            FROM marketplace_carts c
            LEFT JOIN marketplace_cart_items ci
                ON ci.cart_id = c.id
            LEFT JOIN marketplace_products p
                ON p.id = ci.product_id
            LEFT JOIN users u
                ON u.id = p.seller_id
            WHERE c.user_id = %s
            ORDER BY ci.created_at DESC
            """,
            (user_id,),
        )

        rows = cursor.fetchall()

        items = []
        subtotal = Decimal("0.00")

        cart_id = None

        for row in rows:
            if row["cart_id"]:
                cart_id = row["cart_id"]

            if not row["cart_item_id"]:
                continue

            price = _money(row["price"])
            item_subtotal = _money(
                price * row["quantity"]
            )

            subtotal += item_subtotal

            available_quantity = (
                row["stock_quantity"]
                - row["reserved_quantity"]
            )

            items.append(
                {
                    "cart_item_id": row["cart_item_id"],
                    "product_id": row["product_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "category": row["category"],
                    "product_type": row["product_type"],
                    "condition_type": row["condition_type"],
                    "price": price,
                    "quantity": row["quantity"],
                    "subtotal": item_subtotal,
                    "available_quantity": available_quantity,
                    "preview_image_path": row["preview_image_path"],
                    "is_active": bool(row["is_active"]),
                    "institution_id": row["institution_id"],
                    "seller_name": row["seller_name"],
                }
            )

        subtotal = _money(subtotal)

        tax_percent = _get_tax_percent()

        tax_amount = _money(
            subtotal * tax_percent / Decimal(100)
        )

        total_amount = _money(
            subtotal + tax_amount
        )

        return {
            "cart_id": cart_id,
            "items": items,
            "subtotal_amount": subtotal,
            "tax_percent": tax_percent,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "currency": "INR",
        }

    finally:
        connection.close()


# ============================================================
# CHECKOUT
# ============================================================

def checkout(
    user_id: int,
    data: MarketplaceCheckoutRequest,
):
    """
    Create a marketplace order from the user's entire cart.

    Important:
    - Prices are read from the database.
    - Tax is calculated server-side.
    - Stock is reserved inside a transaction.
    - No payment is considered successful here.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Lock cart
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM marketplace_carts
            WHERE user_id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (user_id,),
        )

        cart = cursor.fetchone()

        if not cart:
            raise BadRequestError("Your cart is empty.")

        cart_id = cart["id"]

        # ----------------------------------------------------
        # Load cart products
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,

                p.id,
                p.seller_id,
                p.institution_id,
                p.name,
                p.product_type,
                p.condition_type,
                p.price,
                p.quantity AS stock_quantity,
                p.reserved_quantity,
                p.is_active
            FROM marketplace_cart_items ci
            INNER JOIN marketplace_products p
                ON p.id = ci.product_id
            WHERE ci.cart_id = %s
            FOR UPDATE
            """,
            (cart_id,),
        )

        cart_items = cursor.fetchall()

        if not cart_items:
            raise BadRequestError("Your cart is empty.")

        # ----------------------------------------------------
        # Validate institution
        # ----------------------------------------------------

        for item in cart_items:
            if item["institution_id"] != data.institution_id:
                raise BadRequestError(
                    "All products in a cart must belong to the "
                    "same institution."
                )

        # ----------------------------------------------------
        # Validate products and reserve inventory
        # ----------------------------------------------------

        subtotal = Decimal("0.00")
        has_physical_product = False
        order_items = []

        for item in cart_items:
            if not item["is_active"]:
                raise BadRequestError(
                    f"Product '{item['name']}' is no longer available."
                )

            quantity = int(item["quantity"])

            if quantity < 1:
                raise BadRequestError(
                    "Cart contains an invalid quantity."
                )

            available_quantity = (
                item["stock_quantity"]
                - item["reserved_quantity"]
            )

            if available_quantity < quantity:
                raise ConflictError(
                    f"Insufficient stock for '{item['name']}'."
                )

            if item["product_type"] == "PHYSICAL":
                has_physical_product = True

            # ------------------------------------------------
            # Digital product must have an attachment
            # ------------------------------------------------

            if item["product_type"] == "DIGITAL":
                cursor.execute(
                    """
                    SELECT id
                    FROM marketplace_attachments
                    WHERE product_id = %s
                    LIMIT 1
                    """,
                    (item["product_id"],),
                )

                attachment = cursor.fetchone()

                if not attachment:
                    raise BadRequestError(
                        f"Digital product '{item['name']}' "
                        "does not have a downloadable file."
                    )

            # ------------------------------------------------
            # Calculate item subtotal from DB price
            # ------------------------------------------------

            unit_price = _money(item["price"])

            item_subtotal = _money(
                unit_price * quantity
            )

            subtotal += item_subtotal

            order_items.append(
                {
                    "product_id": item["product_id"],
                    "seller_id": item["seller_id"],
                    "product_name": item["name"],
                    "unit_price": unit_price,
                    "quantity": quantity,
                    "subtotal": item_subtotal,
                }
            )

        # ----------------------------------------------------
        # Physical products require shipping address
        # ----------------------------------------------------

        if has_physical_product and not data.shipping_address:
                raise BadRequestError(
                    "Shipping address is required for physical products."
                )

        # ----------------------------------------------------
        # Calculate tax
        # ----------------------------------------------------

        subtotal = _money(subtotal)

        tax_percent = _get_tax_percent()

        tax_amount = _money(
            subtotal * tax_percent / Decimal(100)
        )

        total_amount = _money(
            subtotal + tax_amount
        )

        # ----------------------------------------------------
        # Reserve inventory
        # ----------------------------------------------------

        for item in cart_items:
            cursor.execute(
                """
                UPDATE marketplace_products
                SET reserved_quantity = reserved_quantity + %s
                WHERE id = %s
                  AND is_active = TRUE
                  AND quantity - reserved_quantity >= %s
                """,
                (
                    item["quantity"],
                    item["product_id"],
                    item["quantity"],
                ),
            )

            if cursor.rowcount != 1:
                raise ConflictError(
                    "Product stock changed while checking out. "
                    "Please try again."
                )

        # ----------------------------------------------------
        # Create order
        # ----------------------------------------------------

        expires_at = (
            datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(minutes=ORDER_EXPIRY_MINUTES)
        )
        cursor.execute(
            """
            INSERT INTO marketplace_orders (
                buyer_id,
                institution_id,
                subtotal_amount,
                tax_percent,
                tax_amount,
                total_amount,
                shipping_address,
                status,
                expires_at
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'PENDING',
                %s
            )
            """,
            (
                user_id,
                data.institution_id,
                subtotal,
                tax_percent,
                tax_amount,
                total_amount,
                data.shipping_address,
                expires_at,
            ),
        )

        order_id = cursor.lastrowid

        # ----------------------------------------------------
        # Create order item snapshots
        # ----------------------------------------------------

        for item in order_items:
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
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    order_id,
                    item["product_id"],
                    item["seller_id"],
                    item["product_name"],
                    item["unit_price"],
                    item["quantity"],
                    item["subtotal"],
                ),
            )

        # ----------------------------------------------------
        # Clear purchased cart items
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
            "order_id": order_id,
            "status": "PENDING",
            "subtotal_amount": subtotal,
            "tax_percent": tax_percent,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "currency": "INR",
            "expires_at": expires_at.isoformat(),
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ORDER RETRIEVAL
# ============================================================

def get_order(
    user_id: int,
    order_id: int,
):
    """
    Get one order belonging to the buyer.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                o.id,
                o.buyer_id,
                o.institution_id,
                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,
                o.shipping_address,
                o.status,
                o.expires_at,
                o.created_at,
                o.updated_at,
                i.name AS institution_name
            FROM marketplace_orders o
            LEFT JOIN institutions i
                ON i.id = o.institution_id
            WHERE o.id = %s
              AND o.buyer_id = %s
            LIMIT 1
            """,
            (order_id, user_id),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError("Order not found.")

        cursor.execute(
            """
            SELECT
                oi.id,
                oi.product_id,
                oi.seller_id,
                oi.product_name,
                oi.unit_price,
                oi.quantity,
                oi.subtotal
            FROM marketplace_order_items oi
            WHERE oi.order_id = %s
            ORDER BY oi.id ASC
            """,
            (order_id,),
        )

        items = cursor.fetchall()

        order["items"] = items

        return order

    finally:
        connection.close()


def get_user_orders(
    user_id: int,
):
    """
    Return all marketplace orders belonging to a buyer.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                o.id,
                o.institution_id,
                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,
                o.status,
                o.expires_at,
                o.created_at,
                i.name AS institution_name
            FROM marketplace_orders o
            LEFT JOIN institutions i
                ON i.id = o.institution_id
            WHERE o.buyer_id = %s
            ORDER BY o.created_at DESC
            """,
            (user_id,),
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# ADMIN / INTERNAL ORDER ACCESS
# ============================================================

def get_order_for_update(
    order_id: int,
    cursor,
):
    """
    Load an order with a row lock.

    Intended for payment verification and other transactional
    operations where the order must not change concurrently.
    """
    cursor.execute(
        """
        SELECT
            id,
            buyer_id,
            institution_id,
            subtotal_amount,
            tax_percent,
            tax_amount,
            total_amount,
            shipping_address,
            status,
            expires_at,
            created_at,
            updated_at
        FROM marketplace_orders
        WHERE id = %s
        LIMIT 1
        FOR UPDATE
        """,
        (order_id,),
    )

    order = cursor.fetchone()

    if not order:
        raise NotFoundError("Order not found.")

    return order


# ============================================================
# SELLER ORDERS
# ============================================================

def get_seller_orders(
    user_id: int,
):
    """
    Return marketplace order items sold by the authenticated seller.

    This is intentionally read-only. It does not perform payment,
    payout, refund, or gateway operations.
    """
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

                o.institution_id,
                o.status AS order_status,
                o.total_amount,
                o.created_at,
                o.updated_at

            FROM marketplace_order_items oi

            INNER JOIN marketplace_orders o
                ON o.id = oi.order_id

            LEFT JOIN users buyer
                ON buyer.id = o.buyer_id

            WHERE oi.seller_id = %s

            ORDER BY o.created_at DESC, oi.id ASC
            """,
            (user_id,),
        )

        orders = cursor.fetchall() or []

        return {
            "count": len(orders),
            "orders": orders,
        }

    finally:
        connection.close()
