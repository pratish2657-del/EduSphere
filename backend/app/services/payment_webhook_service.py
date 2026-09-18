import base64
import hashlib
import hmac
import json
import os
from typing import Any

from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
)
from app.database import get_connection
from app.services.marketplace_inventory_service import finalize_order_inventory
from app.services.marketplace_payout_service import attempt_cashfree_split

# ============================================================
# CASHFREE WEBHOOK CONFIGURATION
# ============================================================


def _get_cashfree_webhook_secret() -> str:
    secret = os.getenv("CASHFREE_WEBHOOK_SECRET")

    if not secret:
        raise BadRequestError(
            "CASHFREE_WEBHOOK_SECRET is not configured"
        )

    return secret


# ============================================================
# CASHFREE WEBHOOK SIGNATURE VERIFICATION
# ============================================================


def verify_cashfree_webhook_signature(
    raw_body: bytes,
    signature: str | None,
    timestamp: str | None,
) -> bool:
    """
    Verify a Cashfree webhook.

    Cashfree signature:
        Base64(
            HMAC-SHA256(
                timestamp + raw_body,
                client_secret
            )
        )
    """

    if not signature:
        raise BadRequestError(
            "Missing Cashfree webhook signature"
        )

    if not timestamp:
        raise BadRequestError(
            "Missing Cashfree webhook timestamp"
        )

    secret = _get_cashfree_webhook_secret()

    signed_payload = timestamp.encode("utf-8") + raw_body

    expected_signature = base64.b64encode(
        hmac.new(
            secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")

    if not hmac.compare_digest(
        expected_signature,
        signature,
    ):
        raise BadRequestError(
            "Invalid Cashfree webhook signature"
        )

    return True


# ============================================================
# WEBHOOK EVENT PARSING
# ============================================================


def _parse_webhook_payload(
    raw_body: bytes,
) -> dict[str, Any]:
    try:
        payload = json.loads(
            raw_body.decode("utf-8")
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BadRequestError(
            "Invalid Cashfree webhook payload"
        ) from exc

    if not isinstance(payload, dict):
        raise BadRequestError(
            "Cashfree webhook payload must be an object"
        )

    return payload


# ============================================================
# CASHFREE PAYMENT WEBHOOK
# ============================================================


def process_payment_webhook(
    raw_body: bytes,
    signature: str | None,
    timestamp: str | None,
):
    """
    Process a Cashfree webhook.

    The webhook is verified first.
    Only then is the payment/order state changed.
    """

    # --------------------------------------------------------
    # 1. Verify webhook signature
    # --------------------------------------------------------

    verify_cashfree_webhook_signature(
        raw_body=raw_body,
        signature=signature,
        timestamp=timestamp,
    )

    # --------------------------------------------------------
    # 2. Parse payload
    # --------------------------------------------------------

    payload = _parse_webhook_payload(
        raw_body
    )

    event_type = payload.get(
        "type"
    )

    data = payload.get(
        "data",
        {},
    )

    if not isinstance(data, dict):
        raise BadRequestError(
            "Invalid Cashfree webhook data"
        )

    # --------------------------------------------------------
    # 3. Extract order information
    # --------------------------------------------------------

    order_data = data.get(
        "order",
        {},
    )

    payment_data = data.get(
        "payment",
        {},
    )

    if not isinstance(order_data, dict):
        order_data = {}

    if not isinstance(payment_data, dict):
        payment_data = {}

    cashfree_order_id = (
        order_data.get("order_id")
        or data.get("order_id")
    )

    cashfree_payment_id = (
        payment_data.get("cf_payment_id")
        or data.get("cf_payment_id")
    )

    if not cashfree_order_id:
        raise BadRequestError(
            "Cashfree webhook does not contain an order ID"
        )

    # --------------------------------------------------------
    # 4. Handle payment success
    # --------------------------------------------------------

    successful_events = {
        "PAYMENT_SUCCESS_WEBHOOK",
        "PAYMENT_SUCCESS",
    }

    if event_type in successful_events:
        return _handle_payment_success(
            cashfree_order_id=cashfree_order_id,
            cashfree_payment_id=cashfree_payment_id,
            payload=payload,
        )

    # --------------------------------------------------------
    # 5. Handle payment failure
    # --------------------------------------------------------

    failed_events = {
        "PAYMENT_FAILED_WEBHOOK",
        "PAYMENT_FAILED",
    }

    if event_type in failed_events:
        return _handle_payment_failure(
            cashfree_order_id=cashfree_order_id,
            cashfree_payment_id=cashfree_payment_id,
            payload=payload,
        )

    # --------------------------------------------------------
    # 6. Refund status webhook
    # --------------------------------------------------------

    if event_type == "REFUND_STATUS_WEBHOOK":
        return _handle_refund_status_webhook(payload,
        cashfree_order_id=cashfree_order_id,)

    # --------------------------------------------------------
    # 7. Unknown/unneeded event
    # --------------------------------------------------------

    return {
        "message": "Cashfree webhook received",
        "event_type": event_type,
        "processed": False,
    }


# ============================================================
# PAYMENT SUCCESS
# ============================================================


def _handle_payment_success(
    cashfree_order_id: str,
    cashfree_payment_id: str | None,
    payload: dict[str, Any],
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find local payment
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                buyer_id,
                status

            FROM marketplace_payments

            WHERE gateway = 'CASHFREE'
              AND gateway_order_id = %s

            FOR UPDATE
            """,
            (cashfree_order_id,),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "EduSphere payment not found for Cashfree order"
            )

        # ----------------------------------------------------
        # Idempotency
        # ----------------------------------------------------
        # A payment may already be PAID because the synchronous
        # /payments/verify flow updated it before this webhook arrived.
        # PAID does not mean Easy Split was already created.
        # ----------------------------------------------------

        already_paid = payment["status"] == "PAID"

        # ----------------------------------------------------
        # Mark payment as PAID when this webhook is the first
        # successful notification we have received.
        # ----------------------------------------------------

        if not already_paid:
            cursor.execute(
            """
            UPDATE marketplace_payments

            SET
                status = 'PAID',
                gateway_payment_id = %s,
                paid_at = CURRENT_TIMESTAMP

            WHERE id = %s
              AND status != 'PAID'
            """,
            (
                cashfree_payment_id,
                payment["id"],
            ),
        )

        # ----------------------------------------------------
        # Finalize inventory + confirm order
        #
        # /payments/verify and this webhook can both process the
        # same successful payment. If the payment was already PAID,
        # inventory was already finalized in the committed payment
        # transaction, so do NOT finalize it a second time.
        # ----------------------------------------------------

        if not already_paid:
            finalize_order_inventory(payment["order_id"], cursor)

            cursor.execute(
                """
                UPDATE marketplace_orders
                SET status = 'CONFIRMED'
                WHERE id = %s
                  AND status = 'PENDING'
                """,
                (payment["order_id"],),
            )

        connection.commit()

        # ----------------------------------------------------
        # Always check Easy Split after a successful payment.
        # This also runs when payment was already marked PAID by
        # /payments/verify before the Cashfree webhook arrived.
        # attempt_cashfree_split() uses the actual Cashfree
        # gateway_order_id and returns safely when a split has
        # already been initiated.
        # ----------------------------------------------------

        split_result = attempt_cashfree_split(payment["order_id"])

        return {
            "message": (
                "Cashfree payment processed successfully"
                if not already_paid
                else "Cashfree payment already processed; Easy Split checked"
            ),
            "payment_id": payment["id"],
            "order_id": payment["order_id"],
            "status": "PAID",
            "easy_split": split_result,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# PAYMENT FAILURE
# ============================================================


def _handle_payment_failure(
    cashfree_order_id: str,
    cashfree_payment_id: str | None,
    payload: dict[str, Any],
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                order_id,
                status

            FROM marketplace_payments

            WHERE gateway = 'CASHFREE'
              AND gateway_order_id = %s

            FOR UPDATE
            """,
            (cashfree_order_id,),
        )

        payment = cursor.fetchone()

        if not payment:
            raise NotFoundError(
                "EduSphere payment not found for Cashfree order"
            )

        # ----------------------------------------------------
        # Do not overwrite a successful payment
        # ----------------------------------------------------

        if payment["status"] == "PAID":
            connection.commit()

            return {
                "message": "Payment already completed",
                "payment_id": payment["id"],
                "order_id": payment["order_id"],
                "status": "PAID",
            }

        # ----------------------------------------------------
        # Mark payment failed
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_payments

            SET
                status = 'FAILED',
                gateway_payment_id = %s

            WHERE id = %s
              AND status = 'PENDING'
            """,
            (
                cashfree_payment_id,
                payment["id"],
            ),
        )

        connection.commit()

        return {
            "message": "Cashfree payment marked as failed",
            "payment_id": payment["id"],
            "order_id": payment["order_id"],
            "status": "FAILED",
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

# ============================================================
# REFUND STATUS WEBHOOK
# ============================================================


def _handle_refund_status_webhook(
    payload: dict[str, Any],
    cashfree_order_id: str | None = None,
):
    """Synchronize an Easy Split refund from Cashfree.

    Cashfree sends REFUND_STATUS_WEBHOOK when a merchant-initiated
    refund succeeds, fails, or is cancelled. A partial refund must not
    restore the full order inventory or mark the payment as fully
    refunded. Those final transitions happen only after cumulative
    processed refunds reach the original payment amount.
    """

    data = payload.get("data", {})
    refund_data = (
        data.get("refund", {})
        if isinstance(data, dict)
        else {}
    )

    if not isinstance(refund_data, dict):
        raise BadRequestError(
            "Invalid Cashfree refund webhook data"
        )

    cf_refund_id = (
        refund_data.get("cf_refund_id")
        or refund_data.get("refund_id")
    )

    merchant_refund_id = refund_data.get("refund_id")

    refund_status = str(
        refund_data.get("refund_status") or ""
    ).upper()

    if not cf_refund_id:
        raise BadRequestError(
            "Cashfree refund webhook does not contain a refund ID"
        )

    status_map = {
        "SUCCESS": "PROCESSED",
        "PENDING": "PENDING",
        "ONHOLD": "PENDING",
        "FAILED": "FAILED",
        "CANCELLED": "FAILED",
    }

    local_status = status_map.get(refund_status)

    if not local_status:
        return {
            "message": "Cashfree refund webhook received",
            "processed": False,
            "refund_status": refund_status,
        }

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ========================================================
        # 1. Find by Cashfree refund ID
        # ========================================================

        cursor.execute(
            """
            SELECT
                r.id,
                r.order_id,
                r.payment_id,
                r.amount,
                r.status,
                r.inventory_restored,
                p.amount AS payment_amount
            FROM marketplace_refunds r
            INNER JOIN marketplace_payments p
                ON p.id = r.payment_id
            WHERE r.cashfree_refund_id = %s
            FOR UPDATE
            """,
            (str(cf_refund_id),),
        )

        refund = cursor.fetchone()

        # ========================================================
        # 2. Webhook may arrive while refund API request is running
        #
        # refund_payment() stores the merchant refund ID in
        # cashfree_refund_id before calling Cashfree. Therefore
        # retry lookup using Cashfree's merchant refund_id too.
        # ========================================================

        if not refund and merchant_refund_id:
            cursor.execute(
                """
                SELECT
                    r.id,
                    r.order_id,
                    r.payment_id,
                    r.amount,
                    r.status,
                    r.inventory_restored,
                    p.amount AS payment_amount
                FROM marketplace_refunds r
                INNER JOIN marketplace_payments p
                    ON p.id = r.payment_id
                WHERE r.cashfree_refund_id = %s
                  AND r.status = 'PENDING'
                FOR UPDATE
                """,
                (str(merchant_refund_id),),
            )

            refund = cursor.fetchone()

        # ========================================================
        # 3. Recovery for an external/untracked refund
        #
        # This is a fallback for refunds created outside the normal
        # EduSphere refund workflow, or for the old race condition.
        # ========================================================

        if not refund:
            if not cashfree_order_id:
                connection.commit()
                return {
                    "message": (
                        "Refund webhook received without order ID"
                    ),
                    "processed": False,
                    "cashfree_refund_id": str(cf_refund_id),
                }

            cursor.execute(
                """
                SELECT
                    id,
                    order_id,
                    buyer_id,
                    amount AS payment_amount
                FROM marketplace_payments
                WHERE gateway = 'CASHFREE'
                  AND gateway_order_id = %s
                FOR UPDATE
                """,
                (cashfree_order_id,),
            )

            payment = cursor.fetchone()

            if not payment:
                raise NotFoundError(
                    "EduSphere payment not found for Cashfree refund"
                )

            refund_amount = float(
                refund_data.get("refund_amount") or 0
            )

            if refund_amount <= 0:
                raise BadRequestError(
                    "Cashfree refund webhook contains an invalid refund amount"
                )

            processed_at = (
                "CURRENT_TIMESTAMP"
                if local_status == "PROCESSED"
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
                        FALSE,
                        %s,
                        %s,
                        %s,
                        %s,
                        NULL,
                        {processed_at}
                    )
                """,
                (
                    payment["order_id"],
                    payment["id"],
                    payment["buyer_id"],
                    refund_amount,
                    str(cf_refund_id),
                    refund_data.get("refund_arn"),
                    (
                        json.dumps(
                            refund_data.get("refund_splits")
                        )
                        if refund_data.get("refund_splits")
                        is not None
                        else None
                    ),
                    local_status,
                ),
            )

            refund_db_id = cursor.lastrowid

            cursor.execute(
                """
                SELECT
                    r.id,
                    r.order_id,
                    r.payment_id,
                    r.amount,
                    r.status,
                    r.inventory_restored,
                    p.amount AS payment_amount
                FROM marketplace_refunds r
                INNER JOIN marketplace_payments p
                    ON p.id = r.payment_id
                WHERE r.id = %s
                FOR UPDATE
                """,
                (refund_db_id,),
            )

            refund = cursor.fetchone()

        # ========================================================
        # 4. Synchronize Cashfree status/details
        # ========================================================

        cursor.execute(
            """
            UPDATE marketplace_refunds
            SET
                status = %s,
                cashfree_refund_id = %s,
                cashfree_refund_arn =
                    COALESCE(%s, cashfree_refund_arn),
                cashfree_refund_splits =
                    COALESCE(%s, cashfree_refund_splits),
                processed_at = CASE
                    WHEN %s = 'PROCESSED'
                    THEN COALESCE(
                        processed_at,
                        CURRENT_TIMESTAMP
                    )
                    ELSE processed_at
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                local_status,
                str(cf_refund_id),
                refund_data.get("refund_arn"),
                (
                    json.dumps(
                        refund_data.get("refund_splits")
                    )
                    if refund_data.get("refund_splits")
                    is not None
                    else None
                ),
                local_status,
                refund["id"],
            ),
        )

        # ========================================================
        # 5. Full-refund finalization
        # ========================================================

        fully_refunded = False

        if local_status == "PROCESSED":
            cursor.execute(
                """
                SELECT COALESCE(SUM(amount), 0) AS refunded
                FROM marketplace_refunds
                WHERE payment_id = %s
                  AND status = 'PROCESSED'
                """,
                (refund["payment_id"],),
            )

            total_refunded = float(
                cursor.fetchone()["refunded"] or 0
            )

            fully_refunded = (
                total_refunded
                >= float(refund["payment_amount"]) - 0.0001
            )

            if fully_refunded:
                if not refund.get("inventory_restored"):
                    from app.services.marketplace_inventory_service import (
                        restore_order_inventory,
                    )

                    restore_order_inventory(
                        refund["order_id"],
                        cursor,
                    )

                    cursor.execute(
                        """
                        UPDATE marketplace_refunds
                        SET inventory_restored = TRUE
                        WHERE id = %s
                        """,
                        (refund["id"],),
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
                    (refund["payment_id"],),
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
                        refund["order_id"],
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
                    (refund["order_id"],),
                )

        connection.commit()

        return {
            "message": "Cashfree refund status synchronized",
            "processed": True,
            "refund_id": refund["id"],
            "cashfree_refund_id": str(cf_refund_id),
            "status": local_status,
            "fully_refunded": fully_refunded,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()
