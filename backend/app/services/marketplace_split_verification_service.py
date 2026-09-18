from __future__ import annotations

from typing import Any

from app.core.exceptions import NotFoundError
from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    get_split_and_settlement_details,
)


def verify_cashfree_split(
    payout_transaction_id: int,
) -> dict[str, Any]:
    """Fetch the authoritative Cashfree Easy Split state."""

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
            (payout_transaction_id,),
        )

        payout = cursor.fetchone()

        if not payout:
            raise NotFoundError(
                "Payout transaction not found"
            )

        cashfree_order_id = payout.get(
            "gateway_order_id"
        )

        if not cashfree_order_id:
            raise NotFoundError(
                "No successful Cashfree order is linked "
                "to this payout"
            )

        cashfree = get_split_and_settlement_details(
            cashfree_order_id
        )

        return {
            "success": True,
            "payout_transaction_id": payout_transaction_id,
            "order_id": payout["order_id"],
            "cashfree_order_id": cashfree_order_id,
            "local": {
                "status": payout.get("status"),
                "cashfree_vendor_id": (
                    payout.get("cashfree_vendor_id")
                ),
                "cashfree_split_status": (
                    payout.get("cashfree_split_status")
                ),
                "cashfree_settlement_id": (
                    payout.get("cashfree_settlement_id")
                ),
                "cashfree_transfer_id": (
                    payout.get("cashfree_transfer_id")
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
            "cashfree": cashfree,
        }

    finally:
        connection.close()