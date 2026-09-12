from app.core.exceptions import NotFoundError
from app.database import get_connection


def _admin_institution(cursor, user_id: int) -> int:
    cursor.execute(
        "SELECT institution_id FROM admin_profiles WHERE user_id = %s LIMIT 1",
        (user_id,),
    )
    row = cursor.fetchone()
    if not row:
        raise NotFoundError("Admin profile not found")
    return row["institution_id"]


def get_marketplace_management(user_id: int):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution(cursor, user_id)

        cursor.execute(
            """
            SELECT
                p.id AS product_id,
                p.seller_id,
                u.full_name AS seller_name,
                u.email AS seller_email,
                p.institution_id,
                i.name AS institution_name,
                p.name,
                p.description,
                p.category,
                p.product_type,
                p.condition_type,
                p.price,
                p.quantity,
                p.is_active,
                p.created_at,
                p.updated_at,
                CASE WHEN p.product_type = 'DIGITAL' AND EXISTS (
                    SELECT 1 FROM marketplace_attachments ma WHERE ma.product_id = p.id
                ) THEN 1 ELSE 0 END AS digital_file_attached
            FROM marketplace_products p
            LEFT JOIN users u ON u.id = p.seller_id
            LEFT JOIN institutions i ON i.id = p.institution_id
            WHERE p.institution_id = %s
            ORDER BY p.created_at DESC
            """,
            (institution_id,),
        )
        products = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                p.seller_id,
                u.full_name AS seller_name,
                u.email AS seller_email,
                COUNT(DISTINCT p.id) AS product_count,
                SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_product_count,
                COUNT(DISTINCT o.id) AS sales_count,
                COALESCE(SUM(oi.subtotal), 0) AS total_sales,
                CASE
                    WHEN COUNT(DISTINCT p.id) > 0
                     AND SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) = 0
                    THEN 1 ELSE 0
                END AS is_suspended
            FROM marketplace_products p
            INNER JOIN users u ON u.id = p.seller_id
            LEFT JOIN marketplace_order_items oi ON oi.product_id = p.id
            LEFT JOIN marketplace_orders o ON o.id = oi.order_id
            WHERE p.institution_id = %s
            GROUP BY p.seller_id, u.full_name, u.email
            ORDER BY total_sales DESC, product_count DESC
            """,
            (institution_id,),
        )
        sellers = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                o.id AS order_id,
                o.buyer_id,
                bu.full_name AS buyer_name,
                oi.seller_id,
                su.full_name AS seller_name,
                oi.product_id,
                p.name AS product_name,
                oi.quantity,
                oi.subtotal AS amount,
                o.total_amount,
                (
                    SELECT mp.id
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS payment_id,
                (
                    SELECT mp.payment_method
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS payment_method,
                (
                    SELECT mp.status
                    FROM marketplace_payments mp
                    WHERE mp.order_id = o.id
                    ORDER BY mp.id DESC
                    LIMIT 1
                ) AS payment_status,
                o.shipping_address,
                o.status,
                o.created_at
            FROM marketplace_orders o
            INNER JOIN marketplace_order_items oi ON oi.order_id = o.id
            INNER JOIN marketplace_products p ON p.id = oi.product_id
            LEFT JOIN users bu ON bu.id = o.buyer_id
            LEFT JOIN users su ON su.id = oi.seller_id
            WHERE o.institution_id = %s
            ORDER BY o.created_at DESC
            LIMIT 500
            """,
            (institution_id,),
        )
        orders = cursor.fetchall()

        total_products = len(products)
        active_products = sum(1 for p in products if bool(p["is_active"]))
        total_orders = len(orders)
        pending_orders = sum(
            1 for o in orders
            if "PENDING" in str(o.get("status") or "").upper()
        )
        completed_orders = sum(
            1 for o in orders
            if str(o.get("status") or "").upper()
            in {"COMPLETED", "DELIVERED", "PAID"}
        )
        total_sales = sum(
            float(o.get("total_amount") or o.get("amount") or 0)
            for o in orders
        )

        return {
            "institution_id": institution_id,
            "stats": {
                "total_products": total_products,
                "active_products": active_products,
                "inactive_products": total_products - active_products,
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "completed_orders": completed_orders,
                "total_sales": total_sales,
            },
            "products": products,
            "sellers": sellers,
            "orders": orders,
        }
    finally:
        connection.close()


def set_product_status(user_id: int, product_id: int, is_active: bool):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution(cursor, user_id)

        cursor.execute(
            """
            UPDATE marketplace_products
            SET is_active = %s
            WHERE id = %s AND institution_id = %s
            """,
            (1 if is_active else 0, product_id, institution_id),
        )
        if cursor.rowcount == 0:
            raise NotFoundError("Marketplace product not found")
        connection.commit()
        return {"message": "Product status updated", "product_id": product_id, "is_active": is_active}
    finally:
        connection.close()


def delete_marketplace_product(user_id: int, product_id: int):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution(cursor, user_id)

        cursor.execute(
            """
            SELECT id FROM marketplace_products
            WHERE id = %s AND institution_id = %s
            LIMIT 1
            """,
            (product_id, institution_id),
        )
        if not cursor.fetchone():
            raise NotFoundError("Marketplace product not found")

        cursor.execute(
            """
            UPDATE marketplace_products
            SET is_active = FALSE
            WHERE id = %s AND institution_id = %s
            """,
            (product_id, institution_id),
        )
        connection.commit()
        return {
            "message": "Marketplace product removed successfully",
            "product_id": product_id,
            "is_active": False,
        }
    finally:
        connection.close()


def set_seller_status(user_id: int, seller_id: int, suspended: bool):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution(cursor, user_id)

        cursor.execute(
            """
            SELECT COUNT(*) AS count
            FROM marketplace_products
            WHERE seller_id = %s AND institution_id = %s
            """,
            (seller_id, institution_id),
        )
        row = cursor.fetchone()
        if not row or int(row["count"]) == 0:
            raise NotFoundError("Seller has no marketplace listings in this institution")

        # Marketplace seller suspension is represented by disabling the seller's
        # current listings. This avoids modifying the global user account status.
        cursor.execute(
            """
            UPDATE marketplace_products
            SET is_active = %s
            WHERE seller_id = %s AND institution_id = %s
            """,
            (0 if suspended else 1, seller_id, institution_id),
        )
        connection.commit()
        return {
            "message": "Seller marketplace status updated",
            "seller_id": seller_id,
            "suspended": suspended,
        }
    finally:
        connection.close()
