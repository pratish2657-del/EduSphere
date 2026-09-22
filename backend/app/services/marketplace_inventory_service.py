from app.database import get_connection

# ============================================================
# FINALIZE INVENTORY
#
# Called ONLY after payment becomes PAID.
#
# reserved_quantity decreases
# quantity decreases
# ============================================================


def finalize_order_inventory(
    order_id,
    cursor,
):
    cursor.execute(
        """
        SELECT
            product_id,
            quantity

        FROM marketplace_order_items

        WHERE order_id = %s

        FOR UPDATE
        """,
        (order_id,),
    )

    items = cursor.fetchall()

    for item in items:
        cursor.execute(
            """
            UPDATE marketplace_products

            SET
                quantity = quantity - %s,
                reserved_quantity =
                    reserved_quantity - %s

            WHERE id = %s

              AND quantity >= %s

              AND reserved_quantity >= %s
            """,
            (
                item["quantity"],
                item["quantity"],
                item["product_id"],
                item["quantity"],
                item["quantity"],
            ),
        )

        if cursor.rowcount != 1:
            raise RuntimeError(
                "Inventory finalization failed for "
                f"product {item['product_id']}"
            )


# ============================================================
# RELEASE INVENTORY
#
# Used when a pending order expires or is cancelled.
#
# Physical quantity is NOT changed.
# Only reservation is released.
# ============================================================


def release_order_inventory(
    order_id,
    cursor,
):
    cursor.execute(
        """
        SELECT
            product_id,
            quantity

        FROM marketplace_order_items

        WHERE order_id = %s

        FOR UPDATE
        """,
        (order_id,),
    )

    items = cursor.fetchall()

    for item in items:
        cursor.execute(
            """
            UPDATE marketplace_products

            SET reserved_quantity =
                reserved_quantity - %s

            WHERE id = %s

              AND reserved_quantity >= %s
            """,
            (
                item["quantity"],
                item["product_id"],
                item["quantity"],
            ),
        )

        if cursor.rowcount != 1:
            raise RuntimeError(
                "Inventory release failed for "
                f"product {item['product_id']}"
            )


# ============================================================
# EXPIRE PENDING ORDERS
#
# This releases stock reserved by abandoned checkouts.
#
# No gateway call.
# ============================================================


def expire_pending_orders():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id

            FROM marketplace_orders

            WHERE status = 'PENDING'

              AND expires_at IS NOT NULL

              AND expires_at <= CURRENT_TIMESTAMP

            FOR UPDATE
            """
        )

        orders = cursor.fetchall()

        expired = []

        for order in orders:
            order_id = order["id"]

            release_order_inventory(
                order_id,
                cursor,
            )

            cursor.execute(
                """
                UPDATE marketplace_payments

                SET status = 'FAILED'

                WHERE order_id = %s

                  AND status = 'PENDING'
                """,
                (order_id,),
            )

            cursor.execute(
                """
                UPDATE marketplace_orders

                SET status = 'CANCELLED'

                WHERE id = %s

                  AND status = 'PENDING'
                """,
                (order_id,),
            )

            expired.append(order_id)

        connection.commit()

        return expired

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()