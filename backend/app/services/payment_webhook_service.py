import base64
import hashlib
import hmac
import json
import os
from typing import Any

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection


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
    # 6. Unknown/unneeded event
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

        if payment["status"] == "PAID":
            connection.commit()

            return {
                "message": "Payment already processed",
                "payment_id": payment["id"],
                "order_id": payment["order_id"],
                "status": "PAID",
            }

        # ----------------------------------------------------
        # Mark payment as PAID
        # ----------------------------------------------------

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
        # Confirm marketplace order
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE marketplace_orders

            SET
                status = 'CONFIRMED'

            WHERE id = %s
              AND status = 'PENDING'
            """,
            (
                payment["order_id"],
            ),
        )

        connection.commit()

        return {
            "message": "Cashfree payment processed successfully",
            "payment_id": payment["id"],
            "order_id": payment["order_id"],
            "status": "PAID",
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