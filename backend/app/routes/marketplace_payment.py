from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.middleware.auth_guard import require_admin, require_completed_profile
from app.schemas.marketplace_payment import (
    MarketplacePaymentCreate,
    MarketplacePaymentVerify,
)
from app.services.marketplace_payment_service import (
    create_payment,
    get_order_payment,
    get_payment,
    mark_cod_payment_collected,
    verify_payment,
)
from app.services.payment_webhook_service import process_payment_webhook

router = APIRouter(
    prefix="/marketplace/payments",
    tags=["Marketplace Payments"],
)


# ============================================================
# CREATE PAYMENT
# BUYER
#
# Creates a PENDING Cashfree payment order.
# ============================================================


@router.post("/")
async def create_payment_route(
    request: Request,
    data: MarketplacePaymentCreate,
):

    user = require_completed_profile(request)

    try:
        return create_payment(
            user_id=user["id"],
            order_id=data.order_id,
        )

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except ServiceUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error


# ============================================================
# GET ORDER PAYMENT
#
# MUST BE BEFORE /{payment_id}
# ============================================================


@router.get("/order/{order_id}")
async def get_order_payment_route(
    order_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_order_payment(
            order_id=order_id,
            user_id=user["id"],
        )

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# VERIFY PAYMENT
# BUYER
#
# Cashfree payment status is verified server-side.
# ============================================================


@router.post("/verify")
async def verify_payment_route(
    request: Request,
    data: MarketplacePaymentVerify,
):

    user = require_completed_profile(request)

    try:
        return verify_payment(
            user_id=user["id"],
            order_id=data.order_id,
            gateway_order_id=data.gateway_order_id,
            gateway_payment_id=data.gateway_payment_id,
            gateway_signature=data.gateway_signature,
        )

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except ServiceUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error


# ============================================================
# CASHFREE WEBHOOK
#
# CASHFREE SERVER → EDUSPHERE
#
# NO USER AUTH REQUIRED
# ============================================================


@router.post("/webhook")
async def cashfree_webhook(request: Request):

    raw_body = await request.body()

    signature = request.headers.get(
        "x-webhook-signature"
    )

    timestamp = request.headers.get(
        "x-webhook-timestamp"
    )

    try:
        return process_payment_webhook(
            raw_body=raw_body,
            signature=signature,
            timestamp=timestamp,
        )

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error





# ============================================================
# MARK COD PAYMENT COLLECTED
# ADMIN / SUPER ADMIN
# ============================================================


@router.post("/{payment_id}/cod/collect")
async def mark_cod_payment_collected_route(
    payment_id: int,
    request: Request,
):
    user = require_admin(request)

    try:
        return mark_cod_payment_collected(
            payment_id=payment_id,
            admin_user_id=user["id"],
        )
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ForbiddenError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except BadRequestError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# ============================================================
# GET PAYMENT
#
# Keep this AFTER fixed routes.
# ============================================================


@router.get("/{payment_id}")
async def get_payment_route(
    payment_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_payment(
            payment_id=payment_id,
            user_id=user["id"],
        )

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error