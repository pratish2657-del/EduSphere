from __future__ import annotations

from typing import Any

from app.core.exceptions import BadRequestError
from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    get_split_reconciliation,
    split_after_payment,
)


CASHFREE_RECON_HOLD_REASON = (
    "Cashfree payment is processed, but no vendor split "
    "is confirmed by Cashfree reconciliation"
)


def _reconciliation_vendor_ids(
    reconciliation: Any,
) -> set[str]:
    """Extract vendor IDs actually reported by Cashfree."""

    if not isinstance(
        reconciliation,
        dict,
    ):
        return set()

    data = reconciliation.get(
        "data"
    )

    if not isinstance(
        data,
        list,
    ):
        return set()

    vendor_ids: set[str] = set()

    for item in data:
        if not isinstance(
            item,
            dict,
        ):
            continue

        # --------------------------------------------------------
        # Vendor commission record
        # --------------------------------------------------------

        entity_type = str(
            item.get("entity_type")
            or ""
        ).strip().lower()

        if entity_type == "vendor_commission":
            vendor_id = item.get(
                "merchant_vendor_id"
            )

            if vendor_id:
                vendor_ids.add(
                    str(vendor_id)
                )

        # --------------------------------------------------------
        # Direct vendor IDs
        # --------------------------------------------------------

        for key in (
            "merchant_vendor_id",
            "vendor_id",
        ):
            vendor_id = item.get(
                key
            )

            if vendor_id:
                vendor_ids.add(
                    str(vendor_id)
                )

        # --------------------------------------------------------
        # Order split records
        # --------------------------------------------------------

        order_splits = item.get(
            "order_splits"
        )

        if not isinstance(
            order_splits,
            list,
        ):
            continue

        for split_group in order_splits:
            if not isinstance(
                split_group,
                dict,
            ):
                continue

            split_items = split_group.get(
                "split"
            )

            if not isinstance(
                split_items,
                list,
            ):
                continue

            for split_item in split_items:
                if not isinstance(
                    split_item,
                    dict,
                ):
                    continue

                for key in (
                    "merchant_vendor_id",
                    "vendor_id",
                ):
                    vendor_id = split_item.get(
                        key
                    )

                    if vendor_id:
                        vendor_ids.add(
                            str(vendor_id)
                        )

    return vendor_ids


def _cashfree_reconciliation_confirms_vendor(
    reconciliation: Any,
    vendor_id: str,
) -> bool:
    return (
        str(vendor_id)
        in _reconciliation_vendor_ids(
            reconciliation
        )
    )


def attempt_cashfree_split(
    order_id: int,
) -> dict[str, Any]:
    """
    Create Cashfree Easy Split after successful payment.

    `order_id` is the local EduSphere order ID.

    Cashfree receives the actual gateway order ID from
    marketplace_payments.gateway_order_id.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ========================================================
        # 1. Successful Cashfree payment
        # ========================================================

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
            return {
                "success": False,
                "attempted": False,
                "reason": (
                    "No successful Cashfree payment "
                    "found for this order"
                ),
            }

        cashfree_order_id = (
            payment.get(
                "gateway_order_id"
            )
        )

        if not cashfree_order_id:
            return {
                "success": False,
                "attempted": False,
                "reason": (
                    "Cashfree gateway order ID "
                    "is missing"
                ),
            }

        # ========================================================
        # 2. Get payout rows
        # ========================================================

        cursor.execute(
            """
            SELECT
                pt.id,
                pt.seller_id,
                pt.seller_amount,
                pt.status,
                pt.cashfree_vendor_id,
                pt.cashfree_split_status,
                pt.failure_reason,

                sp.cashfree_vendor_id AS configured_vendor_id,
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
            return {
                "success": True,
                "attempted": False,
                "reason": "No payout rows",
                "cashfree_order_id": (
                    cashfree_order_id
                ),
            }

        # ========================================================
        # 3. Already confirmed
        # ========================================================

        if any(
            str(
                row.get(
                    "cashfree_split_status"
                )
                or ""
            ).upper()
            == "CREATED"
            for row in rows
        ):
            connection.commit()

            return {
                "success": True,
                "attempted": False,
                "already_processed": True,
                "cashfree_split_confirmed": True,
                "reconciled": True,
                "cashfree_order_id": (
                    cashfree_order_id
                ),
                "reason": (
                    "Cashfree Easy Split is already "
                    "confirmed locally"
                ),
            }

        # ========================================================
        # 4. Reconciliation hold
        #
        # Do NOT POST another split request.
        # ========================================================

        if any(
            str(
                row.get(
                    "failure_reason"
                )
                or ""
            ).startswith(
                "Cashfree payment is processed"
            )
            for row in rows
        ):
            connection.commit()

            return {
                "success": False,
                "attempted": False,
                "already_processed": True,
                "cashfree_split_confirmed": False,
                "reconciled": False,
                "cashfree_order_id": (
                    cashfree_order_id
                ),
                "reason": (
                    "This payout is on hold because "
                    "Cashfree processed the payment but "
                    "has not confirmed the vendor split. "
                    "Use Verify Cashfree."
                ),
            }

        # ========================================================
        # 5. Build splits
        # ========================================================

        splits: list[dict[str, Any]] = []

        eligible_rows = []

        for row in rows:
            vendor_id = (
                row.get(
                    "cashfree_vendor_id"
                )
                or row.get(
                    "configured_vendor_id"
                )
            )

            seller_amount = float(
                row.get(
                    "seller_amount"
                )
                or 0
            )

            payout_status = str(
                row.get(
                    "payout_status"
                )
                or ""
            ).upper()

            vendor_status = str(
                row.get(
                    "cashfree_vendor_status"
                )
                or ""
            ).upper()

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
                        cashfree_vendor_id = %s,
                        status = 'ON_HOLD',
                        failure_reason = %s

                    WHERE id = %s
                    """,
                    (
                        vendor_id,
                        (
                            "Cashfree Easy Split vendor "
                            "is not verified/ACTIVE"
                        ),
                        row["id"],
                    ),
                )

                continue

            if seller_amount <= 0:
                continue

            split = {
                "vendor_id": vendor_id,
                "amount": round(
                    seller_amount,
                    2,
                ),
            }

            splits.append(
                split
            )

            eligible_rows.append(
                (
                    row,
                    vendor_id,
                )
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

        # ========================================================
        # 6. No eligible vendors
        # ========================================================

        if not splits:
            connection.commit()

            return {
                "success": False,
                "attempted": False,
                "cashfree_split_confirmed": False,
                "cashfree_order_id": (
                    cashfree_order_id
                ),
                "reason": (
                    "No verified/ACTIVE "
                    "Cashfree vendors"
                ),
            }

        # ========================================================
        # 7. Create Cashfree Easy Split
        # ========================================================

        result = split_after_payment(
            cashfree_order_id,
            splits,
        )

        # ========================================================
        # 8. Cashfree accepted the split
        #
        # This is the only normal path that marks CREATED.
        # ========================================================

        for row, vendor_id in eligible_rows:
            cursor.execute(
                """
                UPDATE
                    marketplace_seller_payout_transactions

                SET
                    cashfree_vendor_id = %s,
                    cashfree_split_status = 'CREATED',
                    status = 'TRANSFER_INITIATED',
                    failure_reason = NULL

                WHERE id = %s
                """,
                (
                    vendor_id,
                    row["id"],
                ),
            )

        connection.commit()

        return {
            "success": True,
            "attempted": True,
            "cashfree_order_id": (
                cashfree_order_id
            ),
            "splits": splits,
            "cashfree_split_confirmed": True,
            "reconciled": True,
            "result": result,
        }

    except BadRequestError as exc:
        error_text = str(exc)[:1000]

        connection.rollback()

        # ========================================================
        # CASHFREE:
        #
        # Transaction already processed,
        # not eligible for split
        #
        # IMPORTANT:
        # This is NOT proof that our vendor split exists.
        # ========================================================

        if (
            "Transaction already processed, "
            "not eligible for split"
            in error_text
        ):
            reconnection = get_connection()

            try:
                recursor = reconnection.cursor()

                # ------------------------------------------------
                # Recover payout rows after rollback
                # ------------------------------------------------

                recursor.execute(
                    """
                    SELECT
                        pt.id,
                        pt.seller_id,
                        pt.seller_amount,
                        pt.status,
                        pt.cashfree_vendor_id,

                        sp.cashfree_vendor_id
                            AS configured_vendor_id

                    FROM marketplace_seller_payout_transactions pt

                    LEFT JOIN marketplace_seller_payouts sp
                        ON sp.user_id = pt.seller_id

                    WHERE pt.order_id = %s
                    """,
                    (order_id,),
                )

                payout_rows = (
                    recursor.fetchall()
                )

                # ------------------------------------------------
                # Ask Cashfree for authoritative reconciliation
                # ------------------------------------------------

                try:
                    reconciliation = (
                        get_split_reconciliation(
                            cashfree_order_id
                        )
                    )

                except Exception as recon_error:
                    for payout_row in payout_rows:
                        vendor_id = (
                            payout_row.get(
                                "cashfree_vendor_id"
                            )
                            or payout_row.get(
                                "configured_vendor_id"
                            )
                        )

                        recursor.execute(
                            """
                            UPDATE
                                marketplace_seller_payout_transactions

                            SET
                                cashfree_vendor_id = %s,
                                cashfree_split_status = 'PENDING',
                                status = 'ON_HOLD',
                                failure_reason = %s

                            WHERE id = %s
                            """,
                            (
                                vendor_id,
                                (
                                    CASHFREE_RECON_HOLD_REASON
                                    + ". Reconciliation request "
                                    "failed: "
                                    + str(
                                        recon_error
                                    )[:500]
                                ),
                                payout_row["id"],
                            ),
                        )

                    reconnection.commit()

                    return {
                        "success": False,
                        "attempted": False,
                        "already_processed": True,
                        "cashfree_split_confirmed": False,
                        "reconciled": False,
                        "updated_rows": 0,
                        "cashfree_order_id": (
                            cashfree_order_id
                        ),
                        "reason": (
                            CASHFREE_RECON_HOLD_REASON
                        ),
                    }

                # ------------------------------------------------
                # Check Cashfree vendor records
                # ------------------------------------------------

                cashfree_vendor_ids = (
                    _reconciliation_vendor_ids(
                        reconciliation
                    )
                )

                updated = 0
                confirmed_vendor_ids = []

                # ------------------------------------------------
                # Only mark CREATED when Cashfree confirms
                # the exact vendor.
                # ------------------------------------------------

                for payout_row in payout_rows:
                    vendor_id = (
                        payout_row.get(
                            "cashfree_vendor_id"
                        )
                        or payout_row.get(
                            "configured_vendor_id"
                        )
                    )

                    if not vendor_id:
                        continue

                    if (
                        str(vendor_id)
                        not in cashfree_vendor_ids
                    ):
                        continue

                    recursor.execute(
                        """
                        UPDATE
                            marketplace_seller_payout_transactions

                        SET
                            cashfree_vendor_id = %s,
                            cashfree_split_status = 'CREATED',
                            status = 'TRANSFER_INITIATED',
                            failure_reason = NULL

                        WHERE id = %s
                        """,
                        (
                            vendor_id,
                            payout_row["id"],
                        ),
                    )

                    updated += (
                        recursor.rowcount
                    )

                    confirmed_vendor_ids.append(
                        str(vendor_id)
                    )

                # ------------------------------------------------
                # No Cashfree vendor split found.
                # ------------------------------------------------

                if updated == 0:
                    for payout_row in payout_rows:
                        vendor_id = (
                            payout_row.get(
                                "cashfree_vendor_id"
                            )
                            or payout_row.get(
                                "configured_vendor_id"
                            )
                        )

                        recursor.execute(
                            """
                            UPDATE
                                marketplace_seller_payout_transactions

                            SET
                                cashfree_vendor_id = %s,
                                cashfree_split_status = 'PENDING',
                                status = 'ON_HOLD',
                                failure_reason = %s

                            WHERE id = %s
                            """,
                            (
                                vendor_id,
                                CASHFREE_RECON_HOLD_REASON,
                                payout_row["id"],
                            ),
                        )

                reconnection.commit()

                if updated > 0:
                    return {
                        "success": True,
                        "attempted": False,
                        "already_processed": True,
                        "cashfree_split_confirmed": True,
                        "reconciled": True,
                        "updated_rows": updated,
                        "confirmed_vendor_ids": (
                            confirmed_vendor_ids
                        ),
                        "cashfree_order_id": (
                            cashfree_order_id
                        ),
                        "cashfree_reconciliation": (
                            reconciliation
                        ),
                        "reason": (
                            "Cashfree reported the transaction "
                            "as already processed and reconciliation "
                            "confirmed the vendor split"
                        ),
                    }

                return {
                    "success": False,
                    "attempted": False,
                    "already_processed": True,
                    "cashfree_split_confirmed": False,
                    "reconciled": False,
                    "updated_rows": 0,
                    "cashfree_order_id": (
                        cashfree_order_id
                    ),
                    "cashfree_reconciliation": (
                        reconciliation
                    ),
                    "reason": (
                        CASHFREE_RECON_HOLD_REASON
                    ),
                }

            finally:
                reconnection.close()

        # ========================================================
        # Other Cashfree errors
        # ========================================================

        return {
            "success": False,
            "attempted": True,
            "cashfree_split_confirmed": False,
            "error": error_text,
            "cashfree_order_id": (
                cashfree_order_id
            ),
        }

    finally:
        connection.close()


# ============================================================
# BACKWARD COMPATIBILITY
# ============================================================


def attempt_route_transfers(
    order_id: int,
    gateway_payment_id: str | None = None,
) -> dict[str, Any]:
    return attempt_cashfree_split(
        order_id
    )