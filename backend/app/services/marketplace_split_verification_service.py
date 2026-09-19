from __future__ import annotations

from typing import Any

from app.core.exceptions import NotFoundError
from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    get_split_and_settlement_details,
    get_split_reconciliation,
)

CASHFREE_NO_SPLIT_REASON = (
    "Cashfree payment is processed, but no vendor split "
    "is confirmed by Cashfree reconciliation"
)


def _extract_cashfree_vendor_ids(
    reconciliation: Any,
) -> set[str]:
    """Extract vendor IDs actually reported by Cashfree."""

    if not isinstance(reconciliation, dict):
        return set()

    data = reconciliation.get("data")

    if not isinstance(data, list):
        return set()

    vendor_ids: set[str] = set()

    for item in data:
        if not isinstance(item, dict):
            continue

        entity_type = str(
            item.get("entity_type") or ""
        ).strip().lower()

        if entity_type == "vendor_commission":
            vendor_id = item.get("merchant_vendor_id")

            if vendor_id:
                vendor_ids.add(str(vendor_id))

        for key in (
            "merchant_vendor_id",
            "vendor_id",
        ):
            vendor_id = item.get(key)

            if vendor_id:
                vendor_ids.add(str(vendor_id))

        order_splits = item.get("order_splits")

        if not isinstance(order_splits, list):
            continue

        for split_group in order_splits:
            if not isinstance(split_group, dict):
                continue

            split_items = split_group.get("split")

            if not isinstance(split_items, list):
                continue

            for split_item in split_items:
                if not isinstance(split_item, dict):
                    continue

                for key in (
                    "merchant_vendor_id",
                    "vendor_id",
                ):
                    vendor_id = split_item.get(key)

                    if vendor_id:
                        vendor_ids.add(str(vendor_id))

    return vendor_ids


def _extract_settlement_vendor_ids(
    cashfree_settlement: Any,
) -> set[str]:
    """Extract vendor IDs from Cashfree settlement details."""

    if not isinstance(cashfree_settlement, dict):
        return set()

    settlement = cashfree_settlement.get("settlement")

    if not isinstance(settlement, dict):
        return set()

    vendors = settlement.get("vendors")

    if not isinstance(vendors, list):
        return set()

    vendor_ids: set[str] = set()

    for vendor in vendors:
        if not isinstance(vendor, dict):
            continue

        for key in (
            "merchant_vendor_id",
            "vendor_id",
        ):
            vendor_id = vendor.get(key)

            if vendor_id:
                vendor_ids.add(str(vendor_id))

    return vendor_ids


def _extract_vendor_settlement(
    reconciliation: Any,
    vendor_id: str | None,
) -> dict[str, Any] | None:
    """Extract the authoritative vendor settlement from Cashfree recon."""

    if not vendor_id or not isinstance(reconciliation, dict):
        return None

    data = reconciliation.get("data")

    if not isinstance(data, list):
        return None

    target_vendor = str(vendor_id)

    for item in data:
        if not isinstance(item, dict):
            continue

        item_vendor_id = (
            item.get("merchant_vendor_id")
            or item.get("vendor_id")
        )

        if str(item_vendor_id or "") != target_vendor:
            continue

        entity_type = str(
            item.get("entity_type") or ""
        ).strip().lower()

        if entity_type != "vendor_commission":
            continue

        settled = str(
            item.get("settled") or ""
        ).strip().upper()

        past_settlements = item.get("past_settlements")
        successful_past = None

        if isinstance(past_settlements, list):
            for settlement in reversed(past_settlements):
                if not isinstance(settlement, dict):
                    continue

                if (
                    str(
                        settlement.get("status") or ""
                    ).strip().upper()
                    == "SUCCESS"
                ):
                    successful_past = settlement
                    break

        if settled == "YES" or successful_past:
            return {
                "settled": True,
                "settlement_id": (
                    item.get("vendor_settlement_id")
                    or (
                        successful_past.get("settlement_id")
                        if successful_past
                        else None
                    )
                ),
                "utr": item.get("vendor_settlement_utr"),
                "settled_on": item.get("vendor_settlement_time"),
                "initiated_on": item.get(
                    "vendor_settlement_initiated_on"
                ),
                "eligibility_time": item.get(
                    "vendor_settlement_eligibility_time"
                ),
                "amount": (
                    item.get("vendor_commission")
                    or item.get("amount")
                ),
                "raw": item,
            }

    return None


def verify_cashfree_split(
    payout_transaction_id: int,
) -> dict[str, Any]:
    """Verify local payout state against authoritative Cashfree data.

    This endpoint is READ/RECONCILIATION only.

    It does not:
        - create a payment
        - create a split
        - create a transfer
        - reverse a transfer
        - create a refund
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
                pt.cashfree_settlement_utr,
                pt.cashfree_settlement_time,
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
            (payout_transaction_id,),
        )

        payout = cursor.fetchone()

        if not payout:
            raise NotFoundError("Payout transaction not found")

        cashfree_order_id = payout.get("gateway_order_id")

        if not cashfree_order_id:
            raise NotFoundError(
                "No successful Cashfree order is linked "
                "to this payout"
            )

        cashfree_settlement = get_split_and_settlement_details(
            cashfree_order_id
        )

        cashfree_reconciliation = get_split_reconciliation(
            cashfree_order_id
        )

        local_vendor_id = payout.get("cashfree_vendor_id")

        local_vendor_id_text = (
            str(local_vendor_id)
            if local_vendor_id
            else None
        )

        reconciliation_vendor_ids = _extract_cashfree_vendor_ids(
            cashfree_reconciliation
        )

        settlement_vendor_ids = _extract_settlement_vendor_ids(
            cashfree_settlement
        )

        settlement: dict[str, Any] = {}

        if isinstance(cashfree_settlement, dict):
            settlement = (
                cashfree_settlement.get("settlement")
                or {}
            )

        transfer_utr = settlement.get("transfer_utr")
        transfer_time = settlement.get("transfer_time")
        cf_settlement_id = settlement.get("cf_settlement_id")

        vendor_settlement = _extract_vendor_settlement(
            cashfree_reconciliation,
            local_vendor_id_text,
        )

        vendor_settlement_completed = bool(
            vendor_settlement
            and vendor_settlement.get("settled")
        )

        vendor_settlement_id = (
            vendor_settlement.get("settlement_id")
            if vendor_settlement
            else None
        )

        vendor_settlement_utr = (
            vendor_settlement.get("utr")
            if vendor_settlement
            else None
        )

        vendor_settlement_time = (
            vendor_settlement.get("settled_on")
            if vendor_settlement
            else None
        )

        reconciliation_confirms_vendor = (
            local_vendor_id_text is not None
            and local_vendor_id_text in reconciliation_vendor_ids
        )

        settlement_confirms_vendor = (
            local_vendor_id_text is not None
            and local_vendor_id_text in settlement_vendor_ids
        )

        cashfree_split_confirmed = (
            reconciliation_confirms_vendor
            or settlement_confirms_vendor
        )

        cashfree_transfer_completed = (
            vendor_settlement_completed
            or bool(transfer_utr or transfer_time)
        )

        if cashfree_split_confirmed:

            if cashfree_transfer_completed:
                local_status = "SETTLED"
            else:
                local_status = "TRANSFER_INITIATED"

            cursor.execute(
                """
                UPDATE marketplace_seller_payout_transactions
                SET
                    cashfree_split_status = 'CREATED',
                    status = %s,

                    cashfree_settlement_id =
                        COALESCE(
                            %s,
                            %s,
                            cashfree_settlement_id
                        ),

                    cashfree_settlement_utr =
                        COALESCE(
                            %s,
                            cashfree_settlement_utr
                        ),

                    cashfree_settlement_time =
                        COALESCE(
                            %s,
                            cashfree_settlement_time
                        ),

                    settled_at =
                        CASE
                            WHEN %s = 'SETTLED'
                            THEN COALESCE(
                                settled_at,
                                CURRENT_TIMESTAMP
                            )
                            ELSE settled_at
                        END,

                    failure_reason = NULL

                WHERE id = %s
                """,
                (
                    local_status,
                    vendor_settlement_id,
                    cf_settlement_id,
                    vendor_settlement_utr,
                    vendor_settlement_time,
                    local_status,
                    payout_transaction_id,
                ),
            )

            connection.commit()

            payout["cashfree_split_status"] = "CREATED"
            payout["status"] = local_status

            payout["cashfree_settlement_id"] = (
                vendor_settlement_id
                or cf_settlement_id
                or payout.get("cashfree_settlement_id")
            )

            payout["cashfree_settlement_utr"] = (
                vendor_settlement_utr
            )

            payout["cashfree_settlement_time"] = (
                vendor_settlement_time
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
                """,
                (
                    CASHFREE_NO_SPLIT_REASON,
                    payout_transaction_id,
                ),
            )

            connection.commit()

            payout["cashfree_split_status"] = "PENDING"
            payout["status"] = "ON_HOLD"

        return {
            "success": True,
            "payout_transaction_id": payout_transaction_id,
            "order_id": payout["order_id"],
            "cashfree_order_id": cashfree_order_id,

            "cashfree_split_confirmed": cashfree_split_confirmed,
            "cashfree_vendor_confirmed": cashfree_split_confirmed,
            "cashfree_transfer_completed": cashfree_transfer_completed,

            "local": {
                "status": payout.get("status"),
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
                "cashfree_settlement_utr": payout.get(
                    "cashfree_settlement_utr"
                ),
                "cashfree_settlement_time": payout.get(
                    "cashfree_settlement_time"
                ),
                "gross_amount": float(
                    payout.get("gross_amount") or 0
                ),
                "platform_fee_amount": float(
                    payout.get("platform_fee_amount") or 0
                ),
                "seller_amount": float(
                    payout.get("seller_amount") or 0
                ),
            },

            "cashfree": {
                "settlement": cashfree_settlement,
                "reconciliation": cashfree_reconciliation,
                "reconciliation_vendor_ids": sorted(
                    reconciliation_vendor_ids
                ),
                "settlement_vendor_ids": sorted(
                    settlement_vendor_ids
                ),
                "reconciliation_confirms_vendor": (
                    reconciliation_confirms_vendor
                ),
                "settlement_confirms_vendor": (
                    settlement_confirms_vendor
                ),
                "transfer_utr": transfer_utr,
                "transfer_time": transfer_time,
                "cf_settlement_id": cf_settlement_id,

                "vendor_settlement": vendor_settlement,
                "vendor_settlement_completed": (
                    vendor_settlement_completed
                ),
                "vendor_settlement_id": vendor_settlement_id,
                "vendor_settlement_utr": vendor_settlement_utr,
                "vendor_settlement_time": vendor_settlement_time,
            },
        }

    finally:
        connection.close()
