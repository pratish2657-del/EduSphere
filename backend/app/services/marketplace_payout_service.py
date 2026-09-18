from __future__ import annotations

from typing import Any

from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    get_split_and_settlement_details,
    get_split_reconciliation,
)


CASHFREE_RECON_HOLD_REASON = (
    "Cashfree payment is processed, but no vendor split is confirmed "
    "by Cashfree reconciliation"
)


def _extract_vendor_ids(payload: Any) -> set[str]:
    """Extract Cashfree vendor IDs from reconciliation/order responses."""
    vendor_ids: set[str] = set()

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for key in (
                "vendor_id",
                "merchant_vendor_id",
            ):
                candidate = value.get(key)
                if candidate:
                    vendor_ids.add(str(candidate))

            for child in value.values():
                walk(child)

        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(payload)
    return vendor_ids


def attempt_cashfree_split(order_id: int) -> dict[str, Any]:
    """
    Verify the Easy Split that was attached to the Cashfree order
    BEFORE the customer payment.

    IMPORTANT:
    This function deliberately does NOT call the split-after-payment API.
    Cashfree can reject a split request once a transaction is already
    processed. New EduSphere orders therefore carry `order_splits` during
    Payment Gateway order creation, and this function only reconciles the
    resulting Cashfree state after payment.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # 1. Get the actual Cashfree order ID
        # ====================================================

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                gateway,
                gateway_order_id,
                status

            FROM marketplace_payments

            WHERE order_id = %s
              AND gateway = 'CASHFREE'
              AND status = 'PAID'

            ORDER BY id DESC
            LIMIT 1
            """,
            (order_id,),
        )

        payment = cursor.fetchone()

        if not payment:
            connection.commit()
            return {
                "success": False,
                "attempted": False,
                "reason": "No successful Cashfree payment found for this order",
            }

        cashfree_order_id = payment.get("gateway_order_id")

        if not cashfree_order_id:
            connection.commit()
            return {
                "success": False,
                "attempted": False,
                "reason": "Cashfree gateway order ID is missing",
            }

        # ====================================================
        # 2. Get seller payout rows
        # ====================================================

        cursor.execute(
            """
            SELECT
                pt.id,
                pt.seller_id,
                pt.seller_amount,
                pt.status,
                pt.cashfree_split_status,
                pt.cashfree_vendor_id,

                sp.cashfree_vendor_id AS configured_vendor_id,
                sp.payout_status,
                sp.cashfree_vendor_status

            FROM marketplace_seller_payout_transactions pt

            LEFT JOIN marketplace_seller_payouts sp
                ON sp.user_id = pt.seller_id

            WHERE pt.order_id = %s

            FOR UPDATE
            """,
            (order_id,),
        )

        rows = cursor.fetchall()

        if not rows:
            connection.commit()
            return {
                "success": True,
                "attempted": False,
                "reason": "No payout rows",
                "cashfree_order_id": cashfree_order_id,
            }

        # ====================================================
        # 3. Already confirmed locally
        # ====================================================

        if all(
            str(row.get("cashfree_split_status") or "").upper()
            == "CREATED"
            for row in rows
        ):
            connection.commit()
            return {
                "success": True,
                "attempted": False,
                "already_processed": True,
                "cashfree_split_confirmed": True,
                "cashfree_order_id": cashfree_order_id,
                "reason": "Cashfree Easy Split was already confirmed",
            }

        # ====================================================
        # 4. Validate local vendor configuration
        # ====================================================

        expected_vendor_ids: set[str] = set()

        for row in rows:
            vendor_id = (
                row.get("cashfree_vendor_id")
                or row.get("configured_vendor_id")
            )
            payout_status = str(
                row.get("payout_status") or ""
            ).upper()
            vendor_status = str(
                row.get("cashfree_vendor_status") or ""
            ).upper()
            seller_amount = float(row.get("seller_amount") or 0)

            if seller_amount <= 0:
                continue

            if (
                not vendor_id
                or payout_status != "VERIFIED"
                or vendor_status != "ACTIVE"
            ):
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET
                        status = 'ON_HOLD',
                        failure_reason = %s,
                        cashfree_split_status = 'PENDING'
                    WHERE id = %s
                    """,
                    (
                        "Cashfree Easy Split vendor is not verified/ACTIVE",
                        row["id"],
                    ),
                )
                continue

            vendor_id = str(vendor_id)
            expected_vendor_ids.add(vendor_id)

            cursor.execute(
                """
                UPDATE marketplace_seller_payout_transactions
                SET
                    cashfree_vendor_id = %s,
                    cashfree_split_status = 'PENDING'
                WHERE id = %s
                """,
                (vendor_id, row["id"]),
            )

        if not expected_vendor_ids:
            connection.commit()
            return {
                "success": False,
                "attempted": False,
                "cashfree_split_confirmed": False,
                "cashfree_order_id": cashfree_order_id,
                "reason": "No verified/ACTIVE Cashfree vendors",
            }

        # ====================================================
        # 5. Ask Cashfree for authoritative split state
        # ====================================================

        cashfree_settlement = get_split_and_settlement_details(
            cashfree_order_id
        )
        cashfree_reconciliation = get_split_reconciliation(
            cashfree_order_id
        )

        observed_vendor_ids = (
            _extract_vendor_ids(cashfree_settlement)
            | _extract_vendor_ids(cashfree_reconciliation)
        )

        confirmed_vendor_ids = (
            expected_vendor_ids & observed_vendor_ids
        )

        settlement = (
            cashfree_settlement.get("settlement", {})
            if isinstance(cashfree_settlement, dict)
            else {}
        )
        settlement_id = settlement.get("cf_settlement_id")
        transfer_utr = settlement.get("transfer_utr")

        # ====================================================
        # 6. Confirm each vendor only when Cashfree confirms it
        # ====================================================

        all_confirmed = bool(expected_vendor_ids) and (
            confirmed_vendor_ids == expected_vendor_ids
        )

        for row in rows:
            vendor_id = (
                row.get("cashfree_vendor_id")
                or row.get("configured_vendor_id")
            )

            if not vendor_id:
                continue

            vendor_id = str(vendor_id)

            if vendor_id in confirmed_vendor_ids:
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET
                        cashfree_vendor_id = %s,
                        cashfree_split_status = 'CREATED',
                        status = CASE
                            WHEN status = 'SETTLED' THEN status
                            ELSE 'TRANSFER_INITIATED'
                        END,
                        cashfree_settlement_id = %s,
                        cashfree_transfer_id = COALESCE(%s, cashfree_transfer_id),
                        failure_reason = NULL
                    WHERE id = %s
                    """,
                    (
                        vendor_id,
                        settlement_id,
                        transfer_utr,
                        row["id"],
                    ),
                )
            else:
                cursor.execute(
                    """
                    UPDATE marketplace_seller_payout_transactions
                    SET
                        cashfree_split_status = 'PENDING',
                        status = 'ON_HOLD',
                        failure_reason = %s
                    WHERE id = %s
                      AND status <> 'SETTLED'
                    """,
                    (
                        CASHFREE_RECON_HOLD_REASON,
                        row["id"],
                    ),
                )

        connection.commit()

        return {
            "success": all_confirmed,
            "attempted": True,
            "cashfree_split_confirmed": all_confirmed,
            "cashfree_order_id": cashfree_order_id,
            "expected_vendor_ids": sorted(expected_vendor_ids),
            "confirmed_vendor_ids": sorted(confirmed_vendor_ids),
            "cashfree_settlement": cashfree_settlement,
            "cashfree_reconciliation": cashfree_reconciliation,
            "reason": (
                "Cashfree vendor split confirmed"
                if all_confirmed
                else CASHFREE_RECON_HOLD_REASON
            ),
        }

    except Exception as exc:
        connection.rollback()
        return {
            "success": False,
            "attempted": True,
            "cashfree_split_confirmed": False,
            "error": str(exc)[:1000],
        }

    finally:
        connection.close()


# ============================================================
# Backward compatibility
# ============================================================


def attempt_route_transfers(
    order_id: int,
    gateway_payment_id: str | None = None,
) -> dict[str, Any]:
    return attempt_cashfree_split(order_id)
