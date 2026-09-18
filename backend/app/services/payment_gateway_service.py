import os
import uuid

import httpx

from app.core.exceptions import (
    BadRequestError,
    ServiceUnavailableError,
)

# ============================================================
# CASHFREE CONFIGURATION
# ============================================================

CASHFREE_SANDBOX_URL = "https://sandbox.cashfree.com/pg"
CASHFREE_PRODUCTION_URL = "https://api.cashfree.com/pg"


def get_cashfree_config():
    environment = os.getenv("CASHFREE_ENV", "sandbox").lower()

    client_id = os.getenv("CASHFREE_CLIENT_ID")
    client_secret = os.getenv("CASHFREE_CLIENT_SECRET")
    api_version = os.getenv("CASHFREE_API_VERSION", "2025-01-01")

    if not client_id:
        raise ServiceUnavailableError(
            "CASHFREE_CLIENT_ID is not configured"
        )

    if not client_secret:
        raise ServiceUnavailableError(
            "CASHFREE_CLIENT_SECRET is not configured"
        )

    if environment == "production":
        base_url = CASHFREE_PRODUCTION_URL
    else:
        base_url = CASHFREE_SANDBOX_URL

    return {
        "base_url": base_url,
        "client_id": client_id,
        "client_secret": client_secret,
        "api_version": api_version,
    }


# ============================================================
# CASHFREE HEADERS
# ============================================================


def get_cashfree_headers():
    config = get_cashfree_config()

    return {
        "Content-Type": "application/json",
        "x-client-id": config["client_id"],
        "x-client-secret": config["client_secret"],
        "x-api-version": config["api_version"],
    }


# ============================================================
# CREATE CASHFREE ORDER
# ============================================================


def create_gateway_order(
    amount,
    receipt,
    notes=None,
    customer_details=None,
    return_url=None,
    notify_url=None,
    order_splits=None,
    idempotency_key=None,
):
    """
    Create a Cashfree Payment Gateway order.

    Cashfree returns:
        cf_order_id
        order_id
        payment_session_id
    """

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        raise BadRequestError("Payment amount is invalid")

    if amount <= 0:
        raise BadRequestError(
            "Payment amount must be greater than zero"
        )

    config = get_cashfree_config()

    # --------------------------------------------------------
    # Cashfree customer information
    # --------------------------------------------------------

    customer_details = customer_details or {}

    customer_id = str(
        customer_details.get(
            "customer_id",
            f"edusphere_{receipt}",
        )
    )

    customer_phone = customer_details.get(
        "customer_phone",
        "9999999999",
    )

    payload = {
        "order_id": str(receipt),
        "order_amount": round(amount, 2),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": customer_id,
            "customer_phone": str(customer_phone),
        },
    }

    # --------------------------------------------------------
    # Optional customer information
    # --------------------------------------------------------

    customer_name = customer_details.get("customer_name")
    customer_email = customer_details.get("customer_email")

    if customer_name:
        payload["customer_details"]["customer_name"] = str(
            customer_name
        )

    if customer_email:
        payload["customer_details"]["customer_email"] = str(
            customer_email
        )

    # --------------------------------------------------------
    # Return URL
    # --------------------------------------------------------

    if return_url:
        payload["order_meta"] = {
            "return_url": return_url,
        }

    # --------------------------------------------------------
    # Webhook / Notify URL
    # --------------------------------------------------------

    if notify_url:
        payload.setdefault("order_meta", {})
        payload["order_meta"]["notify_url"] = notify_url

    # --------------------------------------------------------
    # Order notes
    # --------------------------------------------------------

    if notes:
        payload["order_note"] = str(notes)

    # --------------------------------------------------------
    # Easy Split order-level configuration
    #
    # Cashfree supports passing vendor splits while the
    # Payment Gateway order is created. This is the important
    # marketplace flow: the vendor split is attached to the
    # order BEFORE the customer payment is processed.
    #
    # Example:
    # [
    #   {"vendor_id": "edusphere_seller_4628", "amount": 4.75}
    # ]
    # --------------------------------------------------------

    if order_splits:
        payload["order_splits"] = [
            {
                "vendor_id": str(split["vendor_id"]),
                "amount": round(float(split["amount"]), 2),
            }
            for split in order_splits
            if split.get("vendor_id") and float(split.get("amount") or 0) > 0
        ]

    # --------------------------------------------------------
    # Create order
    # --------------------------------------------------------

    try:
        headers = get_cashfree_headers()

        # Cashfree supports an idempotency key for safe retries.  Keep the
        # same key for the same logical order operation so a timeout/retry
        # cannot create a second Cashfree order.
        if not idempotency_key:
            idempotency_key = str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"edusphere-cashfree-order:{receipt}",
                )
            )

        headers["x-idempotency-key"] = idempotency_key

        response = httpx.post(
            f"{config['base_url']}/orders",
            headers=headers,
            json=payload,
            timeout=30.0,
        )
    except httpx.RequestError as exc:
        raise ServiceUnavailableError(
            f"Cashfree API request failed: {exc}"
        )

    if response.status_code not in (200, 201):
        try:
            error_data = response.json()
        except ValueError:
            error_data = response.text

        raise ServiceUnavailableError(
            f"Cashfree order creation failed: {error_data}"
        )

    data = response.json()

    return data


# ============================================================
# GET CASHFREE ORDER
# ============================================================


def get_gateway_order(order_id):
    """
    Fetch the current Cashfree order status.

    This is intentionally server-side.
    Never trust the payment status sent by the browser.
    """

    config = get_cashfree_config()

    try:
        response = httpx.get(
            f"{config['base_url']}/orders/{order_id}",
            headers=get_cashfree_headers(),
            timeout=30.0,
        )
    except httpx.RequestError as exc:
        raise ServiceUnavailableError(
            f"Cashfree API request failed: {exc}"
        )

    if response.status_code != 200:
        try:
            error_data = response.json()
        except ValueError:
            error_data = response.text

        raise ServiceUnavailableError(
            f"Cashfree order lookup failed: {error_data}"
        )

    return response.json()

def get_gateway_payments(order_id):
    """
    Fetch all Cashfree payment attempts for an order.

    This is intentionally server-side so Cashfree credentials
    never reach the browser.
    """

    config = get_cashfree_config()

    try:
        response = httpx.get(
            f"{config['base_url']}/orders/{order_id}/payments",
            headers=get_cashfree_headers(),
            timeout=30.0,
        )
    except httpx.RequestError as exc:
        raise ServiceUnavailableError(
            f"Cashfree payment lookup failed: {exc}"
        )

    if response.status_code != 200:
        try:
            error_data = response.json()
        except ValueError:
            error_data = response.text

        raise ServiceUnavailableError(
            f"Cashfree payment lookup failed: {error_data}"
        )

    return response.json()