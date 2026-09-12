from fastapi import APIRouter, HTTPException, Query, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin
from app.services.marketplace_route_service import cancel_marketplace_order

router = APIRouter(
    prefix="/super-admin/marketplace",
    tags=["Super Admin Marketplace"],
)


def _super_admin(request: Request):
    return require_super_admin(request)


@router.get("/summary")
async def marketplace_summary(request: Request):
    _super_admin(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("SELECT COUNT(*) AS total FROM marketplace_products")
        products = int(cursor.fetchone()["total"] or 0)

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM marketplace_products
            WHERE is_active = TRUE
        """)
        active_products = int(cursor.fetchone()["total"] or 0)

        cursor.execute("""
            SELECT COUNT(DISTINCT seller_id) AS total
            FROM marketplace_products
        """)
        sellers = int(cursor.fetchone()["total"] or 0)

        cursor.execute("SELECT COUNT(*) AS total FROM marketplace_orders")
        orders = int(cursor.fetchone()["total"] or 0)

        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) AS total
            FROM marketplace_orders
            WHERE status = 'CONFIRMED'
        """)
        confirmed_sales = cursor.fetchone()["total"] or 0

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM marketplace_orders
            WHERE status = 'PENDING'
        """)
        pending_orders = int(cursor.fetchone()["total"] or 0)

        return {
            "products": products,
            "active_products": active_products,
            "sellers": sellers,
            "orders": orders,
            "confirmed_sales": confirmed_sales,
            "pending_orders": pending_orders,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load marketplace management summary",
        ) from error
    finally:
        connection.close()


@router.get("/products")
async def marketplace_products(
    request: Request,
    search: str | None = Query(default=None),
    active: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    _super_admin(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()

        clauses = []
        params = []

        if search and search.strip():
            clauses.append("""
                (
                    mp.name LIKE %s
                    OR mp.category LIKE %s
                    OR mp.product_type LIKE %s
                    OR seller.full_name LIKE %s
                    OR seller.email LIKE %s
                )
            """)
            term = f"%{search.strip()}%"
            params.extend([term] * 5)

        if active in {"true", "false"}:
            clauses.append("mp.is_active = %s")
            params.append(active == "true")

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        cursor.execute(
            f"""
            SELECT
                mp.id,
                mp.name,
                mp.description,
                mp.category,
                mp.product_type,
                mp.condition_type,
                mp.price,
                mp.quantity,
                mp.is_active,
                mp.seller_id,
                seller.full_name AS seller_name,
                seller.email AS seller_email,
                mp.institution_id,
                CASE WHEN mp.product_type = 'DIGITAL' AND EXISTS (
                    SELECT 1 FROM marketplace_attachments ma WHERE ma.product_id = mp.id
                ) THEN 1 ELSE 0 END AS digital_file_attached
            FROM marketplace_products mp
            LEFT JOIN users seller
                ON seller.id = mp.seller_id
            {where}
            ORDER BY mp.id DESC
            LIMIT %s
            """,
            (*params, limit),
        )

        products = cursor.fetchall()
        return {"count": len(products), "products": products}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load marketplace products",
        ) from error
    finally:
        connection.close()


@router.put("/products/{product_id}/status")
async def marketplace_product_status(
    product_id: int,
    request: Request,
):
    _super_admin(request)
    body = await request.json()
    is_active = body.get("is_active")

    if not isinstance(is_active, bool):
        raise HTTPException(
            status_code=400,
            detail="is_active must be true or false",
        )

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE marketplace_products
            SET is_active = %s
            WHERE id = %s
            """,
            (is_active, product_id),
        )

        if cursor.rowcount != 1:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="Marketplace product not found",
            )

        connection.commit()

        return {
            "message": "Marketplace product status updated",
            "product_id": product_id,
            "is_active": is_active,
        }
    except HTTPException:
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update marketplace product status",
        ) from error
    finally:
        connection.close()


@router.get("/orders")
async def marketplace_orders(
    request: Request,
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    _super_admin(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()

        clauses = []
        params = []

        if search and search.strip():
            clauses.append("""
                (
                    CAST(o.id AS CHAR) LIKE %s
                    OR buyer.full_name LIKE %s
                    OR buyer.email LIKE %s
                )
            """)
            term = f"%{search.strip()}%"
            params.extend([term, term, term])

        if status:
            clauses.append("o.status = %s")
            params.append(status.upper())

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        cursor.execute(
            f"""
            SELECT
                o.id AS order_id,
                o.buyer_id,
                buyer.full_name AS buyer_name,
                buyer.email AS buyer_email,
                o.institution_id,
                o.total_amount,
                o.status,
                o.created_at,
                o.updated_at,
                (
                    SELECT mp.id FROM marketplace_payments mp
                    WHERE mp.order_id = o.id ORDER BY mp.id DESC LIMIT 1
                ) AS payment_id,
                (
                    SELECT mp.payment_method FROM marketplace_payments mp
                    WHERE mp.order_id = o.id ORDER BY mp.id DESC LIMIT 1
                ) AS payment_method,
                (
                    SELECT mp.status FROM marketplace_payments mp
                    WHERE mp.order_id = o.id ORDER BY mp.id DESC LIMIT 1
                ) AS payment_status,
                COUNT(oi.id) AS item_count
            FROM marketplace_orders o
            LEFT JOIN users buyer
                ON buyer.id = o.buyer_id
            LEFT JOIN marketplace_order_items oi
                ON oi.order_id = o.id
            {where}
            GROUP BY
                o.id,
                o.buyer_id,
                buyer.full_name,
                buyer.email,
                o.institution_id,
                o.total_amount,
                o.status,
                o.created_at,
                o.updated_at
            ORDER BY o.created_at DESC
            LIMIT %s
            """,
            (*params, limit),
        )

        orders = cursor.fetchall()
        return {"count": len(orders), "orders": orders}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load marketplace orders",
        ) from error
    finally:
        connection.close()


@router.put("/orders/{order_id}/status")
async def marketplace_order_status(
    order_id: int,
    request: Request,
):
    user = _super_admin(request)
    body = await request.json()
    status = str(body.get("status", "")).upper()

    allowed = {"PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"}
    if status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid order status. Allowed: {', '.join(sorted(allowed))}",
        )

    if status == "CANCELLED":
        try:
            return cancel_marketplace_order(
                order_id=order_id,
                admin_user_id=user["id"],
                reason=body.get("reason"),
            )
        except Exception as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    if status == "REFUNDED":
        raise HTTPException(
            status_code=400,
            detail="Use the marketplace refund workflow to refund a paid order. "
                   "This prevents COD refunds from being sent through a payment gateway.",
        )

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE marketplace_orders
            SET status = %s
            WHERE id = %s
            """,
            (status, order_id),
        )

        if cursor.rowcount != 1:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="Marketplace order not found",
            )

        connection.commit()
        return {
            "message": "Marketplace order status updated",
            "order_id": order_id,
            "status": status,
        }
    except HTTPException:
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update marketplace order status",
        ) from error
    finally:
        connection.close()

