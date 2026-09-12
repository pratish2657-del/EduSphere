from fastapi import APIRouter, HTTPException, Request

from app.middleware.auth_guard import require_admin, require_completed_profile
from app.schemas.marketplace_route import (
    PayoutReversalRequest,
    RefundRequest,
    RouteOnboardingRequest,
)
from app.services.marketplace_finance_summary import get_marketplace_finance_summary
from app.services.marketplace_route_service import (
    cancel_marketplace_order,
    get_route_onboarding,
    list_payouts,
    list_refunds,
    refresh_route_status,
    refund_payment,
    retry_payout,
    reverse_payout,
    submit_route_onboarding,
)

router = APIRouter(prefix="/marketplace/easy-split", tags=["Marketplace Easy Split"])


def _error(error):
    if isinstance(error, HTTPException):
        return error
    return HTTPException(status_code=400, detail=str(error))


@router.get("/seller/onboarding")
async def seller_route_status(request: Request):
    user = require_completed_profile(request)
    return get_route_onboarding(user["id"])


@router.post("/seller/onboarding/refresh")
async def seller_route_onboarding_refresh(request: Request):
    user = require_completed_profile(request)
    try:
        return refresh_route_status(user["id"])
    except Exception as error:
        raise _error(error) from error


@router.post("/seller/onboarding")
async def seller_route_onboarding(request: Request, data: RouteOnboardingRequest):
    user = require_completed_profile(request)
    try:
        return submit_route_onboarding(user["id"], data)
    except Exception as error:
        raise _error(error) from error


@router.get("/payouts")
async def admin_payouts(request: Request):
    user = require_admin(request)
    return {"items": list_payouts(user["id"])}


@router.post("/payouts/{payout_id}/reverse")
async def admin_reverse_payout(request: Request, payout_id: int, data: PayoutReversalRequest):
    user = require_admin(request)
    try:
        return reverse_payout(payout_id, user["id"], data.amount, data.reason)
    except Exception as error:
        raise _error(error) from error


@router.post("/payouts/{payout_id}/retry")
async def admin_retry_payout(request: Request, payout_id: int):
    user = require_admin(request)
    try:
        return retry_payout(payout_id, user["id"])
    except Exception as error:
        raise _error(error) from error


@router.get("/refunds")
async def admin_refunds(request: Request):
    require_admin(request)
    return {"items": list_refunds()}


@router.get("/finance-summary")
async def marketplace_finance_summary(request: Request):
    require_admin(request)
    return get_marketplace_finance_summary()


@router.post("/payments/{payment_id}/refund")
async def admin_refund(request: Request, payment_id: int, data: RefundRequest):
    user = require_admin(request)
    try:
        return refund_payment(payment_id, user["id"], data.amount, data.reverse_all, data.reason)
    except Exception as error:
        raise _error(error) from error


@router.post("/orders/{order_id}/cancel")
async def admin_cancel_marketplace_order(order_id: int, request: Request):
    user = require_admin(request)
    body = await request.json()
    reason = body.get("reason") if isinstance(body, dict) else None
    try:
        return cancel_marketplace_order(order_id, user["id"], reason)
    except Exception as error:
        raise _error(error) from error
