from __future__ import annotations

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection


# ============================================================
# CONSTANTS
# ============================================================

MARKETPLACE_ORDER_STATUSES = {
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "COMPLETED",
    "CANCELLED",
}


# ============================================================
# SUMMARY
# ============================================================


def get_marketplace_summary() -> dict:
    """
    Return marketplace management statistics.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        # ----------------------------------------------------
        # TOTAL PRODUCTS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM marketplace_products
            """
        )

        row = cursor.fetchone()

        products = int(
            row["total"] or 0
        )

        # ----------------------------------------------------
        # ACTIVE PRODUCTS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM marketplace_products
            WHERE is_active = TRUE
            """
        )

        row = cursor.fetchone()

        active_products = int(
            row["total"] or 0
        )

        # ----------------------------------------------------
        # SELLERS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(DISTINCT seller_id) AS total
            FROM marketplace_products
            """
        )

        row = cursor.fetchone()

        sellers = int(
            row["total"] or 0
        )

        # ----------------------------------------------------
        # ORDERS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM marketplace_orders
            """
        )

        row = cursor.fetchone()

        orders = int(
            row["total"] or 0
        )

        # ----------------------------------------------------
        # CONFIRMED SALES
        #
        # Only confirmed/completed orders represent confirmed
        # marketplace sales.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total
            FROM marketplace_orders
            WHERE status IN (
                'CONFIRMED',
                'PROCESSING',
                'COMPLETED'
            )
            """
        )

        row = cursor.fetchone()

        confirmed_sales = row["total"] or 0

        # ----------------------------------------------------
        # PENDING ORDERS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM marketplace_orders
            WHERE status = 'PENDING'
            """
        )

        row = cursor.fetchone()

        pending_orders = int(
            row["total"] or 0
        )

        # ----------------------------------------------------
        # COMPLETED ORDERS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM marketplace_orders
            WHERE status = 'COMPLETED'
            """
        )

        row = cursor.fetchone()

        completed_orders = int(
            row["total"] or 0
        )

        return {
            "products": products,
            "active_products": active_products,
            "sellers": sellers,
            "orders": orders,
            "confirmed_sales": confirmed_sales,
            "pending_orders": pending_orders,
            "completed_orders": completed_orders,
        }

    finally:
        connection.close()


# ============================================================
# PRODUCTS
# ============================================================


def get_marketplace_products(
    search: str | None = None,
    active: str | None = None,
    limit: int = 200,
) -> dict:
    """
    Return marketplace products for Super Admin management.
    """

    if limit < 1:
        raise BadRequestError(
            "Limit must be greater than zero"
        )

    limit = min(limit, 500)

    connection = get_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        clauses: list[str] = []
        params: list = []

        # ----------------------------------------------------
        # SEARCH
        # ----------------------------------------------------

        if search and search.strip():

            term = (
                f"%{search.strip()}%"
            )

            clauses.append(
                """
                (
                    mp.name LIKE %s
                    OR mp.category LIKE %s
                    OR mp.product_type LIKE %s
                    OR seller.full_name LIKE %s
                    OR seller.email LIKE %s
                )
                """
            )

            params.extend(
                [
                    term,
                    term,
                    term,
                    term,
                    term,
                ]
            )

        # ----------------------------------------------------
        # ACTIVE FILTER
        # ----------------------------------------------------

        if active in {
            "true",
            "false",
        }:

            clauses.append(
                "mp.is_active = %s"
            )

            params.append(
                active == "true"
            )

        where_clause = ""

        if clauses:
            where_clause = (
                "WHERE "
                + " AND ".join(clauses)
            )

        query = f"""
            SELECT
                mp.id,
                mp.name,
                mp.description,
                mp.category,
                mp.product_type,
                mp.condition_type,
                mp.price,
                mp.quantity,
                mp.reserved_quantity,
                mp.is_active,
                mp.seller_id,

                seller.full_name
                    AS seller_name,

                seller.email
                    AS seller_email,

                mp.institution_id,

                CASE
                    WHEN
                        mp.product_type = 'DIGITAL'
                        AND EXISTS (
                            SELECT 1
                            FROM marketplace_attachments ma
                            WHERE ma.product_id = mp.id
                        )
                    THEN 1
                    ELSE 0
                END AS digital_file_attached

            FROM marketplace_products mp

            LEFT JOIN users seller
                ON seller.id = mp.seller_id

            {where_clause}

            ORDER BY mp.id DESC

            LIMIT %s
        """

        params.append(limit)

        cursor.execute(
            query,
            tuple(params),
        )

        products = cursor.fetchall()

        return {
            "count": len(products),
            "products": products,
        }

    finally:
        connection.close()


# ============================================================
# SINGLE PRODUCT
# ============================================================


def get_marketplace_product(
    product_id: int,
) -> dict:

    connection = get_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                mp.id,
                mp.name,
                mp.description,
                mp.category,
                mp.product_type,
                mp.condition_type,
                mp.price,
                mp.quantity,
                mp.reserved_quantity,
                mp.preview_image_path,
                mp.is_active,
                mp.seller_id,
                mp.institution_id,
                mp.created_at,
                mp.updated_at,

                seller.full_name
                    AS seller_name,

                seller.email
                    AS seller_email,

                CASE
                    WHEN
                        mp.product_type = 'DIGITAL'
                        AND EXISTS (
                            SELECT 1
                            FROM marketplace_attachments ma
                            WHERE ma.product_id = mp.id
                        )
                    THEN 1
                    ELSE 0
                END AS digital_file_attached

            FROM marketplace_products mp

            LEFT JOIN users seller
                ON seller.id = mp.seller_id

            WHERE mp.id = %s

            LIMIT 1
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        return product

    finally:
        connection.close()


# ============================================================
# UPDATE PRODUCT STATUS
# ============================================================


def update_product_status(
    product_id: int,
    is_active: bool,
) -> dict:

    connection = get_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                id,
                is_active
            FROM marketplace_products
            WHERE id = %s
            LIMIT 1
            """,
            (product_id,),
        )

        product = cursor.fetchone()

        if not product:
            raise NotFoundError(
                "Marketplace product not found"
            )

        cursor.execute(
            """
            UPDATE marketplace_products
            SET
                is_active = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                is_active,
                product_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Marketplace product status was not changed"
            )

        connection.commit()

        return {
            "message": (
                "Marketplace product activated"
                if is_active
                else "Marketplace product deactivated"
            ),
            "product_id": product_id,
            "is_active": is_active,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ORDERS
# ============================================================


def get_marketplace_orders(
    search: str | None = None,
    status: str | None = None,
    limit: int = 200,
) -> dict:
    """
    Return marketplace orders for Super Admin.

    Payment information shown here is informational only.

    Payment verification remains controlled by the manual UPI
    payment service.
    """

    if limit < 1:
        raise BadRequestError(
            "Limit must be greater than zero"
        )

    limit = min(limit, 500)

    connection = get_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        clauses: list[str] = []
        params: list = []

        # ----------------------------------------------------
        # SEARCH
        # ----------------------------------------------------

        if search and search.strip():

            term = (
                f"%{search.strip()}%"
            )

            clauses.append(
                """
                (
                    CAST(o.id AS CHAR) LIKE %s
                    OR buyer.full_name LIKE %s
                    OR buyer.email LIKE %s
                )
                """
            )

            params.extend(
                [
                    term,
                    term,
                    term,
                ]
            )

        # ----------------------------------------------------
        # STATUS FILTER
        # ----------------------------------------------------

        if status:

            normalized_status = (
                status.strip().upper()
            )

            if (
                normalized_status
                not in MARKETPLACE_ORDER_STATUSES
            ):
                raise BadRequestError(
                    "Invalid marketplace order status"
                )

            clauses.append(
                "o.status = %s"
            )

            params.append(
                normalized_status
            )

        where_clause = ""

        if clauses:
            where_clause = (
                "WHERE "
                + " AND ".join(clauses)
            )

        query = f"""
            SELECT
                o.id AS order_id,
                o.buyer_id,

                buyer.full_name
                    AS buyer_name,

                buyer.email
                    AS buyer_email,

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

                (
                    SELECT
                        mp.id
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS payment_id,

                (
                    SELECT
                        mp.payment_method
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS payment_method,

                (
                    SELECT
                        mp.status
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS payment_status,

                (
                    SELECT
                        mp.utr_number
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS utr_number,

                COUNT(oi.id)
                    AS item_count

            FROM marketplace_orders o

            LEFT JOIN users buyer
                ON buyer.id = o.buyer_id

            LEFT JOIN marketplace_order_items oi
                ON oi.order_id = o.id

            {where_clause}

            GROUP BY
                o.id,
                o.buyer_id,
                buyer.full_name,
                buyer.email,
                o.institution_id,
                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,
                o.shipping_address,
                o.status,
                o.expires_at,
                o.created_at,
                o.updated_at

            ORDER BY o.created_at DESC

            LIMIT %s
        """

        params.append(limit)

        cursor.execute(
            query,
            tuple(params),
        )

        orders = cursor.fetchall()

        return {
            "count": len(orders),
            "orders": orders,
        }

    finally:
        connection.close()


# ============================================================
# SINGLE ORDER
# ============================================================


def get_marketplace_order(
    order_id: int,
) -> dict:

    connection = get_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT
                o.id AS order_id,
                o.buyer_id,

                buyer.full_name
                    AS buyer_name,

                buyer.email
                    AS buyer_email,

                o.institution_id,

                o.subtotal_amount,
                o.tax_percent,
                o.tax_amount,
                o.total_amount,

                o.shipping_address,

                o.status,
                o.expires_at,
                o.created_at,
                o.updated_at

            FROM marketplace_orders o

            LEFT JOIN users buyer
                ON buyer.id = o.buyer_id

            WHERE o.id = %s

            LIMIT 1
            """,
            (order_id,),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError(
                "Marketplace order not found"
            )

        # ----------------------------------------------------
        # ORDER ITEMS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                oi.id AS order_item_id,
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

        order["items"] = cursor.fetchall()

        # ----------------------------------------------------
        # PAYMENT
        #
        # Informational only.
        # Super Admin order status does not verify payment.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id AS payment_id,
                order_id,
                buyer_id,
                payment_method,
                status,
                amount,
                currency,
                utr_number,
                payer_upi_id,
                payer_phone,
                submitted_at,
                verified_at,
                verified_by,
                created_at,
                updated_at
            FROM marketplace_payments
            WHERE order_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (order_id,),
        )

        order["payment"] = (
            cursor.fetchone()
        )

        # ----------------------------------------------------
        # RECEIPT
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                payment_id,
                receipt_number,
                amount,
                currency,
                issued_at
            FROM marketplace_receipts
            WHERE order_id = %s
            LIMIT 1
            """,
            (order_id,),
        )

        order["receipt"] = (
            cursor.fetchone()
        )

        return order

    finally:
        connection.close()


# ============================================================
# ORDER STATUS
# ============================================================


def update_order_status(
    order_id: int,
    status: str,
) -> dict:
    """
    Update an order's operational status.

    Important:
        Payment verification is NOT performed here.

    PAID + CONFIRMED is created by the manual UPI verification
    workflow.

    This function therefore prevents Super Admin from using an
    order-status update to bypass payment verification.
    """

    normalized_status = (
        status.strip().upper()
        if status
        else ""
    )

    if (
        normalized_status
        not in MARKETPLACE_ORDER_STATUSES
    ):
        raise BadRequestError(
            "Invalid marketplace order status. "
            "Allowed statuses: "
            "PENDING, CONFIRMED, PROCESSING, "
            "COMPLETED, CANCELLED"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        # ----------------------------------------------------
        # LOCK ORDER
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                status
            FROM marketplace_orders
            WHERE id = %s
            FOR UPDATE
            """,
            (order_id,),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError(
                "Marketplace order not found"
            )

        current_status = (
            order["status"]
        )

        # ----------------------------------------------------
        # NO-OP
        # ----------------------------------------------------

        if current_status == normalized_status:

            connection.commit()

            return {
                "message": (
                    "Marketplace order status is already "
                    f"{normalized_status}"
                ),
                "order_id": order_id,
                "status": normalized_status,
            }

        # ----------------------------------------------------
        # NEVER MOVE A CANCELLED ORDER BACK
        # ----------------------------------------------------

        if current_status == "CANCELLED":

            raise ConflictError(
                "A cancelled marketplace order "
                "cannot be reopened"
            )

        # ----------------------------------------------------
        # NEVER MOVE COMPLETED ORDER BACK
        # ----------------------------------------------------

        if current_status == "COMPLETED":

            raise ConflictError(
                "A completed marketplace order "
                "cannot be moved to another status"
            )

        # ----------------------------------------------------
        # PENDING
        # ----------------------------------------------------
        #
        # PENDING -> CONFIRMED must happen through payment
        # verification.
        #
        # PENDING -> PROCESSING also requires confirmation.
        #
        # PENDING -> COMPLETED is not allowed.
        #
        # PENDING -> CANCELLED is allowed.
        #

        if current_status == "PENDING":

            if normalized_status == "CONFIRMED":

                raise ConflictError(
                    "A PENDING order must be confirmed "
                    "through manual UPI payment verification"
                )

            if normalized_status == "PROCESSING":

                raise ConflictError(
                    "A PENDING order must be confirmed "
                    "before processing"
                )

            if normalized_status == "COMPLETED":

                raise ConflictError(
                    "A PENDING order cannot be completed"
                )

            # ------------------------------------------------
            # CANCEL PENDING ORDER
            # ------------------------------------------------

            if normalized_status == "CANCELLED":

                cursor.execute(
                    """
                    UPDATE marketplace_orders
                    SET
                        status = 'CANCELLED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND status = 'PENDING'
                    """,
                    (order_id,),
                )

                if cursor.rowcount != 1:

                    raise ConflictError(
                        "Marketplace order could not be cancelled"
                    )

                # Release the stock reservation.
                #
                # The inventory service works with the same
                # database cursor, so this remains part of the
                # same transaction.

                from app.services.marketplace_inventory_service import (
                    release_order_inventory,
                )

                release_order_inventory(
                    order_id,
                    cursor,
                )

                # If a pending UPI payment exists, keep it local
                # and mark it failed so it cannot later be
                # verified against a cancelled order.

                cursor.execute(
                    """
                    UPDATE marketplace_payments
                    SET
                        status = 'FAILED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE order_id = %s
                      AND status = 'PENDING'
                    """,
                    (order_id,),
                )

                connection.commit()

                return {
                    "message": (
                        "Pending marketplace order "
                        "cancelled successfully"
                    ),
                    "order_id": order_id,
                    "status": "CANCELLED",
                }

        # ----------------------------------------------------
        # CONFIRMED
        # ----------------------------------------------------
        #
        # CONFIRMED -> PROCESSING
        # CONFIRMED -> COMPLETED
        #
        # A confirmed order cannot be cancelled.
        #

        if current_status == "CONFIRMED":

            if normalized_status == "PROCESSING":

                cursor.execute(
                    """
                    UPDATE marketplace_orders
                    SET
                        status = 'PROCESSING',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND status = 'CONFIRMED'
                    """,
                    (order_id,),
                )

                if cursor.rowcount != 1:

                    raise ConflictError(
                        "Marketplace order could not be moved "
                        "to PROCESSING"
                    )

                connection.commit()

                return {
                    "message": (
                        "Marketplace order is now processing"
                    ),
                    "order_id": order_id,
                    "status": "PROCESSING",
                }

            if normalized_status == "COMPLETED":

                cursor.execute(
                    """
                    UPDATE marketplace_orders
                    SET
                        status = 'COMPLETED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND status = 'CONFIRMED'
                    """,
                    (order_id,),
                )

                if cursor.rowcount != 1:

                    raise ConflictError(
                        "Marketplace order could not be completed"
                    )

                connection.commit()

                return {
                    "message": (
                        "Marketplace order completed"
                    ),
                    "order_id": order_id,
                    "status": "COMPLETED",
                }

            if normalized_status == "CANCELLED":

                raise ConflictError(
                    "A confirmed paid order cannot be cancelled"
                )

        # ----------------------------------------------------
        # PROCESSING
        # ----------------------------------------------------

        if current_status == "PROCESSING":

            if normalized_status == "COMPLETED":

                cursor.execute(
                    """
                    UPDATE marketplace_orders
                    SET
                        status = 'COMPLETED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND status = 'PROCESSING'
                    """,
                    (order_id,),
                )

                if cursor.rowcount != 1:

                    raise ConflictError(
                        "Marketplace order could not be completed"
                    )

                connection.commit()

                return {
                    "message": (
                        "Marketplace order completed"
                    ),
                    "order_id": order_id,
                    "status": "COMPLETED",
                }

            if normalized_status == "CANCELLED":

                raise ConflictError(
                    "A processing paid order cannot be cancelled"
                )

            if normalized_status == "PENDING":

                raise ConflictError(
                    "A processing order cannot return to PENDING"
                )

            if normalized_status == "CONFIRMED":

                raise ConflictError(
                    "A processing order cannot return to CONFIRMED"
                )

        # ----------------------------------------------------
        # FALLBACK
        # ----------------------------------------------------

        raise ConflictError(
            "Invalid marketplace order status transition"
        )

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()