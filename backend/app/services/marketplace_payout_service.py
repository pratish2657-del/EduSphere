import os
from typing import Any

import requests

from app.database import get_connection


def _reconcile_existing_transfer(key_id, key_secret, gateway_payment_id, account_id, amount_paise):
    """Look up existing Route transfers before creating another one.

    This protects against the dangerous case where the POST succeeded at
    Razorpay but the network failed before EduSphere received the response.
    """
    response = requests.get(
        f"https://api.razorpay.com/v1/payments/{gateway_payment_id}/transfers",
        auth=(key_id, key_secret),
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json() if response.content else {}

    for transfer in payload.get("items", []):
        if (
            transfer.get("recipient") == account_id
            and int(transfer.get("amount") or 0) == amount_paise
            and transfer.get("status") not in {"failed", "reversed", "partially_reversed"}
        ):
            return transfer
    return None


def attempt_route_transfers(order_id: int, gateway_payment_id: str) -> dict[str, Any]:
    """Create/reconcile seller transfers after a captured marketplace payment."""
    if os.getenv("RAZORPAY_ROUTE_ENABLED", "false").lower() != "true":
        return {"enabled": False, "attempted": 0}

    key_id = os.getenv("PAYMENT_GATEWAY_KEY_ID")
    key_secret = os.getenv("PAYMENT_GATEWAY_KEY_SECRET")
    if not key_id or not key_secret:
        return {"enabled": True, "attempted": 0, "error": "Route credentials are not configured"}

    connection = get_connection()
    attempted = 0
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                pt.id,
                pt.seller_amount,
                pt.status,
                sp.razorpay_linked_account_id,
                sp.payout_status
            FROM marketplace_seller_payout_transactions pt
            INNER JOIN marketplace_seller_payouts sp
                ON sp.user_id = pt.seller_id
            WHERE pt.order_id = %s
              AND pt.status IN ('PENDING', 'READY', 'FAILED')
            FOR UPDATE
            """,
            (order_id,),
        )
        rows = cursor.fetchall()

        for row in rows:
            account_id = row.get("razorpay_linked_account_id")
            if not account_id or row.get("payout_status") != "VERIFIED":
                continue

            amount_paise = round(float(row["seller_amount"]) * 100)
            if amount_paise < 100:
                cursor.execute(
                    "UPDATE marketplace_seller_payout_transactions SET status='ON_HOLD', failure_reason=%s WHERE id=%s",
                    ("Seller payout is below Razorpay Route minimum of ₹1.00", row["id"]),
                )
                continue

            # First reconcile. Never blindly POST again after an ambiguous result.
            try:
                existing = _reconcile_existing_transfer(
                    key_id, key_secret, gateway_payment_id, account_id, amount_paise
                )
            except requests.RequestException as error:
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET failure_reason = %s
                    WHERE id = %s
                    """,
                    (f"Route reconciliation failed: {str(error)[:900]}", row["id"]),
                )
                continue

            if existing:
                transfer_id = existing.get("id")
                transfer_status = existing.get("status") or existing.get("transfer_status")
                settlement_status = existing.get("settlement_status")
                next_status = "SETTLED" if settlement_status == "settled" else "TRANSFER_INITIATED"
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET status=%s,
                        razorpay_linked_account_id=%s,
                        razorpay_transfer_id=%s,
                        transfer_status=%s,
                        settlement_status=%s,
                        failure_reason=NULL,
                        settled_at=CASE WHEN %s='SETTLED' THEN CURRENT_TIMESTAMP ELSE settled_at END
                    WHERE id=%s
                    """,
                    (next_status, account_id, transfer_id, transfer_status, settlement_status, next_status, row["id"]),
                )
                continue

            response = requests.post(
                f"https://api.razorpay.com/v1/payments/{gateway_payment_id}/transfers",
                auth=(key_id, key_secret),
                json={
                    "transfers": [{
                        "account": account_id,
                        "amount": amount_paise,
                        "currency": "INR",
                        "notes": {
                            "edusphere_order_id": str(order_id),
                            "payout_transaction_id": str(row["id"]),
                        },
                    }]
                },
                timeout=15,
            )
            attempted += 1
            payload = response.json() if response.content else {}

            if response.ok and payload.get("items"):
                transfer = payload["items"][0]
                transfer_id = transfer.get("id")
                transfer_status = transfer.get("transfer_status") or transfer.get("status")
                settlement_status = transfer.get("settlement_status")
                next_status = "SETTLED" if settlement_status == "settled" else "TRANSFER_INITIATED"
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET status=%s,
                        razorpay_linked_account_id=%s,
                        razorpay_transfer_id=%s,
                        transfer_status=%s,
                        settlement_status=%s,
                        failure_reason=NULL,
                        settled_at=CASE WHEN %s='SETTLED' THEN CURRENT_TIMESTAMP ELSE settled_at END
                    WHERE id=%s
                    """,
                    (next_status, account_id, transfer_id, transfer_status, settlement_status, next_status, row["id"]),
                )
            else:
                error_detail = payload.get("error") or payload.get("description") or response.text[:1000]
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET status='FAILED',
                        razorpay_linked_account_id=%s,
                        failure_reason=%s
                    WHERE id=%s
                    """,
                    (account_id, str(error_detail), row["id"]),
                )

        connection.commit()
        return {"enabled": True, "attempted": attempted}
    except requests.RequestException:
        connection.rollback()
        return {"enabled": True, "attempted": attempted, "error": "Route transfer attempt failed"}
    finally:
        connection.close()
