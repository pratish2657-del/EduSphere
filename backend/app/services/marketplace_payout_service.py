from __future__ import annotations

from typing import Any

from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    split_after_payment,
)


def attempt_cashfree_split(order_id: int) -> dict[str, Any]:
    """
    Create the Cashfree Easy Split after a successful payment.

    Important:
    `order_id` is the local EduSphere order ID.

    Cashfree Easy Split requires the ACTUAL Cashfree
    gateway order ID, which is stored in
    marketplace_payments.gateway_order_id.
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
                "reason": (
                    "No successful Cashfree payment "
                    "found for this order"
                ),
            }

        cashfree_order_id = (
            payment.get("gateway_order_id")
        )

        if not cashfree_order_id:
            connection.commit()

            return {
                "success": False,
                "attempted": False,
                "reason": (
                    "Cashfree gateway order ID is missing"
                ),
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

                sp.cashfree_vendor_id,
                sp.payout_status,
                sp.cashfree_vendor_status

            FROM marketplace_seller_payout_transactions pt

            LEFT JOIN marketplace_seller_payouts sp
                ON sp.user_id = pt.seller_id

            WHERE pt.order_id = %s

              AND pt.status IN (
                  'PENDING',
                  'READY',
                  'FAILED',
                  'ON_HOLD'
              )

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
        # 2A. Local Easy Split idempotency
        #
        # /payments/verify and the Cashfree webhook may both call
        # attempt_cashfree_split(). Once the split is locally marked
        # CREATED, never send the same order to Cashfree again.
        # ====================================================

        if any(
            str(row.get("cashfree_split_status") or "").upper() == "CREATED"
            for row in rows
        ):
            connection.commit()
            return {
                "success": True,
                "attempted": False,
                "already_processed": True,
                "reason": "Cashfree Easy Split was already created",
                "cashfree_order_id": cashfree_order_id,
            }

        # ====================================================
        # 3. Build Easy Split data
        # ====================================================

        splits = []

        for row in rows:

            vendor_id = (
                row.get("cashfree_vendor_id")
            )

            seller_amount = float(
                row.get("seller_amount") or 0
            )

            payout_status = str(
                row.get("payout_status") or ""
            ).upper()

            vendor_status = str(
                row.get("cashfree_vendor_status") or ""
            ).upper()

            # ------------------------------------------------
            # Vendor must be verified/active
            # ------------------------------------------------

            if (
                not vendor_id
                or payout_status != "VERIFIED"
                or vendor_status != "ACTIVE"
            ):
                cursor.execute(
                    """
                    UPDATE
                        marketplace_seller_payout_transactions

                    SET
                        status = 'ON_HOLD',
                        failure_reason = %s

                    WHERE id = %s
                    """,
                    (
                        "Cashfree Easy Split vendor is not verified/ACTIVE",
                        row["id"],
                    ),
                )

                continue

            # ------------------------------------------------
            # Ignore zero-value payouts
            # ------------------------------------------------

            if seller_amount <= 0:
                continue

            # ------------------------------------------------
            # Add seller split
            # ------------------------------------------------

            splits.append(
                {
                    "vendor_id": vendor_id,
                    "amount": round(
                        seller_amount,
                        2,
                    ),
                }
            )

            cursor.execute(
                """
                UPDATE
                    marketplace_seller_payout_transactions

                SET
                    cashfree_vendor_id = %s,
                    cashfree_split_status = 'PENDING',
                    status = 'READY',
                    failure_reason = NULL

                WHERE id = %s
                """,
                (
                    vendor_id,
                    row["id"],
                ),
            )

        # ====================================================
        # 4. No verified vendors
        # ====================================================

        if not splits:

            connection.commit()

            return {
                "success": False,
                "attempted": False,
                "reason": (
                    "No verified/ACTIVE Cashfree vendors"
                ),
                "cashfree_order_id": cashfree_order_id,
            }

        # ====================================================
        # 5. IMPORTANT:
        #
        # Use the ACTUAL Cashfree order ID.
        #
        # NOT:
        #     EDU-{local_order_id}
        #
        # Example:
        #     EDU-23-PAY-22
        # ====================================================

        result = split_after_payment(
            cashfree_order_id,
            splits,
        )

        # ====================================================
        # 6. Mark split as created
        # ====================================================

        for row in rows:

            if row.get("cashfree_vendor_id"):

                cursor.execute(
                    """
                    UPDATE
                        marketplace_seller_payout_transactions

                    SET
                        cashfree_split_status = 'CREATED',
                        status = 'TRANSFER_INITIATED',
                        failure_reason = NULL

                    WHERE id = %s

                      AND status IN (
                          'READY',
                          'TRANSFER_INITIATED'
                      )
                    """,
                    (row["id"],),
                )

        connection.commit()

        return {
            "success": True,
            "attempted": True,
            "cashfree_order_id": cashfree_order_id,
            "splits": splits,
            "result": result,
        }

    except (ValueError, RuntimeError) as exc:
        error_text = str(exc)[:1000]
        connection.rollback()

        # Cashfree can report this when the order-level split has already
        # been processed but the local EduSphere ledger still says PENDING.
        # Reconcile that known state instead of repeatedly retrying the API.
        if "Transaction already processed, not eligible for split" in error_text:
            reconnection = get_connection()

            try:
                recursor = reconnection.cursor()

        # The previous transaction was rolled back after Cashfree
        # rejected the duplicate split. Therefore cashfree_vendor_id
        # may still be NULL in marketplace_seller_payout_transactions.
        #
        # Recover the vendor ID from marketplace_seller_payouts and
        # reconcile the local ledger.

                recursor.execute(
                    """
                    SELECT
                        pt.id,
                        sp.cashfree_vendor_id
                    FROM marketplace_seller_payout_transactions pt

                    LEFT JOIN marketplace_seller_payouts sp
                        ON sp.user_id = pt.seller_id

                    WHERE pt.order_id = %s
                        AND pt.status IN (
                            'PENDING',
                            'READY',
                            'FAILED',
                            'ON_HOLD'
                        )
                    """,
                    (order_id,),
                )

                reconciliation_rows = recursor.fetchall()

                updated = 0

                for reconciliation_row in reconciliation_rows:
                    vendor_id = reconciliation_row.get(
                        "cashfree_vendor_id"
                    )

                    if not vendor_id:
                        continue

                    recursor.execute(
                        """
                        UPDATE marketplace_seller_payout_transactions

                        SET
                            cashfree_vendor_id = %s,
                            cashfree_split_status = 'CREATED',
                            status = 'TRANSFER_INITIATED',
                            failure_reason = NULL

                        WHERE id = %s
                            AND status IN (
                                'PENDING',
                                'READY',
                                'FAILED',
                                'ON_HOLD'
                            )
                        """,
                        (
                            vendor_id,
                            reconciliation_row["id"],
                        ),
                    )

                    updated += recursor.rowcount

                reconnection.commit()

            finally:
                reconnection.close()

        return {
            "success": True,
            "attempted": False,
            "already_processed": True,
            "reconciled": updated > 0,
            "updated_rows": updated,
            "cashfree_order_id": cashfree_order_id,
            "reason": (
                "Cashfree reports the transaction was already "
                "processed; local payout ledger reconciled"
            ),
        }

        return {
            "success": False,
            "attempted": True,
            "error": error_text,
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