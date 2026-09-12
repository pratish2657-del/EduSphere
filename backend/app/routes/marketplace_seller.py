from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import BadRequestError
from app.middleware.auth_guard import get_current_user
from app.schemas.marketplace_seller import SellerPayoutDetails
from app.services.marketplace_seller_service import (
    get_seller_payout,
    save_seller_payout,
)

router = APIRouter(prefix="/marketplace/seller", tags=["Marketplace Seller"])


@router.get("/payout")
async def get_payout(request: Request):
    user = get_current_user(request)
    return get_seller_payout(user["id"])


@router.put("/payout")
async def update_payout(request: Request, data: SellerPayoutDetails):
    user = get_current_user(request)
    try:
        return save_seller_payout(user["id"], data)
    except BadRequestError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
