from app.database import get_connection


def finalize_order_inventory(order_id, cursor):
    """Convert a pending reservation into a completed sale."""
    cursor.execute("""
        SELECT product_id, quantity
        FROM marketplace_order_items
        WHERE order_id = %s
        FOR UPDATE
    """, (order_id,))
    items = cursor.fetchall()
    for item in items:
        cursor.execute("""
            UPDATE marketplace_products
            SET
                quantity = quantity - %s,
                reserved_quantity = reserved_quantity - %s
            WHERE id = %s
              AND quantity >= %s
              AND reserved_quantity >= %s
        """, (item['quantity'], item['quantity'], item['product_id'], item['quantity'], item['quantity']))
        if cursor.rowcount != 1:
            raise RuntimeError(f"Inventory finalization failed for product {item['product_id']}")


def release_order_inventory(order_id, cursor):
    """Release a pending reservation without changing physical stock."""
    cursor.execute("""
        SELECT product_id, quantity
        FROM marketplace_order_items
        WHERE order_id = %s
        FOR UPDATE
    """, (order_id,))
    items = cursor.fetchall()
    for item in items:
        cursor.execute("""
            UPDATE marketplace_products
            SET reserved_quantity = reserved_quantity - %s
            WHERE id = %s
              AND reserved_quantity >= %s
        """, (item['quantity'], item['product_id'], item['quantity']))
        if cursor.rowcount != 1:
            raise RuntimeError(f"Inventory release failed for product {item['product_id']}")


def restore_order_inventory(order_id, cursor):
    """Restore physical stock exactly once for a fully refunded order."""
    cursor.execute("""
        SELECT product_id, quantity
        FROM marketplace_order_items
        WHERE order_id = %s
        FOR UPDATE
    """, (order_id,))
    items = cursor.fetchall()
    for item in items:
        cursor.execute("""
            UPDATE marketplace_products
            SET quantity = quantity + %s
            WHERE id = %s
        """, (item["quantity"], item["product_id"]))


def expire_pending_orders():
    """Release reservations for expired pending orders. Safe to run repeatedly."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT id
            FROM marketplace_orders
            WHERE status = 'PENDING'
              AND expires_at IS NOT NULL
              AND expires_at <= CURRENT_TIMESTAMP
            FOR UPDATE
        """)
        orders = cursor.fetchall()
        expired = []
        for order in orders:
            release_order_inventory(order['id'], cursor)
            cursor.execute("""
                UPDATE marketplace_payments
                SET status = CASE WHEN status = 'PENDING' THEN 'FAILED' ELSE status END
                WHERE order_id = %s AND status = 'PENDING'
            """, (order['id'],))
            cursor.execute("""
                UPDATE marketplace_orders
                SET status = 'CANCELLED'
                WHERE id = %s AND status = 'PENDING'
            """, (order['id'],))
            expired.append(order['id'])
        connection.commit()
        return expired
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
