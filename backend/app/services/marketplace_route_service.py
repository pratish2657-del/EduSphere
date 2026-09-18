from __future__ import annotations

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
    get_vendor,
    transfer_vendor_balance,
)
from app.services.marketplace_inventory_service import (
    restore_order_inventory,
)
from app.services.marketplace_payout_service import (
    attempt_cashfree_split,
)


CASHFREE_RECON_HOLD_PREFIX = (
    "Cashfree reports the transaction"
)


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

        # --------------------------------------------------------
        # Cashfree already-processed + no vendor split confirmed.
        #
        # Do not send another split request.
        # --------------------------------------------------------

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
                    "reason": (
                        "This payout is on hold because "
                        "Cashfree reported the transaction "
                        "as already processed but did not "
                        "confirm the vendor split. "
                        "Use Verify Cashfree."
                    ),
                },
            }

        result = attempt_cashfree_split(
            row["order_id"]
        )

        return {
            "success": bool(
                result.get("success")
            ),
            "payout_transaction_id": (
                payout_transaction_id
            ),
            "result": result,
        }

    finally:
        connection.close()


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

                    /* ------------------------------------------------
                       Confirmed split:
                       allow verification and reversal.
                       ------------------------------------------------ */

                    WHEN pt.status IN (
                        'TRANSFER_INITIATED',
                        'SETTLED'
                    )
                    THEN 'REVERSE'

                    /* ------------------------------------------------
                       Cashfree already processed but split not
                       confirmed by reconciliation.
                       ------------------------------------------------ */

                    WHEN pt.status = 'ON_HOLD'
                     AND pt.failure_reason LIKE
                         'Cashfree reports the transaction%'
                    THEN 'VERIFY'

                    /* ------------------------------------------------
                       Normal retry states.
                       ------------------------------------------------ */

                    WHEN sp.payout_status = 'VERIFIED'
                     AND pt.status IN (
                         'PENDING',
                         'READY',
                         'FAILED',
                         'ON_HOLD'
                     )
                    THEN 'RETRY'

                    /* ------------------------------------------------
                       Seller onboarding required.
                       ------------------------------------------------ */

                    WHEN sp.payout_status IS NULL
                      OR sp.payout_status <> 'VERIFIED'
                    THEN 'SELLER_ONBOARDING_REQUIRED'

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


def reverse_payout(
    payout_transaction_id: int,
    created_by: int,
    amount: float | None = None,
    reason: str | None = None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT *

            FROM marketplace_seller_payout_transactions

            WHERE id = %s

            FOR UPDATE
            """,
            (payout_transaction_id,),
        )

        payout = cursor.fetchone()

        if not payout:
            raise NotFoundError(
                "Payout transaction not found"
            )

        vendor_id = payout.get(
            "cashfree_vendor_id"
        )

        if not vendor_id:
            raise BadRequestError(
                "This payout has no Cashfree "
                "Easy Split vendor"
            )

        if payout.get(
            "status"
        ) not in {
            "TRANSFER_INITIATED",
            "SETTLED",
        }:
            raise BadRequestError(
                "Only initiated or settled "
                "payouts can be reversed"
            )

        requested = round(
            (
                amount
                if amount is not None
                else float(
                    payout["seller_amount"]
                )
            ),
            2,
        )

        if requested < 1:
            raise BadRequestError(
                "Reversal amount must be at least ₹1"
            )

        result = transfer_vendor_balance(
            vendor_id,
            requested,
            transfer_from="VENDOR",
            remark=(
                reason
                or "EduSphere marketplace "
                "payout reversal"
            ),
        )

        transfer_id = str(
            (
                result.get(
                    "transfer_details"
                )
                or {}
            ).get(
                "transfer_id"
            )
            or uuid.uuid4()
        )

        cursor.execute(
            """
            INSERT INTO marketplace_payout_reversals
                (
                    payout_transaction_id,
                    amount,
                    cashfree_transfer_id,
                    status,
                    created_by,
                    processed_at
                )

            VALUES
                (
                    %s,
                    %s,
                    %s,
                    'PROCESSED',
                    %s,
                    CURRENT_TIMESTAMP
                )
            """,
            (
                payout_transaction_id,
                requested,
                transfer_id,
                created_by,
            ),
        )

        cursor.execute(
            """
            UPDATE marketplace_seller_payout_transactions

            SET
                status = 'REVERSED',
                cashfree_transfer_id = %s,
                failure_reason = NULL

            WHERE id = %s
            """,
            (
                transfer_id,
                payout_transaction_id,
            ),
        )

        connection.commit()

        return {
            "success": True,
            "transfer_id": transfer_id,
            "amount": requested,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


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

        if str(
            order["order_status"]
            or ""
        ).upper() == "REFUNDED":
            raise BadRequestError(
                "A refunded order cannot be cancelled"
            )

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

        restore_order_inventory(
            order_id,
            cursor,
        )

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
                (order["payment_id"],),
            )

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
            (order_id,),
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


def refund_payment(
    payment_db_id: int,
    created_by: int,
    amount: float | None = None,
    reverse_all: bool = True,
    reason: str | None = None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

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

        if payment.get(
            "status"
        ) != "PAID":
            raise BadRequestError(
                "Only paid marketplace payments "
                "can be refunded"
            )

        is_cod = (
            str(
                payment.get(
                    "payment_method"
                )
                or ""
            ).upper()
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
                refund_amount
                - float(payment["amount"])
            )
            > 0.0001
        ):
            raise BadRequestError(
                "COD refunds must refund "
                "the full collected amount"
            )

        cursor.execute(
            """
            SELECT
                COALESCE(
                    SUM(amount),
                    0
                ) AS refunded

            FROM marketplace_refunds

            WHERE payment_id = %s
              AND status = 'PROCESSED'

            FOR UPDATE
            """,
            (payment_db_id,),
        )

        refunded = float(
            cursor.fetchone()[
                "refunded"
            ]
            or 0
        )

        if (
            refunded
            + refund_amount
            > float(
                payment["amount"]
            )
            + 0.0001
        ):
            raise ConflictError(
                "Refund amount exceeds "
                "the remaining refundable amount"
            )

        if is_cod:
            cashfree_refund_id = None
            status = "PROCESSED"
            processed_at = "CURRENT_TIMESTAMP"

        else:
            refund_id = (
                f"EDU-REF-{payment_db_id}-"
                f"{uuid.uuid4().hex[:12]}"
            )

            payload = create_refund(
                f"EDU-{payment['order_id']}",
                refund_amount,
                refund_id,
                reason,
            )

            first = (
                payload[0]
                if isinstance(
                    payload,
                    list,
                )
                and payload
                else payload
            )

            cashfree_refund_id = str(
                first.get(
                    "cf_refund_id"
                )
                or first.get(
                    "refund_id"
                )
                or refund_id
            )

            status = str(
                first.get(
                    "refund_status"
                )
                or "PENDING"
            ).upper()

            if status not in {
                "PROCESSED",
                "SUCCESS",
                "PENDING",
                "ONHOLD",
            }:
                raise BadRequestError(
                    f"Cashfree refund failed: {first}"
                )

            status = (
                "PROCESSED"
                if status == "SUCCESS"
                else status
            )

            processed_at = (
                "CURRENT_TIMESTAMP"
                if status == "PROCESSED"
                else "NULL"
            )

        cursor.execute(
            f"""
            INSERT INTO marketplace_refunds
                (
                    order_id,
                    payment_id,
                    buyer_id,
                    amount,
                    reverse_transfers,
                    cashfree_refund_id,
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
                    {processed_at}
                )
            """,
            (
                payment["order_id"],
                payment_db_id,
                payment["buyer_id"],
                refund_amount,
                reverse_all,
                cashfree_refund_id,
                status,
                created_by,
            ),
        )

        refund_db_id = cursor.lastrowid

        if status == "PROCESSED":
            restore_order_inventory(
                payment["order_id"],
                cursor,
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
                (payment_db_id,),
            )

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
                      'TRANSFER_INITIATED'
                  )
                """,
                (
                    "Marketplace refund processed",
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

                  AND status NOT IN (
                      'CANCELLED',
                      'REFUNDED'
                  )
                """,
                (payment["order_id"],),
            )

        connection.commit()

        return {
            "success": True,
            "refund_id": cashfree_refund_id,
            "refund_db_id": refund_db_id,
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
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()