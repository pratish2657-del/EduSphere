from __future__ import annotations

import json
import uuid
from typing import Any

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection
from app.services.cashfree_easy_split_service import (
    create_refund,
    create_vendor,
    get_split_and_settlement_details,
    get_vendor,
)
from app.services.marketplace_inventory_service import (
    restore_order_inventory,
)
from app.services.marketplace_payout_service import (
    attempt_cashfree_split,
)

# ============================================================
# CASHFREE RECONCILIATION HOLD
# ============================================================

CASHFREE_RECON_HOLD_PREFIX = (
    "Cashfree payment is processed"
)


# ============================================================
# SELLER ONBOARDING
# ============================================================


def get_route_onboarding(
    user_id: int,
) -> dict[str, Any]:
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                user_id,
                enabled,
                payout_status,
                cashfree_vendor_id,
                cashfree_vendor_status,
                cashfree_schedule_option,
                bank_account_last4,
                bank_ifsc,
                cashfree_vendor_error,
                payout_verified_at

            FROM marketplace_seller_payouts

            WHERE user_id = %s

            LIMIT 1
            """,
            (user_id,),
        )

        row = cursor.fetchone()

        if not row:
            return {
                "user_id": user_id,
                "payout_status": "NOT_CONFIGURED",
                "cashfree_vendor_id": None,
            }

        return row

    finally:
        connection.close()


def refresh_route_status(
    user_id: int,
) -> dict[str, Any]:
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                cashfree_vendor_id

            FROM marketplace_seller_payouts

            WHERE user_id = %s

            LIMIT 1
            """,
            (user_id,),
        )

        row = cursor.fetchone()

        if (
            not row
            or not row.get(
                "cashfree_vendor_id"
            )
        ):
            return get_route_onboarding(
                user_id
            )

        vendor = get_vendor(
            row["cashfree_vendor_id"]
        )

        status = str(
            vendor.get("status")
            or ""
        ).upper()

        payout_status = (
            "VERIFIED"
            if status == "ACTIVE"
            else (
                "REJECTED"
                if status in {
                    "BLOCKED",
                    "DELETED",
                }
                else "PENDING_VERIFICATION"
            )
        )

        cursor.execute(
            """
            UPDATE marketplace_seller_payouts

            SET
                payout_status = %s,
                cashfree_vendor_status = %s,
                cashfree_vendor_error = NULL,

                payout_verified_at =
                    CASE
                        WHEN %s = 'VERIFIED'
                        THEN COALESCE(
                            payout_verified_at,
                            CURRENT_TIMESTAMP
                        )
                        ELSE payout_verified_at
                    END,

                updated_at = CURRENT_TIMESTAMP

            WHERE user_id = %s
            """,
            (
                payout_status,
                status,
                payout_status,
                user_id,
            ),
        )

        connection.commit()

        return get_route_onboarding(
            user_id
        )

    except Exception as exc:
        connection.rollback()

        raise BadRequestError(
            str(exc)
        ) from exc

    finally:
        connection.close()


def submit_route_onboarding(
    user_id: int,
    data,
) -> dict[str, Any]:
    if not data.accept_terms:
        raise BadRequestError(
            "You must accept the Cashfree Easy Split "
            "seller terms before onboarding"
        )

    phone = "".join(
        ch
        for ch in data.phone
        if ch.isdigit()
    )

    if not phone:
        raise BadRequestError(
            "A valid phone number is required"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ========================================================
        # USER
        # ========================================================

        cursor.execute(
            """
            SELECT
                email,
                full_name

            FROM users

            WHERE id = %s

            LIMIT 1
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise NotFoundError(
                "Seller account not found"
            )

        # ========================================================
        # EXISTING PAYOUT PROFILE
        # ========================================================

        cursor.execute(
            """
            SELECT
                cashfree_vendor_id,
                payout_status

            FROM marketplace_seller_payouts

            WHERE user_id = %s

            LIMIT 1
            """,
            (user_id,),
        )

        existing = cursor.fetchone()

        if (
            existing
            and existing.get(
                "cashfree_vendor_id"
            )
        ):
            raise ConflictError(
                "Cashfree Easy Split onboarding "
                "already exists. Refresh verification "
                "status instead."
            )

        # ========================================================
        # CASHFREE VENDOR
        # ========================================================

        vendor_id = (
            f"edusphere_seller_{user_id}"
        )

        email = (
            data.stakeholder_email
            or user["email"]
        )

        vendor = create_vendor(
            vendor_id=vendor_id,
            name=(
                data.customer_facing_business_name
                or data.legal_business_name
            ),
            email=email,
            phone=phone,
            bank_account_number=(
                data.bank_account_number
            ),
            ifsc=data.ifsc_code,
            account_holder=(
                data.beneficiary_name
            ),
            schedule_option=1,
            verify_account=True,
        )

        vendor_status = str(
            vendor.get("status")
            or "IN_BENE_CREATION"
        ).upper()

        payout_status = (
            "VERIFIED"
            if vendor_status == "ACTIVE"
            else "PENDING_VERIFICATION"
        )

        # ========================================================
        # SAVE SELLER PAYOUT PROFILE
        # ========================================================

        cursor.execute(
            """
            INSERT INTO marketplace_seller_payouts
                (
                    user_id,
                    enabled,
                    payout_status,
                    cashfree_vendor_id,
                    cashfree_vendor_status,
                    cashfree_schedule_option,
                    bank_account_last4,
                    bank_ifsc,
                    cashfree_vendor_error,
                    payout_verified_at
                )

            VALUES
                (
                    %s,
                    TRUE,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    NULL,
                    CASE
                        WHEN %s = 'VERIFIED'
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END
                )

            ON DUPLICATE KEY UPDATE
                enabled = TRUE,

                payout_status =
                    VALUES(payout_status),

                cashfree_vendor_id =
                    VALUES(cashfree_vendor_id),

                cashfree_vendor_status =
                    VALUES(cashfree_vendor_status),

                cashfree_schedule_option =
                    VALUES(cashfree_schedule_option),

                bank_account_last4 =
                    VALUES(bank_account_last4),

                bank_ifsc =
                    VALUES(bank_ifsc),

                cashfree_vendor_error = NULL,

                updated_at =
                    CURRENT_TIMESTAMP
            """,
            (
                user_id,
                payout_status,
                vendor_id,
                vendor_status,
                1,
                data.bank_account_number[-4:],
                data.ifsc_code.upper().strip(),
                payout_status,
            ),
        )

        connection.commit()

        return get_route_onboarding(
            user_id
        )

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# RETRY PAYOUT
# ============================================================


def retry_payout(
    payout_transaction_id: int,
    actor_user_id: int,
) -> dict[str, Any]:
    del actor_user_id

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                order_id,
                status,
                cashfree_split_status,
                failure_reason

            FROM marketplace_seller_payout_transactions

            WHERE id = %s

            LIMIT 1
            """,
            (payout_transaction_id,),
        )

        row = cursor.fetchone()

        if not row:
            raise NotFoundError(
                "Payout transaction not found"
            )

        # ========================================================
        # CASHFREE RECONCILIATION HOLD
        #
        # IMPORTANT:
        #
        # Cashfree said the payment was already processed,
        # but reconciliation did not confirm the vendor split.
        #
        # NEVER send another Easy Split POST automatically.
        # ========================================================

        failure_reason = str(
            row.get(
                "failure_reason"
            )
            or ""
        )

        if failure_reason.startswith(
            CASHFREE_RECON_HOLD_PREFIX
        ):
            return {
                "success": False,

                "payout_transaction_id": (
                    payout_transaction_id
                ),

                "result": {
                    "already_processed": True,

                    "cashfree_split_confirmed": False,

                    "reconciled": False,

                    "cashfree_order_id": None,

                    "reason": (
                        "This payout is on hold because "
                        "Cashfree reported the payment as "
                        "already processed but did not confirm "
                        "the vendor split. Use Verify Cashfree."
                    ),
                },
            }

        # ========================================================
        # LOCAL CREATED STATE
        #
        # Do not retry an already confirmed split.
        # ========================================================

        if (
            str(
                row.get(
                    "cashfree_split_status"
                )
                or ""
            ).upper()
            == "CREATED"
        ):
            return {
                "success": True,

                "payout_transaction_id": (
                    payout_transaction_id
                ),

                "result": {
                    "already_processed": True,

                    "cashfree_split_confirmed": True,

                    "reconciled": True,

                    "reason": (
                        "Cashfree Easy Split is already "
                        "confirmed for this payout."
                    ),
                },
            }

        # ========================================================
        # NORMAL CASHFREE SPLIT ATTEMPT
        # ========================================================

        result = attempt_cashfree_split(
            row["order_id"]
        )

        return {
            "success": bool(
                result.get(
                    "success"
                )
            ),

            "payout_transaction_id": (
                payout_transaction_id
            ),

            "result": result,
        }

    finally:
        connection.close()


# ============================================================
# REFUNDS
# ============================================================


def list_refunds() -> list[dict[str, Any]]:
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                r.id,
                r.order_id,
                r.payment_id,
                r.buyer_id,
                u.full_name AS buyer_name,
                u.email AS buyer_email,
                r.amount,
                r.reverse_transfers,
                r.cashfree_refund_id,
                r.status,
                r.failure_reason,
                r.created_at,
                r.processed_at

            FROM marketplace_refunds r

            JOIN users u
                ON u.id = r.buyer_id

            ORDER BY r.created_at DESC

            LIMIT 1000
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# PAYOUT LIST
# ============================================================


def list_payouts(
    actor_user_id: int,
) -> list[dict[str, Any]]:
    del actor_user_id

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                pt.id,
                pt.order_id,
                pt.seller_id,

                u.full_name AS seller_name,
                u.email AS seller_email,

                pt.gross_amount,
                pt.platform_fee_amount,
                pt.seller_amount,
                pt.status,

                pt.cashfree_vendor_id,
                pt.cashfree_split_status,
                pt.cashfree_settlement_id,
                pt.cashfree_transfer_id,

                pt.failure_reason,
                pt.created_at,
                pt.settled_at,

                sp.payout_status,
                sp.cashfree_vendor_status,

                CASE

                    /* =================================================
                       CONFIRMED CASHFREE SPLIT

                       Post-settlement adjustment is allowed only
                       when the local split is actually marked CREATED.

                       This prevents an ON_HOLD / stale payout from
                       showing a Reverse button.
                       ================================================= */

                    WHEN pt.status = 'SETTLED'

                    AND pt.cashfree_split_status = 'CREATED'

                    AND NOT EXISTS (
                        SELECT 1
                        FROM marketplace_payout_reversals r
                        WHERE r.payout_transaction_id = pt.id
                          AND r.cashfree_refund_id IS NOT NULL
                          AND r.status IN ('PENDING', 'PROCESSED')
                    )

                    THEN 'REVERSE'


                    /* =================================================
                       CASHFREE RECONCILIATION HOLD

                       Cashfree payment is processed but no vendor
                       split has been confirmed.

                       Only verification is allowed.
                       ================================================= */

                    WHEN pt.status = 'ON_HOLD'

                     AND pt.failure_reason LIKE
                         'Cashfree payment is processed%'

                    THEN 'VERIFY'


                    /* =================================================
                       NORMAL RETRY

                       These payouts can attempt Easy Split.
                       ================================================= */

                    WHEN sp.payout_status = 'VERIFIED'

                     AND pt.status IN (
                         'PENDING',
                         'READY',
                         'FAILED'
                     )

                    THEN 'RETRY'


                    /* =================================================
                       SELLER ONBOARDING REQUIRED
                       ================================================= */

                    WHEN sp.payout_status IS NULL

                      OR sp.payout_status <> 'VERIFIED'

                    THEN 'SELLER_ONBOARDING_REQUIRED'


                    /* =================================================
                       DEFAULT
                       ================================================= */

                    ELSE 'WAITING'

                END AS action

            FROM marketplace_seller_payout_transactions pt

            JOIN users u
                ON u.id = pt.seller_id

            LEFT JOIN marketplace_seller_payouts sp
                ON sp.user_id = pt.seller_id

            ORDER BY pt.created_at DESC

            LIMIT 1000
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# REVERSE PAYOUT
# ============================================================


def reverse_payout(
    payout_transaction_id: int,
    created_by: int,
    amount: float | None = None,
    reason: str | None = None,
):
    """
    Create a post-settlement vendor adjustment by initiating a
    Cashfree customer refund with a split directed only to the
    target vendor.

    The original payout remains SETTLED. The Easy Split transfer
    endpoint is intentionally not used here because a VENDOR
    transfer sends vendor-ledger funds to the vendor bank account;
    it is not a reversal back to the merchant.
    """
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT *
            FROM marketplace_seller_payout_transactions
            WHERE id = %s
            """,
            (payout_transaction_id,),
        )

        payout = cursor.fetchone()

        if not payout:
            raise NotFoundError(
                "Payout transaction not found"
            )

        vendor_id = payout.get("cashfree_vendor_id")

        if not vendor_id:
            raise BadRequestError(
                "This payout has no Cashfree Easy Split vendor"
            )

        if payout.get("cashfree_split_status") != "CREATED":
            raise BadRequestError(
                "Cashfree Easy Split has not been confirmed for this payout"
            )

        if payout.get("status") != "SETTLED":
            raise BadRequestError(
                "Only settled payouts can be adjusted"
            )

        requested = round(
            (
                amount
                if amount is not None
                else float(payout["seller_amount"])
            ),
            2,
        )

        seller_amount = round(
            float(payout["seller_amount"] or 0),
            2,
        )

        if requested < 1:
            raise BadRequestError(
                "Reversal amount must be at least ₹1"
            )

        if requested > seller_amount + 0.0001:
            raise BadRequestError(
                "Reversal amount cannot exceed the seller payout amount"
            )

        cursor.execute(
            """
            SELECT id
            FROM marketplace_payments
            WHERE order_id = %s
              AND status = 'PAID'
            ORDER BY id DESC
            LIMIT 1
            """,
            (payout["order_id"],),
        )

        payment = cursor.fetchone()

        if not payment:
            raise BadRequestError(
                "The marketplace payment is not refundable for this payout"
            )

        # Only refund-backed reversal records participate in duplicate
        # protection. The old transfer-based row from the previous
        # implementation is historical and is not a refund adjustment.
        cursor.execute(
            """
            SELECT
                id,
                status,
                cashfree_refund_id
            FROM marketplace_payout_reversals
            WHERE payout_transaction_id = %s
              AND cashfree_refund_id IS NOT NULL
              AND status IN ('PENDING', 'PROCESSED')
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (payout_transaction_id,),
        )

        active_reversal = cursor.fetchone()

        if active_reversal:
            raise ConflictError(
                "A payout adjustment has already been submitted for this payout"
            )

        result = refund_payment(
            payment_db_id=int(payment["id"]),
            created_by=created_by,
            amount=requested,
            reverse_all=True,
            reason=(
                reason
                or "EduSphere marketplace settled payout adjustment"
            ),
            target_vendor_id=str(vendor_id),
        )

        refund_id = result.get("refund_id")
        refund_db_id = result.get("refund_db_id")

        if not refund_id or not refund_db_id:
            raise BadRequestError(
                "Cashfree refund adjustment did not return a refund ID"
            )

        adjustment_status = str(
            result.get("refund_status") or "PENDING"
        ).upper()

        if adjustment_status == "SUCCESS":
            adjustment_status = "PROCESSED"

        if adjustment_status not in {"PROCESSED", "PENDING", "FAILED"}:
            adjustment_status = "PENDING"

        cursor.execute(
            """
            INSERT INTO marketplace_payout_reversals
                (
                    payout_transaction_id,
                    amount,
                    cashfree_refund_id,
                    cashfree_reversal_status,
                    status,
                    created_by,
                    processed_at
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    CASE
                        WHEN %s = 'PROCESSED'
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END
                )
            """,
            (
                payout_transaction_id,
                requested,
                str(refund_id),
                adjustment_status,
                adjustment_status,
                created_by,
                adjustment_status,
            ),
        )

        connection.commit()

        return {
            "success": True,
            "refund_id": str(refund_id),
            "refund_db_id": int(refund_db_id),
            "amount": requested,
            "reversal_status": adjustment_status,
            "payout_status": (
                "REFUNDED"
                if result.get("fully_refunded")
                else "SETTLED"
            ),
            "adjustment_type": "CASHFREE_REFUND_SPLIT",
            "refund_splits": result.get("refund_splits") or [],
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

# ============================================================
# CANCEL MARKETPLACE ORDER
# ============================================================


def cancel_marketplace_order(
    order_id: int,
    admin_user_id: int,
    reason: str | None = None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                o.id AS order_id,
                o.buyer_id,
                o.institution_id,
                o.status AS order_status,

                mp.id AS payment_id,
                mp.payment_method,
                mp.status AS payment_status

            FROM marketplace_orders o

            LEFT JOIN marketplace_payments mp
                ON mp.order_id = o.id

            WHERE o.id = %s

            FOR UPDATE
            """,
            (order_id,),
        )

        order = cursor.fetchone()

        if not order:
            raise NotFoundError(
                "Marketplace order not found"
            )

        # ========================================================
        # ADMIN ROLE
        # ========================================================

        cursor.execute(
            """
            SELECT role

            FROM users

            WHERE id = %s

            LIMIT 1
            """,
            (admin_user_id,),
        )

        admin = cursor.fetchone()

        role = str(
            (admin or {}).get(
                "role"
            )
            or ""
        ).upper()

        if role not in {
            "ADMIN",
            "SUPER_ADMIN",
        }:
            raise BadRequestError(
                "Administrator access is required"
            )

        # ========================================================
        # INSTITUTION CHECK
        # ========================================================

        if role == "ADMIN":
            cursor.execute(
                """
                SELECT 1

                FROM admin_profiles

                WHERE user_id = %s
                  AND institution_id = %s

                LIMIT 1
                """,
                (
                    admin_user_id,
                    order["institution_id"],
                ),
            )

            if not cursor.fetchone():
                raise BadRequestError(
                    "You cannot cancel an order "
                    "outside your institution"
                )

        # ========================================================
        # ALREADY REFUNDED
        # ========================================================

        if str(
            order["order_status"]
            or ""
        ).upper() == "REFUNDED":
            raise BadRequestError(
                "A refunded order cannot be cancelled"
            )

        # ========================================================
        # PAID ORDERS MUST USE REFUND
        # ========================================================

        if (
            order["payment_id"] is not None
            and str(
                order["payment_status"]
                or ""
            ).upper()
            == "PAID"
        ):
            raise BadRequestError(
                "This order has already been paid. "
                "Use the refund workflow instead "
                "of cancellation."
            )

        # ========================================================
        # RESTORE INVENTORY
        # ========================================================

        restore_order_inventory(
            order_id,
            cursor,
        )

        # ========================================================
        # CANCEL PAYMENT
        # ========================================================

        if order["payment_id"] is not None:
            cursor.execute(
                """
                UPDATE marketplace_payments

                SET
                    status = 'CANCELLED',
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = %s
                  AND status = 'PENDING'
                """,
                (
                    order["payment_id"],
                ),
            )

        # ========================================================
        # CANCEL PAYOUT RECORDS
        # ========================================================

        cursor.execute(
            """
            UPDATE marketplace_seller_payout_transactions

            SET
                status = 'REFUNDED',
                failure_reason = %s,
                updated_at = CURRENT_TIMESTAMP

            WHERE order_id = %s

              AND status IN (
                  'PENDING',
                  'READY',
                  'ON_HOLD'
              )
            """,
            (
                reason
                or "Order cancelled before payment collection",
                order_id,
            ),
        )

        # ========================================================
        # CANCEL ORDER
        # ========================================================

        cursor.execute(
            """
            UPDATE marketplace_orders

            SET
                status = 'CANCELLED',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = %s

              AND status NOT IN (
                  'CANCELLED',
                  'REFUNDED'
              )
            """,
            (
                order_id,
            ),
        )

        connection.commit()

        return {
            "message": (
                "Marketplace order cancelled successfully"
            ),

            "order_id": order_id,

            "status": "CANCELLED",

            "payment_status": (
                "CANCELLED"
                if order["payment_id"] is not None
                else None
            ),
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# REFUND FINALIZATION / CASHFREE RECONCILIATION
# ============================================================

def _cashfree_refund_id_variants(value: Any) -> list[str]:
    """
    Return equivalent Cashfree refund-ID representations.

    Cashfree responses can expose the same refund as, for example:
    1319877536 and refund_1319877536. Treat those as one provider
    refund so reconciliation cannot create a duplicate local refund.
    """
    if value is None:
        return []

    raw = str(value).strip()

    if not raw:
        return []

    variants = [raw]

    if raw.startswith("refund_"):
        base = raw[len("refund_"):]
        if base:
            variants.append(base)
    else:
        variants.append(f"refund_{raw}")

    return list(dict.fromkeys(variants))



def _finalize_fully_refunded_payment(
    cursor,
    payment: dict[str, Any],
    refund_db_id: int | None = None,
) -> None:
    """
    Apply the local state changes that belong to a fully processed
    marketplace refund.

    This helper is deliberately idempotent. Inventory is restored only
    when the local refund row has not already been marked as restored.
    That makes it safe to call after Cashfree reconciliation as well as
    after a normal refund response/webhook.
    """

    if refund_db_id is not None:
        cursor.execute(
            """
            SELECT inventory_restored
            FROM marketplace_refunds
            WHERE id = %s
            LIMIT 1
            """,
            (refund_db_id,),
        )
        refund_row = cursor.fetchone()

        inventory_restored = bool(
            refund_row
            and refund_row.get("inventory_restored")
        )
    else:
        inventory_restored = False

    if not inventory_restored:
        restore_order_inventory(
            payment["order_id"],
            cursor,
        )

        if refund_db_id is not None:
            cursor.execute(
                """
                UPDATE marketplace_refunds
                SET
                    inventory_restored = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                  AND inventory_restored = FALSE
                """,
                (refund_db_id,),
            )

    cursor.execute(
        """
        UPDATE marketplace_payments
        SET
            status = 'REFUNDED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
          AND status = 'PAID'
        """,
        (payment["id"],),
    )

    cursor.execute(
        """
        UPDATE marketplace_seller_payout_transactions
        SET
            status = 'REFUNDED',
            failure_reason = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = %s
          AND status <> 'REVERSED'
        """,
        (
            "Marketplace refund fully processed",
            payment["order_id"],
        ),
    )

    cursor.execute(
        """
        UPDATE marketplace_orders
        SET
            status = 'REFUNDED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
          AND status NOT IN ('CANCELLED', 'REFUNDED')
        """,
        (payment["order_id"],),
    )


def _reconcile_cashfree_refunds(
    cursor,
    payment: dict[str, Any],
    created_by: int,
) -> dict[str, Any]:
    """
    Reconcile refunds that Cashfree has already processed but that
    may not yet exist, or may still be pending, in marketplace_refunds.

    This is a fail-closed preflight check: if Cashfree cannot confirm
    the current refund history, no new refund is submitted.
    """

    cashfree_order_id = payment.get("gateway_order_id")

    if not cashfree_order_id:
        raise BadRequestError(
            "This payment has no Cashfree gateway order ID"
        )

    try:
        details = get_split_and_settlement_details(
            str(cashfree_order_id)
        )
    except Exception as exc:
        raise BadRequestError(
            "Unable to verify existing Cashfree refunds. "
            "The refund was NOT submitted. "
            f"Cashfree verification error: {exc}"
        ) from exc

    if not isinstance(details, dict):
        raise BadRequestError(
            "Cashfree returned an invalid refund verification response. "
            "The refund was NOT submitted."
        )

    cashfree_refunds = details.get("refunds") or []

    if not isinstance(cashfree_refunds, list):
        cashfree_refunds = []

    reconciled_refund_ids: list[str] = []

    for external_refund in cashfree_refunds:
        if not isinstance(external_refund, dict):
            continue

        gateway_status = str(
            external_refund.get("refund_status")
            or ""
        ).upper()

        if gateway_status not in {
            "SUCCESS",
            "PROCESSED",
        }:
            continue

        provider_refund_id = external_refund.get(
            "cf_refund_id"
        )
        merchant_refund_id = external_refund.get(
            "refund_id"
        )

        if not provider_refund_id and not merchant_refund_id:
            continue

        refund_amount = round(
            float(external_refund.get("refund_amount") or 0),
            2,
        )

        if refund_amount <= 0:
            continue

        provider_refund_id = (
            str(provider_refund_id)
            if provider_refund_id
            else None
        )
        merchant_refund_id = (
            str(merchant_refund_id)
            if merchant_refund_id
            else None
        )

        refund_identifier = (
            provider_refund_id
            or merchant_refund_id
        )

        refund_arn = external_refund.get(
            "refund_arn"
        )

        refund_splits = (
            external_refund.get("refund_splits")
            or []
        )

        # The schema has one Cashfree refund-ID column. Cashfree can
        # represent the same refund as both:
        #
        #     1319877536
        #     refund_1319877536
        #
        # Match both representations and prefer an existing PENDING
        # local row over an already-PROCESSED duplicate. This prevents
        # reconciliation from creating a second local refund record.
        provider_id_variants = _cashfree_refund_id_variants(
            provider_refund_id
        )
        merchant_id_variants = _cashfree_refund_id_variants(
            merchant_refund_id
        )

        refund_id_variants = list(
            dict.fromkeys(
                provider_id_variants
                + merchant_id_variants
            )
        )

        if refund_id_variants:
            placeholders = ", ".join(
                ["%s"] * len(refund_id_variants)
            )

            cursor.execute(
                f"""
                SELECT
                    id,
                    status,
                    inventory_restored,
                    cashfree_refund_id
                FROM marketplace_refunds
                WHERE payment_id = %s
                  AND cashfree_refund_id IN ({placeholders})
                ORDER BY
                    CASE
                        WHEN status = 'PENDING' THEN 0
                        WHEN status = 'FAILED' THEN 1
                        WHEN status = 'PROCESSED' THEN 2
                        ELSE 3
                    END,
                    id ASC
                LIMIT 1
                FOR UPDATE
                """,
                [payment["id"], *refund_id_variants],
            )

            local_refund = cursor.fetchone()
        else:
            local_refund = None

        if local_refund:
            # The database has a UNIQUE constraint on cashfree_refund_id.
            # Therefore duplicates must be removed BEFORE changing the
            # selected local row to the canonical Cashfree refund ID.
            # Otherwise updating #9 from `1319877536` to
            # `refund_1319877536` collides with duplicate row #10.
            #
            # Cashfree may represent the same refund as both IDs; they are
            # one provider refund, not two refunds. Keep the row selected
            # for reconciliation and remove other equivalent local rows.
            if refund_id_variants:
                placeholders = ", ".join(
                    ["%s"] * len(refund_id_variants)
                )

                cursor.execute(
                    f"""
                    DELETE FROM marketplace_refunds
                    WHERE payment_id = %s
                      AND id <> %s
                      AND ABS(amount - %s) < 0.0001
                      AND cashfree_refund_id IN ({placeholders})
                    """,
                    [
                        payment["id"],
                        local_refund["id"],
                        refund_amount,
                        *refund_id_variants,
                    ],
                )

            # Now it is safe to assign the canonical Cashfree refund ID.
            cursor.execute(
                """
                UPDATE marketplace_refunds
                SET
                    amount = %s,
                    cashfree_refund_id = %s,
                    cashfree_refund_arn = %s,
                    cashfree_refund_splits = %s,
                    status = 'PROCESSED',
                    failure_reason = NULL,
                    processed_at = COALESCE(
                        processed_at,
                        CURRENT_TIMESTAMP
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (
                    refund_amount,
                    refund_identifier,
                    refund_arn,
                    json.dumps(refund_splits),
                    local_refund["id"],
                ),
            )

            reconciled_refund_ids.append(
                refund_identifier
            )
            continue

        cursor.execute(
            """
            INSERT INTO marketplace_refunds
                (
                    order_id,
                    payment_id,
                    buyer_id,
                    amount,
                    reverse_transfers,
                    cashfree_refund_id,
                    cashfree_refund_arn,
                    cashfree_refund_splits,
                    status,
                    created_by,
                    processed_at
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'PROCESSED',
                    %s,
                    CURRENT_TIMESTAMP
                )
            """,
            (
                payment["order_id"],
                payment["id"],
                payment["buyer_id"],
                refund_amount,
                bool(refund_splits),
                refund_identifier,
                refund_arn,
                json.dumps(refund_splits),
                created_by,
            ),
        )

        reconciled_refund_ids.append(
            refund_identifier
        )

    cursor.execute(
        """
        SELECT
            COALESCE(SUM(amount), 0) AS refunded
        FROM marketplace_refunds
        WHERE payment_id = %s
          AND status = 'PROCESSED'
        """,
        (payment["id"],),
    )

    total_refunded = float(
        cursor.fetchone()["refunded"] or 0
    )

    fully_refunded = (
        total_refunded
        >= float(payment["amount"]) - 0.0001
    )

    if fully_refunded:
        # Prefer the newest processed local refund row for the
        # inventory-restored marker. If none exists, finalization
        # still remains idempotent at the payment/order level.
        cursor.execute(
            """
            SELECT id
            FROM marketplace_refunds
            WHERE payment_id = %s
              AND status = 'PROCESSED'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (payment["id"],),
        )
        latest_refund = cursor.fetchone()

        _finalize_fully_refunded_payment(
            cursor,
            payment,
            latest_refund["id"]
            if latest_refund
            else None,
        )

    return {
        "total_refunded": total_refunded,
        "fully_refunded": fully_refunded,
        "reconciled_refund_ids": reconciled_refund_ids,
    }


def reconcile_cashfree_refund(
    refund_db_id: int,
    created_by: int,
) -> dict[str, Any]:
    """
    Reconcile one local marketplace refund with Cashfree.

    This operation is READ/RECONCILE only:
    it never creates a new Cashfree refund.

    It is safe to call for a PENDING or FAILED local refund when
    Cashfree may already have processed the refund.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ========================================================
        # LOAD LOCAL REFUND + PAYMENT
        # ========================================================

        cursor.execute(
            """
            SELECT
                r.id,
                r.payment_id,
                r.status AS refund_status,
                r.cashfree_refund_id,
                p.status AS payment_status,
                p.gateway,
                p.gateway_order_id
            FROM marketplace_refunds r
            INNER JOIN marketplace_payments p
                ON p.id = r.payment_id
            WHERE r.id = %s
            FOR UPDATE
            """,
            (refund_db_id,),
        )

        refund = cursor.fetchone()

        if not refund:
            raise NotFoundError(
                "Marketplace refund not found"
            )

        gateway = str(
            refund.get("gateway") or ""
        ).upper()

        if gateway != "CASHFREE":
            raise BadRequestError(
                "Only Cashfree marketplace refunds can be reconciled"
            )

        if not refund.get("gateway_order_id"):
            raise BadRequestError(
                "This payment has no Cashfree gateway order ID"
            )

        # ========================================================
        # LOAD THE COMPLETE PAYMENT ROW
        #
        # _reconcile_cashfree_refunds() also performs the required
        # payment/order/inventory finalization when the payment is
        # fully refunded.
        # ========================================================

        cursor.execute(
            """
            SELECT *
            FROM marketplace_payments
            WHERE id = %s
            FOR UPDATE
            """,
            (refund["payment_id"],),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "Marketplace payment not found"
            )

        reconciliation = _reconcile_cashfree_refunds(
            cursor,
            payment,
            created_by,
        )

        reconciled_ids = (
            reconciliation.get(
                "reconciled_refund_ids"
            )
            or []
        )

        # ========================================================
        # READ THE LOCAL REFUND AFTER RECONCILIATION
        # ========================================================

        cursor.execute(
            """
            SELECT
                id,
                amount,
                status,
                cashfree_refund_id,
                cashfree_refund_arn,
                cashfree_refund_splits,
                failure_reason,
                inventory_restored,
                processed_at
            FROM marketplace_refunds
            WHERE id = %s
            LIMIT 1
            """,
            (refund_db_id,),
        )

        updated_refund = cursor.fetchone()

        connection.commit()

        return {
            "success": True,
            "reconciled": bool(
                refund_db_id
                and (
                    str(
                        updated_refund.get(
                            "cashfree_refund_id"
                        )
                        or ""
                    )
                    in {
                        str(value)
                        for value in reconciled_ids
                    }
                    if updated_refund
                    else False
                )
            ),
            "refund_db_id": refund_db_id,
            "refund_id": (
                updated_refund.get(
                    "cashfree_refund_id"
                )
                if updated_refund
                else None
            ),
            "status": (
                updated_refund.get("status")
                if updated_refund
                else None
            ),
            "amount": (
                float(updated_refund["amount"])
                if updated_refund
                and updated_refund.get("amount") is not None
                else None
            ),
            "refund_arn": (
                updated_refund.get(
                    "cashfree_refund_arn"
                )
                if updated_refund
                else None
            ),
            "fully_refunded": bool(
                reconciliation.get("fully_refunded")
            ),
            "total_refunded": float(
                reconciliation.get("total_refunded") or 0
            ),
            "cashfree_order_id": payment.get(
                "gateway_order_id"
            ),
            "message": (
                "Cashfree refund reconciled successfully."
                if updated_refund
                and updated_refund.get("status") == "PROCESSED"
                else (
                    "No processed Cashfree refund was found "
                    "for this local refund yet."
                )
            ),
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# REFUND PAYMENT
# ============================================================


def refund_payment(
    payment_db_id: int,
    created_by: int,
    amount: float | None = None,
    reverse_all: bool = True,
    reason: str | None = None,
    target_vendor_id: str | None = None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ========================================================
        # PAYMENT
        # ========================================================

        cursor.execute(
            """
            SELECT *
            FROM marketplace_payments
            WHERE id = %s
            FOR UPDATE
            """,
            (payment_db_id,),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "Marketplace payment not found"
            )

        if payment.get("status") != "PAID":
            raise BadRequestError(
                "Only paid marketplace payments can be refunded"
            )

        # ========================================================
        # PAYMENT METHOD / AMOUNT
        # ========================================================

        is_cod = (
            str(payment.get("payment_method") or "").upper()
            == "COD"
        )

        refund_amount = float(
            payment["amount"]
            if amount is None
            else amount
        )

        if refund_amount < 1:
            raise BadRequestError(
                "Refund amount must be at least ₹1"
            )

        if (
            is_cod
            and abs(
                refund_amount - float(payment["amount"])
            ) > 0.0001
        ):
            raise BadRequestError(
                "COD refunds must refund the full collected amount"
            )

        # ========================================================
        # CASHFREE PREFLIGHT RECONCILIATION
        #
        # Cashfree can already contain a successful refund even when
        # the local request previously failed/timed out. Always verify
        # Cashfree before creating another online refund.
        # ========================================================

        reconciliation = None

        if not is_cod:
            reconciliation = _reconcile_cashfree_refunds(
                cursor,
                payment,
                created_by,
            )

            if reconciliation["fully_refunded"]:
                connection.commit()

                reconciled_ids = reconciliation[
                    "reconciled_refund_ids"
                ]

                return {
                    "success": True,
                    "refund_id": (
                        reconciled_ids[-1]
                        if reconciled_ids
                        else None
                    ),
                    "refund_db_id": None,
                    "amount": float(payment["amount"]),
                    "reverse_all": reverse_all,
                    "gateway": "CASHFREE",
                    "refund_mode": "CASHFREE_EASY_SPLIT",
                    "fully_refunded": True,
                    "already_refunded": True,
                    "refund_status": "PROCESSED",
                    "refund_splits": [],
                }

        # ========================================================
        # PREVIOUS PROCESSED REFUNDS
        # ========================================================

        cursor.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS refunded
            FROM marketplace_refunds
            WHERE payment_id = %s
              AND status = 'PROCESSED'
            FOR UPDATE
            """,
            (payment_db_id,),
        )

        refunded = float(
            cursor.fetchone()["refunded"] or 0
        )

        # ========================================================
        # EXISTING PENDING REFUND
        #
        # A previous request may already have created a local refund
        # intent and committed it before calling Cashfree. Do not create
        # another refund while that one is awaiting confirmation.
        # ========================================================

        cursor.execute(
            """
            SELECT
                id,
                amount,
                status
            FROM marketplace_refunds
            WHERE payment_id = %s
              AND status = 'PENDING'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (payment_db_id,),
        )

        pending_refund = cursor.fetchone()

        if pending_refund:
            raise ConflictError(
                "A Cashfree refund is already being processed "
                f"for this payment (refund #{pending_refund['id']}). "
                "Wait for the refund status to be confirmed."
            )

        remaining_refundable = round(
            float(payment["amount"]) - refunded,
            2,
        )

        if remaining_refundable <= 0:
            # This should normally have been caught by Cashfree
            # reconciliation, but keep a local safety guard as well.
            raise ConflictError(
                "This payment has already been fully refunded."
            )

        if (
            refund_amount
            > remaining_refundable + 0.0001
        ):
            raise ConflictError(
                "Refund amount exceeds the remaining refundable amount"
            )

        # ========================================================
        # COD REFUND
        # ========================================================

        if is_cod:
            cashfree_refund_id = None
            cashfree_refund_arn = None
            cashfree_refund_splits = []
            status = "PROCESSED"

            cursor.execute(
                """
                INSERT INTO marketplace_refunds
                    (
                        order_id,
                        payment_id,
                        buyer_id,
                        amount,
                        reverse_transfers,
                        cashfree_refund_id,
                        cashfree_refund_arn,
                        cashfree_refund_splits,
                        status,
                        created_by,
                        processed_at
                    )
                VALUES
                    (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        CASE
                            WHEN %s = 'PROCESSED'
                            THEN CURRENT_TIMESTAMP
                            ELSE NULL
                        END
                    )
                """,
                (
                    payment["order_id"],
                    payment_db_id,
                    payment["buyer_id"],
                    refund_amount,
                    reverse_all,
                    cashfree_refund_id,
                    cashfree_refund_arn,
                    json.dumps(cashfree_refund_splits),
                    status,
                    created_by,
                    status,
                ),
            )

            refund_db_id = cursor.lastrowid

        # ========================================================
        # CASHFREE REFUND
        # ========================================================

        else:
            refund_id = (
                f"EDU-REF-{payment_db_id}-"
                f"{uuid.uuid4().hex[:12]}"
            )

            # ----------------------------------------------------
            # Cashfree Easy Split refund allocation
            # ----------------------------------------------------

            refund_splits = []

            if reverse_all:
                # Normal refunds can reverse all vendors in the order.
                # A payout adjustment must debit ONLY the target vendor.
                if target_vendor_id:
                    cursor.execute(
                        """
                        SELECT
                            pt.cashfree_vendor_id,
                            pt.seller_amount
                        FROM marketplace_seller_payout_transactions pt
                        WHERE pt.order_id = %s
                          AND pt.cashfree_vendor_id = %s
                          AND pt.seller_amount > 0
                        ORDER BY pt.id ASC
                        LIMIT 1
                        FOR UPDATE
                        """,
                        (
                            payment["order_id"],
                            str(target_vendor_id),
                        ),
                    )

                    payout_row = cursor.fetchone()

                    if not payout_row:
                        raise BadRequestError(
                            "The target Cashfree vendor payout "
                            "was not found for this order"
                        )

                    seller_amount = round(
                        float(payout_row["seller_amount"] or 0),
                        2,
                    )

                    if refund_amount > seller_amount + 0.0001:
                        raise BadRequestError(
                            "Reversal amount cannot exceed the "
                            "seller payout amount"
                        )

                    refund_splits.append(
                        {
                            "vendor_id": str(
                                payout_row["cashfree_vendor_id"]
                            ),
                            "amount": refund_amount,
                        }
                    )

                else:
                    cursor.execute(
                        """
                        SELECT
                            pt.cashfree_vendor_id,
                            pt.seller_amount
                        FROM marketplace_seller_payout_transactions pt
                        WHERE pt.order_id = %s
                          AND pt.cashfree_vendor_id IS NOT NULL
                          AND pt.seller_amount > 0
                        ORDER BY pt.id ASC
                        FOR UPDATE
                        """,
                        (payment["order_id"],),
                    )

                    payout_rows = cursor.fetchall()

                    total_seller_amount = sum(
                        float(row.get("seller_amount") or 0)
                        for row in payout_rows
                    )

                    remaining_refund = round(
                        refund_amount,
                        2,
                    )

                    if total_seller_amount > 0:
                        for index, row in enumerate(payout_rows):
                            vendor_id = str(
                                row["cashfree_vendor_id"]
                            )

                            seller_amount = float(
                                row.get("seller_amount") or 0
                            )

                            if index == len(payout_rows) - 1:
                                vendor_refund = min(
                                    seller_amount,
                                    remaining_refund,
                                )
                            else:
                                vendor_refund = min(
                                    seller_amount,
                                    round(
                                        refund_amount
                                        * seller_amount
                                        / total_seller_amount,
                                        2,
                                    ),
                                    remaining_refund,
                                )

                            vendor_refund = round(
                                vendor_refund,
                                2,
                            )

                            if vendor_refund > 0:
                                refund_splits.append(
                                    {
                                        "vendor_id": vendor_id,
                                        "amount": vendor_refund,
                                    }
                                )

                                remaining_refund = round(
                                    remaining_refund
                                    - vendor_refund,
                                    2,
                                )

                            if remaining_refund <= 0:
                                break

            # ----------------------------------------------------
            # IMPORTANT:
            #
            # Create the local refund intent BEFORE calling
            # Cashfree.
            #
            # The merchant refund ID is temporarily stored in
            # cashfree_refund_id so a webhook arriving during
            # the API call can locate this exact refund.
            #
            # It is replaced with Cashfree's actual cf_refund_id
            # when Cashfree returns one.
            # ----------------------------------------------------

            cursor.execute(
                """
                INSERT INTO marketplace_refunds
                    (
                        order_id,
                        payment_id,
                        buyer_id,
                        amount,
                        reverse_transfers,
                        cashfree_refund_id,
                        cashfree_refund_arn,
                        cashfree_refund_splits,
                        status,
                        created_by,
                        processed_at
                    )
                VALUES
                    (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        NULL,
                        %s,
                        'PENDING',
                        %s,
                        NULL
                    )
                """,
                (
                    payment["order_id"],
                    payment_db_id,
                    payment["buyer_id"],
                    refund_amount,
                    reverse_all,
                    refund_id,
                    json.dumps(refund_splits),
                    created_by,
                ),
            )

            refund_db_id = cursor.lastrowid

            # Make the refund intent visible before the external
            # Cashfree API call so the webhook cannot outrun it.
            connection.commit()

            try:
                payload = create_refund(
                    payment["gateway_order_id"],
                    refund_amount,
                    refund_id,
                    reason,
                    refund_splits=refund_splits,
                )

            except Exception as exc:
                cursor.execute(
                    """
                    UPDATE marketplace_refunds
                    SET
                        status = 'FAILED',
                        failure_reason = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        str(exc),
                        refund_db_id,
                    ),
                )

                connection.commit()
                raise

            # ----------------------------------------------------
            # NORMALIZE CASHFREE RESPONSE
            # ----------------------------------------------------

            first = (
                payload[0]
                if isinstance(payload, list) and payload
                else payload
            )

            if not isinstance(first, dict):
                raise BadRequestError(
                    "Cashfree returned an invalid refund response"
                )

            # ----------------------------------------------------
            # CASHFREE REFUND ID
            #
            # cf_refund_id = Cashfree's actual refund ID
            # refund_id     = EduSphere merchant refund ID
            #
            # Prefer Cashfree's real ID whenever available.
            # ----------------------------------------------------

            cashfree_refund_id = first.get(
                "cf_refund_id"
            )

            if not cashfree_refund_id:
                cashfree_refund_id = refund_id
            else:
                cashfree_refund_id = str(
                    cashfree_refund_id
                )

            cashfree_refund_arn = first.get(
                "refund_arn"
            )

            cashfree_refund_splits = (
                first.get("refund_splits")
                or refund_splits
            )

            # ----------------------------------------------------
            # CASHFREE REFUND STATUS
            # ----------------------------------------------------

            gateway_status = str(
                first.get("refund_status")
                or "PENDING"
            ).upper()

            if gateway_status not in {
                "PROCESSED",
                "SUCCESS",
                "PENDING",
                "ONHOLD",
                "FAILED",
                "CANCELLED",
            }:
                raise BadRequestError(
                    f"Cashfree refund failed: {first}"
                )

            # ----------------------------------------------------
            # IMPORTANT:
            #
            # The refund creation API response is not treated as
            # the final refund state for FAILED/CANCELLED.
            #
            # Cashfree can accept/process the refund asynchronously.
            # Final status should come from the Cashfree webhook or
            # reconciliation.
            # ----------------------------------------------------

            status = {
                "SUCCESS": "PROCESSED",
                "PROCESSED": "PROCESSED",
                "PENDING": "PENDING",
                "ONHOLD": "PENDING",
                "FAILED": "PENDING",
                "CANCELLED": "PENDING",
            }.get(
                gateway_status,
                "PENDING",
            )

            processed_at = (
                "CURRENT_TIMESTAMP"
                if status == "PROCESSED"
                else "NULL"
            )

            # ----------------------------------------------------
            # Update the pre-created refund row.
            # ----------------------------------------------------

            cursor.execute(
                f"""
                UPDATE marketplace_refunds
                SET
                    cashfree_refund_id = %s,
                    cashfree_refund_arn = %s,
                    cashfree_refund_splits = %s,
                    status = %s,
                    processed_at = {processed_at},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (
                    cashfree_refund_id,
                    cashfree_refund_arn,
                    json.dumps(
                        cashfree_refund_splits
                    ),
                    status,
                    refund_db_id,
                ),
            )

        # ========================================================
        # REFUND FINALIZATION
        # ========================================================

        fully_refunded = False

        if status == "PROCESSED":
            cursor.execute(
                """
                SELECT COALESCE(SUM(amount), 0) AS refunded
                FROM marketplace_refunds
                WHERE payment_id = %s
                  AND status = 'PROCESSED'
                """,
                (payment_db_id,),
            )

            total_refunded = float(
                cursor.fetchone()["refunded"] or 0
            )

            fully_refunded = (
                total_refunded
                >= float(payment["amount"]) - 0.0001
            )

            # Partial refunds must not restore the entire order
            # inventory or mark the payment/order as fully refunded.
            if fully_refunded:
                _finalize_fully_refunded_payment(
                    cursor,
                    payment,
                    refund_db_id,
                )

        connection.commit()

        return {
            "success": True,
            "refund_id": cashfree_refund_id,
            "refund_db_id": refund_db_id,
            "refund_status": status,
            "amount": refund_amount,
            "reverse_all": reverse_all,
            "gateway": (
                "COD"
                if is_cod
                else "CASHFREE"
            ),
            "refund_mode": (
                "MANUAL_CASH"
                if is_cod
                else "CASHFREE_EASY_SPLIT"
            ),
            "fully_refunded": fully_refunded,
            "refund_splits": (
                cashfree_refund_splits
                if not is_cod
                else []
            ),
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()