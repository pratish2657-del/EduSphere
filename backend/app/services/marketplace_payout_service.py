from __future__ import annotations

from typing import Any

from app.core.exceptions import BadRequestError
from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    get_split_reconciliation,
    split_after_payment,
)


CASHFREE_RECON_HOLD_REASON = (
    "Cashfree reports the transaction as already processed, "
    "but Easy Split reconciliation contains no confirmed "
    "vendor split"
)


def _reconciliation_vendor_ids(
    reconciliation: Any,
) -> set[str]:
    """Extract vendor IDs that Cashfree actually reports."""

    if not isinstance(reconciliation, dict):
        return set()

    data = reconciliation.get("data")

    if not isinstance(data, list):
        return set()

    vendor_ids: set[str] = set()

    for item in data:
        if not isinstance(item, dict):
            continue

        # --------------------------------------------------------
        # Direct vendor commission record
        # --------------------------------------------------------

        entity_type = str(
            item.get("entity_type") or ""
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

                vendor_id = split_item.get(
                    "merchant_vendor_id"
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
    """Return True only when Cashfree reports this vendor."""

    vendor_ids = _reconciliation_vendor_ids(
        reconciliation
    )

    return str(vendor_id) in vendor_ids


def attempt_cashfree_split(
    order_id: int,
) -> dict[str, Any]:
    """
    Create the Cashfree Easy Split after a successful payment.

    `order_id` is the local EduSphere order ID.

    Cashfree requires the actual gateway order ID stored in
    marketplace_payments.gateway_order_id.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # 1. Get successful Cashfree payment
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
            payment.get(
                "gateway_order_id"
            )
        )

        if not cashfree_order_id:
            connection.commit()

            return {
                "success": False,
                "attempted": False,
                "reason": (
                    "Cashfree gateway order ID "
                    "is missing"
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
                pt.failure_reason,

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
        # 2A. Already confirmed locally
        # ====================================================

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
                "reason": (
                    "Cashfree Easy Split was "
                    "already confirmed"
                ),
                "cashfree_order_id": (
                    cashfree_order_id
                ),
            }

        # ====================================================
        # 2B. Previously placed on reconciliation hold
        #
        # IMPORTANT:
        # Do not repeatedly POST the same split.
        # ====================================================

        if any(
            str(
                row.get("failure_reason")
                or ""
            ).startswith(
                "Cashfree reports the transaction"
            )
            for row in rows
        ):
            connection.commit()

            return {
                "success": False,
                "attempted": False,
                "already_processed": True,
                "cashfree_split_confirmed": False,
                "cashfree_order_id": (
                    cashfree_order_id
                ),
                "reason": (
                    "Cashfree previously reported "
                    "this transaction as already processed, "
                    "but the vendor split was not confirmed "
                    "by reconciliation. Verification is required "
                    "before another split attempt."
                ),
            }

        # ====================================================
        # 3. Build Easy Split data
        # ====================================================

        splits = []

        for row in rows:
            vendor_id = row.get(
                "cashfree_vendor_id"
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
                        (
                            "Cashfree Easy Split vendor "
                            "is not verified/ACTIVE"
                        ),
                        row["id"],
                    ),
                )

                continue

            # ------------------------------------------------
            # Ignore zero-value payouts
            # ------------------------------------------------

            if seller_amount <= 0:
                continue

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
                    "No verified/ACTIVE "
                    "Cashfree vendors"
                ),
                "cashfree_order_id": (
                    cashfree_order_id
                ),
            }

        # ====================================================
        # 5. Send actual Cashfree order ID
        # ====================================================

        result = split_after_payment(
            cashfree_order_id,
            splits,
        )

        # ====================================================
        # 6. Mark split CREATED only after successful
        #    Cashfree split API response.
        # ====================================================

        for row in rows:
            if row.get(
                "cashfree_vendor_id"
            ):
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
            "cashfree_order_id": (
                cashfree_order_id
            ),
            "splits": splits,
            "cashfree_split_confirmed": True,
            "result": result,
        }

    except BadRequestError as exc:
        error_text = str(exc)[:1000]

        connection.rollback()

        # ====================================================
        # Cashfree:
        #
        # Transaction already processed,
        # not eligible for split
        #
        # IMPORTANT:
        # This does NOT mean our vendor split exists.
        # ====================================================

        if (
            "Transaction already processed, "
            "not eligible for split"
            in error_text
        ):
            reconnection = get_connection()

            try:
                recursor = reconnection.cursor()

                # ------------------------------------------------
                # Recover payout/vendor information after rollback
                # ------------------------------------------------

                recursor.execute(
                    """
                    SELECT
                        pt.id,
                        pt.seller_id,
                        pt.seller_amount,
                        pt.status,
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
                    # --------------------------------------------
                    # We know Cashfree processed the transaction,
                    # but cannot verify the vendor split.
                    #
                    # Put the local payout on HOLD.
                    # --------------------------------------------

                    for payout_row in payout_rows:
                        recursor.execute(
                            """
                            UPDATE
                                marketplace_seller_payout_transactions

                            SET
                                cashfree_vendor_id = COALESCE(
                                    %s,
                                    cashfree_vendor_id
                                ),
                                cashfree_split_status = 'PENDING',
                                status = 'ON_HOLD',
                                failure_reason = %s

                            WHERE id = %s
                            """,
                            (
                                payout_row.get(
                                    "cashfree_vendor_id"
                                ),
                                (
                                    CASHFREE_RECON_HOLD_REASON
                                    + ". Reconciliation request "
                                    "also failed: "
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
                # Determine which vendors Cashfree actually knows
                # ------------------------------------------------

                cashfree_vendor_ids = (
                    _reconciliation_vendor_ids(
                        reconciliation
                    )
                )

                updated = 0
                confirmed_vendor_ids = []

                # ------------------------------------------------
                # Only mark CREATED when the vendor returned by
                # Cashfree matches our seller vendor.
                # ------------------------------------------------

                for payout_row in payout_rows:
                    vendor_id = (
                        payout_row.get(
                            "cashfree_vendor_id"
                        )
                    )

                    if not vendor_id:
                        continue

                    if not _cashfree_reconciliation_confirms_vendor(
                        reconciliation,
                        str(vendor_id),
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
                # No confirmed vendor split.
                #
                # Keep payout on hold.
                # ------------------------------------------------

                if updated == 0:
                    for payout_row in payout_rows:
                        vendor_id = (
                            payout_row.get(
                                "cashfree_vendor_id"
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

        # ----------------------------------------------------
        # Other Cashfree BadRequestError
        # ----------------------------------------------------

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