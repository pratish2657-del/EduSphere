from __future__ import annotations

from typing import Any

from app.database import get_connection
from app.services.cashfree_easy_split_service import split_after_payment


def attempt_cashfree_split(order_id: int, gateway_order_id: str | None = None) -> dict[str, Any]:
    """Create the Cashfree Easy Split for a successfully paid marketplace order.

    The split endpoint must receive the actual Cashfree order_id, not EduSphere's
    local numeric order ID. If the caller does not provide it, recover it from
    the local marketplace_payments record.
    """
    connection = get_connection()
    try:
        cursor = connection.cursor()

        if not gateway_order_id:
            cursor.execute(
                """
                SELECT gateway_order_id
                FROM marketplace_payments
                WHERE order_id=%s AND gateway='CASHFREE'
                ORDER BY id DESC
                LIMIT 1
                """,
                (order_id,),
            )
            payment_row = cursor.fetchone()
            gateway_order_id = payment_row.get("gateway_order_id") if payment_row else None

        if not gateway_order_id:
            connection.commit()
            return {"success": False, "attempted": False, "reason": "missing Cashfree gateway order ID"}

        cursor.execute(
            """
            SELECT pt.id, pt.seller_id, pt.seller_amount, pt.status,
                   sp.cashfree_vendor_id, sp.payout_status
            FROM marketplace_seller_payout_transactions pt
            LEFT JOIN marketplace_seller_payouts sp ON sp.user_id = pt.seller_id
            WHERE pt.order_id=%s
              AND pt.status IN ('PENDING','READY','FAILED','ON_HOLD')
            FOR UPDATE
            """,
            (order_id,),
        )
        rows = cursor.fetchall()
        if not rows:
            connection.commit()
            return {"success": True, "attempted": False, "reason": "no payout rows"}

        splits = []
        split_row_ids = []
        for row in rows:
            vendor_id = row.get("cashfree_vendor_id")
            seller_amount = float(row.get("seller_amount") or 0)
            if not vendor_id or row.get("payout_status") != "VERIFIED":
                cursor.execute(
                    "UPDATE marketplace_seller_payout_transactions SET status='ON_HOLD', failure_reason=%s WHERE id=%s",
                    ("Cashfree Easy Split vendor onboarding is not verified", row["id"]),
                )
                continue
            if seller_amount <= 0:
                continue
            splits.append({"vendor_id": vendor_id, "amount": round(seller_amount, 2)})
            split_row_ids.append(row["id"])
            cursor.execute(
                "UPDATE marketplace_seller_payout_transactions SET cashfree_vendor_id=%s, cashfree_split_status='PENDING', status='READY', failure_reason=NULL WHERE id=%s",
                (vendor_id, row["id"]),
            )

        if not splits:
            connection.commit()
            return {"success": False, "attempted": False, "reason": "no verified Cashfree vendors"}

        result = split_after_payment(gateway_order_id, splits)
        for row_id in split_row_ids:
            cursor.execute(
                "UPDATE marketplace_seller_payout_transactions SET cashfree_split_status='CREATED', status='TRANSFER_INITIATED' WHERE id=%s AND status IN ('READY','TRANSFER_INITIATED')",
                (row_id,),
            )
        connection.commit()
        return {"success": True, "attempted": True, "gateway_order_id": gateway_order_id, "result": result}
    except Exception as exc:  # noqa: BLE001
        connection.rollback()
        return {
            "success": False,
            "attempted": True,
            "error": str(exc)[:1000],
        }
    finally:
        connection.close()


# Backward-compatible service name for callers being migrated.
def attempt_route_transfers(order_id: int, gateway_payment_id: str | None = None) -> dict[str, Any]:
    return attempt_cashfree_split(order_id)
