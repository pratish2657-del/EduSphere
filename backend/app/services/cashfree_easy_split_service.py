"""Cashfree Easy Split marketplace operations."""

from __future__ import annotations

import uuid

import httpx

from app.core.exceptions import BadRequestError, ServiceUnavailableError
from app.services.payment_gateway_service import (
    get_cashfree_config,
    get_cashfree_headers,
)


def _request(
    method: str,
    path: str,
    *,
    json=None,
    idempotency_key: str | None = None,
    log_response: bool = False,
):
    config = get_cashfree_config()
    headers = get_cashfree_headers()

    if idempotency_key:
        headers["x-idempotency-key"] = idempotency_key

    headers["x-request-id"] = str(uuid.uuid4())

    try:
        response = httpx.request(
            method,
            f"{config['base_url']}{path}",
            headers=headers,
            json=json,
            timeout=30.0,
        )
    except httpx.RequestError as exc:
        raise ServiceUnavailableError(
            f"Cashfree Easy Split request failed: {exc}"
        ) from exc

    # ------------------------------------------------------------
    # Optional response logging
    #
    # Enabled only for Cashfree split verification/reconciliation.
    # This lets us inspect the actual Cashfree response body in
    # Render logs without logging every Easy Split API response.
    # ------------------------------------------------------------

    if log_response:
        print(
            "\n[CASHFREE EASY SPLIT]\n"
            f"METHOD: {method}\n"
            f"PATH: {path}\n"
            f"STATUS: {response.status_code}\n"
            f"BODY: {response.text}\n"
        )

    try:
        payload = response.json() if response.content else {}
    except ValueError:
        payload = {"raw": response.text}

    if not response.is_success:
        detail = (
            payload.get("message")
            or payload.get("error")
            or payload.get("code")
            or response.text[:1000]
        )

        raise BadRequestError(
            f"Cashfree Easy Split error: {detail}"
        )

    return payload


# ============================================================
# CREATE VENDOR
# ============================================================


def create_vendor(
    *,
    vendor_id: str,
    name: str,
    email: str,
    phone: str,
    bank_account_number: str,
    ifsc: str,
    account_holder: str,
    schedule_option: int = 1,
    verify_account: bool = True,
):
    return _request(
        "POST",
        "/easy-split/vendors",
        json={
            "vendor_id": vendor_id,
            "status": "ACTIVE",
            "name": name,
            "email": email,
            "phone": phone,
            "verify_account": verify_account,
            "dashboard_access": False,
            "schedule_option": schedule_option,
            "bank": {
                "account_number": bank_account_number,
                "account_holder": account_holder,
                "ifsc": ifsc.upper().strip(),
            },
        },
        idempotency_key=str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"edusphere:vendor:{vendor_id}",
            )
        ),
    )


# ============================================================
# GET VENDOR
# ============================================================


def get_vendor(vendor_id: str):
    return _request(
        "GET",
        f"/easy-split/vendors/{vendor_id}",
    )


# ============================================================
# UPDATE VENDOR
# ============================================================


def update_vendor(
    vendor_id: str,
    payload: dict,
):
    return _request(
        "PATCH",
        f"/easy-split/vendors/{vendor_id}",
        json=payload,
    )


# ============================================================
# LEGACY SPLIT AFTER PAYMENT
# ============================================================


def split_after_payment(
    order_id: str,
    splits: list[dict],
):
    """Legacy split-after-payment API.

    New EduSphere checkouts do not use this endpoint.

    Splits are attached to the Cashfree PG order during order
    creation. This function remains available only for backward
    compatibility with old callers.
    """

    return _request(
        "POST",
        f"/easy-split/orders/{order_id}/split",
        json={
            "split": splits,
            "disable_split": True,
        },
        idempotency_key=str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"edusphere:split:{order_id}",
            )
        ),
    )


# ============================================================
# GET SPLIT + SETTLEMENT DETAILS
# ============================================================


def get_split_and_settlement_details(
    order_id: str,
):
    """Fetch Cashfree order-level Easy Split information.

    This is a READ/VERIFICATION operation.

    Important:
        The current Cashfree endpoint is:

            GET /easy-split/orders/{order_id}

        not:

            GET /easy-split/orders/{order_id}/split
    """

    return _request(
        "GET",
        f"/easy-split/orders/{order_id}",
        log_response=True,
    )


# ============================================================
# GET VENDOR RECONCILIATION
# ============================================================


def get_split_reconciliation(
    order_id: str,
):
    """Fetch Cashfree vendor reconciliation for an order.

    This is used to determine whether Cashfree actually reports
    a vendor split for the given order.
    """

    return _request(
        "POST",
        "/split/order/vendor/recon",
        json={
            "filters": {
                "start_date": None,
                "end_date": None,
                "order_ids": [
                    order_id,
                ],
            },
            "pagination": {
                "limit": 100,
                "cursor": None,
            },
        },
        idempotency_key=str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"edusphere:split-recon:{order_id}",
            )
        ),
        log_response=True,
    )


# ============================================================
# CREATE REFUND
# ============================================================


def create_refund(
    order_id: str,
    refund_amount: float,
    refund_id: str,
    reason: str | None = None,
    refund_splits: list[dict] | None = None,
):
    return _request(
        "POST",
        f"/orders/{order_id}/refunds",
        json={
            "refund_amount": round(
                float(refund_amount),
                2,
            ),
            "refund_id": refund_id,
            "refund_note": (
                reason
                or "EduSphere marketplace refund"
            ),
            "refund_speed": "STANDARD",
            **({"refund_splits": refund_splits} if refund_splits else {}),
        },
        idempotency_key=str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"edusphere:refund:{refund_id}",
            )
        ),
    )


# ============================================================
# TRANSFER VENDOR BALANCE
# ============================================================


def transfer_vendor_balance(
    vendor_id: str,
    amount: float,
    *,
    transfer_from: str = "VENDOR",
    remark: str,
):
    return _request(
        "POST",
        f"/easy-split/vendors/{vendor_id}/transfer",
        json={
            "transfer_from": transfer_from,
            "transfer_type": "ADJUSTMENT",
            "transfer_amount": round(
                float(amount),
                2,
            ),
            "remark": remark,
        },
        idempotency_key=str(uuid.uuid4()),
    )