from __future__ import annotations

from typing import Any

from app.core.exceptions import NotFoundError
from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    get_split_and_settlement_details,
    get_split_reconciliation,
)


def _extract_cashfree_vendor_ids(
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


def _extract_settlement_vendor_ids(
    cashfree_settlement: Any,
) -> set[str]:
    """Extract vendor IDs from Cashfree settlement details."""

    if not isinstance(
        cashfree_settlement,
        dict,
    ):
        return set()

    settlement = cashfree_settlement.get(
        "settlement"
    )

    if not isinstance(
        settlement,
        dict,
    ):
        return set()

    vendors = settlement.get(
        "vendors"
    )

    if not isinstance(
        vendors,
        list,
    ):
        return set()

    vendor_ids: set[str] = set()

    for vendor in vendors:
        if not isinstance(
            vendor,
            dict,
        ):
            continue

        for key in (
            "merchant_vendor_id",
            "vendor_id",
        ):
            vendor_id = vendor.get(
                key
            )

            if vendor_id:
                vendor_ids.add(
                    str(vendor_id)
                )

    return vendor_ids


def verify_cashfree_split(
    payout_transaction_id: int,
) -> dict[str, Any]:
    """Fetch and compare the local and Cashfree Easy Split state.

    This function is READ-ONLY.

    It does not create:
        - payments
        - splits
        - transfers
        - reversals
        - refunds
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                pt.id,
                pt.order_id,
                pt.seller_id,
                pt.gross_amount,
                pt.platform_fee_amount,
                pt.seller_amount,
                pt.status,
                pt.cashfree_vendor_id,
                pt.cashfree_split_status,
                pt.cashfree_settlement_id,
                pt.cashfree_transfer_id,
                mp.gateway_order_id

            FROM marketplace_seller_payout_transactions pt

            LEFT JOIN marketplace_payments mp
                ON mp.order_id = pt.order_id
               AND mp.gateway = 'CASHFREE'
               AND mp.status = 'PAID'

            WHERE pt.id = %s

            ORDER BY mp.id DESC

            LIMIT 1
            """,
            (
                payout_transaction_id,
            ),
        )

        payout = cursor.fetchone()

        if not payout:
            raise NotFoundError(
                "Payout transaction not found"
            )

        cashfree_order_id = (
            payout.get(
                "gateway_order_id"
            )
        )

        if not cashfree_order_id:
            raise NotFoundError(
                "No successful Cashfree order is linked "
                "to this payout"
            )

        # ========================================================
        # Cashfree order-level split/settlement
        # ========================================================

        cashfree_settlement = (
            get_split_and_settlement_details(
                cashfree_order_id
            )
        )

        # ========================================================
        # Cashfree vendor reconciliation
        # ========================================================

        cashfree_reconciliation = (
            get_split_reconciliation(
                cashfree_order_id
            )
        )

        # ========================================================
        # Local vendor
        # ========================================================

        local_vendor_id = (
            payout.get(
                "cashfree_vendor_id"
            )
        )

        local_vendor_id_text = (
            str(local_vendor_id)
            if local_vendor_id
            else None
        )

        # ========================================================
        # Cashfree vendor IDs
        # ========================================================

        reconciliation_vendor_ids = (
            _extract_cashfree_vendor_ids(
                cashfree_reconciliation
            )
        )

        settlement_vendor_ids = (
            _extract_settlement_vendor_ids(
                cashfree_settlement
            )
        )

        # ========================================================
        # AUTHORITATIVE SPLIT CONFIRMATION
        #
        # A local CREATED flag is NOT sufficient.
        #
        # Cashfree must return the vendor.
        # ========================================================

        reconciliation_confirms_vendor = (
            local_vendor_id_text is not None
            and local_vendor_id_text
            in reconciliation_vendor_ids
        )

        settlement_confirms_vendor = (
            local_vendor_id_text is not None
            and local_vendor_id_text
            in settlement_vendor_ids
        )

        cashfree_split_confirmed = (
            reconciliation_confirms_vendor
            or settlement_confirms_vendor
        )

        # ========================================================
        # Settlement-level information
        # ========================================================

        settlement = {}

        if isinstance(
            cashfree_settlement,
            dict,
        ):
            settlement = (
                cashfree_settlement.get(
                    "settlement"
                )
                or {}
            )

        transfer_utr = (
            settlement.get(
                "transfer_utr"
            )
        )

        transfer_time = (
            settlement.get(
                "transfer_time"
            )
        )

        cf_settlement_id = (
            settlement.get(
                "cf_settlement_id"
            )
        )

        # ========================================================
        # Return
        # ========================================================

        return {
            "success": True,

            "payout_transaction_id": (
                payout_transaction_id
            ),

            "order_id": payout[
                "order_id"
            ],

            "cashfree_order_id": (
                cashfree_order_id
            ),

            "cashfree_split_confirmed": (
                cashfree_split_confirmed
            ),

            "cashfree_vendor_confirmed": (
                cashfree_split_confirmed
            ),

            "local": {
                "status": payout.get(
                    "status"
                ),

                "cashfree_vendor_id": payout.get(
                    "cashfree_vendor_id"
                ),

                "cashfree_split_status": payout.get(
                    "cashfree_split_status"
                ),

                "cashfree_settlement_id": payout.get(
                    "cashfree_settlement_id"
                ),

                "cashfree_transfer_id": payout.get(
                    "cashfree_transfer_id"
                ),

                "gross_amount": float(
                    payout.get(
                        "gross_amount"
                    )
                    or 0
                ),

                "platform_fee_amount": float(
                    payout.get(
                        "platform_fee_amount"
                    )
                    or 0
                ),

                "seller_amount": float(
                    payout.get(
                        "seller_amount"
                    )
                    or 0
                ),
            },

            "cashfree": {
                "settlement": (
                    cashfree_settlement
                ),

                "reconciliation": (
                    cashfree_reconciliation
                ),

                "reconciliation_vendor_ids": (
                    sorted(
                        reconciliation_vendor_ids
                    )
                ),

                "settlement_vendor_ids": (
                    sorted(
                        settlement_vendor_ids
                    )
                ),

                "transfer_utr": (
                    transfer_utr
                ),

                "transfer_time": (
                    transfer_time
                ),

                "cf_settlement_id": (
                    cf_settlement_id
                ),
            },
        }

    finally:
        connection.close()