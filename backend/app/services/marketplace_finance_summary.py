"""Marketplace finance summary service used by Admin and Super Admin dashboards."""

from typing import Any

from app.database import get_connection


def get_marketplace_finance_summary() -> dict[str, Any]:
    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("""
        SELECT
            COALESCE(SUM(pt.gross_amount), 0) AS gross_sales,
            COALESCE(SUM(pt.platform_fee_amount), 0) AS platform_fees,
            COALESCE(SUM(pt.seller_amount), 0) AS seller_earnings
        FROM marketplace_seller_payout_transactions pt
        INNER JOIN marketplace_payments mp
            ON mp.order_id = pt.order_id
        INNER JOIN marketplace_orders mo
            ON mo.id = pt.order_id
        WHERE mp.status = 'PAID'
            AND mo.status IN ('CONFIRMED', 'REFUNDED')
            AND pt.status <> 'FAILED'
        """)
        sales = cursor.fetchone()

        cursor.execute("""
            SELECT
                COALESCE(SUM(amount), 0) AS refunds
            FROM marketplace_refunds
            WHERE status = 'PROCESSED'
        """)
        refund = cursor.fetchone()

        cursor.execute("""
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN pt.status IN ('PENDING','READY')
                            THEN pt.seller_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_payouts,

                COALESCE(
                    SUM(
                        CASE
                            WHEN pt.status IN ('TRANSFER_INITIATED', 'SETTLED')
                            THEN pt.seller_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS transferred_payouts,

                COALESCE(
                    SUM(
                        CASE
                            WHEN pt.status = 'SETTLED'
                            THEN pt.seller_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS settled_payouts

                FROM marketplace_seller_payout_transactions pt
                INNER JOIN marketplace_payments mp
                    ON mp.order_id = pt.order_id
                INNER JOIN marketplace_orders mo
                    ON mo.id = pt.order_id
                WHERE mp.status = 'PAID'
                    AND mo.status IN ('CONFIRMED', 'REFUNDED')
            """)
        payouts = cursor.fetchone()

        return {
            "gross_sales": float(sales["gross_sales"] or 0),
            "platform_fees": float(sales["platform_fees"] or 0),
            "seller_earnings": float(sales["seller_earnings"] or 0),
            "refunds": float(refund["refunds"] or 0),
            "pending_payouts": float(payouts["pending_payouts"] or 0),
            "transferred_payouts": float(payouts["transferred_payouts"] or 0),
            "settled_payouts": float(payouts["settled_payouts"] or 0),
        }
    finally:
        connection.close()
