"""Cashfree Easy Split marketplace operations."""

from __future__ import annotations

import uuid

import httpx

from app.core.exceptions import (
    BadRequestError,
    ServiceUnavailableError,
)
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
):
    config = get_cashfree_config()
    headers = get_cashfree_headers()

    if idempotency_key:
        headers["x-idempotency-key"] = idempotency_key

    headers["x-request-id"] = str(uuid.uuid4())

    url = f"{config['base_url']}{path}"

    print(
        "========== CASHFREE EASY SPLIT REQUEST =========="
    )
    print("METHOD:", method)
    print("URL:", url)
    print("PAYLOAD:", json)
    print("IDEMPOTENCY:", idempotency_key)
    print("==================================================")

    try:
        response = httpx.request(
            method,
            url,
            headers=headers,
            json=json,
            timeout=30.0,
        )
    except httpx.RequestError as exc:
        print(
            "========== CASHFREE REQUEST ERROR =========="
        )
        print("ERROR:", repr(exc))
        print("=============================================")

        raise ServiceUnavailableError(
            f"Cashfree Easy Split request failed: {exc}"
        ) from exc

    print(
        "========== CASHFREE EASY SPLIT RESPONSE =========="
    )
    print("STATUS:", response.status_code)
    print("BODY:", response.text)
    print("HEADERS:", dict(response.headers))
    print("===================================================")

    try:
        payload = (
            response.json()
            if response.content
            else {}
        )
    except ValueError:
        payload = {
            "raw": response.text,
        }

    if not response.is_success:
        detail = (
            payload.get("message")
            or payload.get("error")
            or payload.get("code")
            or response.text[:1000]
        )

        raise BadRequestError(
            "Cashfree Easy Split error "
            f"({response.status_code}): {detail}"
        )

    return payload


# ============================================================
# VENDORS
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
    pan: str | None = None,
    business_type: str = "E-commerce",
    account_type: str = "Individual",
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
            "kyc_details": {
                "account_type": account_type,
                "business_type": business_type,
                "pan": pan,
            },
        },
        idempotency_key=str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"edusphere:vendor:{vendor_id}",
            )
        ),
    )


def get_vendor(vendor_id: str):
    return _request(
        "GET",
        f"/easy-split/vendors/{vendor_id}",
    )


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
# PAYMENT SPLIT
# ============================================================


def split_after_payment(
    order_id: str,
    splits: list[dict],
):
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
# SPLIT + SETTLEMENT DETAILS
# ============================================================


def get_split_and_settlement_details(
    order_id: str,
):
    """Get Cashfree Easy Split details for an order.

    Cashfree endpoint:
        GET /easy-split/orders/{order_id}
    """

    return _request(
        "GET",
        f"/easy-split/orders/{order_id}",
    )


# ============================================================
# RECONCILIATION
# ============================================================


def get_split_reconciliation(
    order_id: str,
):
    """Get Cashfree Easy Split vendor reconciliation.

    This endpoint is READ-ONLY from EduSphere's point of view.

    IMPORTANT:
    A successful HTTP 200 response does not itself mean that
    a vendor split exists. The returned `data` must contain
    evidence of the vendor split before EduSphere marks its
    local payout as CREATED.
    """

    return _request(
        "POST",
        "/split/order/vendor/recon",
        json={
            "filters": {
                "start_date": None,
                "end_date": None,
                "order_ids": [order_id],
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
    )


# ============================================================
# REFUNDS
# ============================================================


def create_refund(
    order_id: str,
    refund_amount: float,
    refund_id: str,
    reason: str | None = None,
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
        },
        idempotency_key=str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"edusphere:refund:{refund_id}",
            )
        ),
    )


# ============================================================
# VENDOR BALANCE TRANSFER
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