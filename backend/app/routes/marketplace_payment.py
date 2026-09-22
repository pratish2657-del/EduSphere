from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.middleware.auth_guard import (
    require_admin,
    require_completed_profile,
)
from app.schemas.marketplace_payment import (
    MarketplacePaymentCreate,
    MarketplacePaymentVerify,
    MarketplaceUPIPaymentSubmit,
)
from app.services.marketplace_payment_service import (
    create_payment,
    get_order_payment,
    get_payment,
    get_pending_payments,
    submit_utr,
    verify_payment,
)
from app.services.marketplace_receipt_service import (
    get_receipt_for_order,
    get_receipt_for_payment,
)

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/marketplace/payments",
    tags=["Marketplace Payments"],
)


# ============================================================
# ERROR HANDLER
# ============================================================

def _handle_payment_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(
            status_code=404,
            detail=str(error),
        )

    if isinstance(error, ForbiddenError):
        return HTTPException(
            status_code=403,
            detail=str(error),
        )

    if isinstance(error, ConflictError):
        return HTTPException(
            status_code=409,
            detail=str(error),
        )

    if isinstance(error, BadRequestError):
        return HTTPException(
            status_code=400,
            detail=str(error),
        )

    return HTTPException(
        status_code=400,
        detail=str(error),
    )


# ============================================================
# CREATE PAYMENT
# ============================================================

@router.post("/")
async def create_marketplace_payment(
    request: Request,
    data: MarketplacePaymentCreate,
):
    """
    POST /marketplace/payments/

    Create the local PENDING UPI payment record.

    No payment gateway is contacted.
    """

    user = require_completed_profile(request)

    try:
        return create_payment(
            user_id=user["id"],
            order_id=data.order_id,
        )

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# GET PAYMENT FOR ORDER
# ============================================================

@router.get("/order/{order_id}")
async def get_marketplace_order_payment(
    order_id: int,
    request: Request,
):
    """
    GET /marketplace/payments/order/{order_id}

    Return the payment associated with the buyer's order.
    """

    user = require_completed_profile(request)

    try:
        return get_order_payment(
            user_id=user["id"],
            order_id=order_id,
        )

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# SUBMIT UTR
# ============================================================

@router.post("/{payment_id}/submit-utr")
async def submit_marketplace_payment_utr(
    payment_id: int,
    request: Request,
    data: MarketplaceUPIPaymentSubmit,
):
    """
    POST /marketplace/payments/{payment_id}/submit-utr

    Buyer submits:

    - UTR / transaction reference
    - payer UPI ID
    - payer phone

    The payment remains PENDING.

    This endpoint NEVER marks a payment as PAID.
    """

    user = require_completed_profile(request)

    try:
        return submit_utr(
            user_id=user["id"],
            payment_id=payment_id,
            utr_number=data.utr_number,
            payer_upi_id=data.payer_upi_id,
            payer_phone=data.payer_phone,
        )

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# GET PAYMENT
# ============================================================

@router.get("/{payment_id}")
async def get_marketplace_payment(
    payment_id: int,
    request: Request,
):
    """
    GET /marketplace/payments/{payment_id}

    Buyer can only access their own payment.
    """

    user = require_completed_profile(request)

    try:
        return get_payment(
            user_id=user["id"],
            payment_id=payment_id,
        )

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# ADMIN — PENDING PAYMENTS
# ============================================================

@router.get("/admin/pending")
async def get_pending_marketplace_payments(
    request: Request,
):
    """
    GET /marketplace/payments/admin/pending

    Admin-only list of payments waiting for manual UPI
    verification.
    """

    require_admin(request)

    try:
        return get_pending_payments()

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# ADMIN — VERIFY PAYMENT
# ============================================================

@router.post("/admin/verify")
async def verify_marketplace_payment(
    request: Request,
    data: MarketplacePaymentVerify,
):
    """
    POST /marketplace/payments/admin/verify

    Admin manually verifies the submitted UPI payment.

    Successful verification performs:

        payment -> PAID
        inventory -> finalized
        order -> CONFIRMED
        receipt -> created
    """

    admin = require_admin(request)

    try:
        return verify_payment(
            payment_id=data.payment_id,
            admin_id=admin["id"],
        )

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# RECEIPT BY ORDER
# ============================================================

@router.get("/order/{order_id}/receipt")
async def get_marketplace_order_receipt(
    order_id: int,
    request: Request,
):
    """
    GET /marketplace/payments/order/{order_id}/receipt
    """

    user = require_completed_profile(request)

    try:
        return get_receipt_for_order(
            user_id=user["id"],
            order_id=order_id,
        )

    except Exception as error:
        raise _handle_payment_error(error) from error


# ============================================================
# RECEIPT BY PAYMENT
# ============================================================

@router.get("/{payment_id}/receipt")
async def get_marketplace_payment_receipt(
    payment_id: int,
    request: Request,
):
    """
    GET /marketplace/payments/{payment_id}/receipt
    """

    user = require_completed_profile(request)

    try:
        return get_receipt_for_payment(
            user_id=user["id"],
            payment_id=payment_id,
        )

    except Exception as error:
        raise _handle_payment_error(error) from error