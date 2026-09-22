from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.middleware.auth_guard import require_completed_profile
from app.schemas.marketplace_seller import (
    MarketplaceSellerCreate,
    MarketplaceSellerUpdate,
)
from app.services.marketplace_seller_service import (
    activate_seller,
    create_seller,
    deactivate_seller,
    get_seller,
    update_seller,
)

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/marketplace/seller",
    tags=["Marketplace Seller"],
)


# ============================================================
# ERROR HANDLER
# ============================================================

def _handle_seller_error(error: Exception) -> HTTPException:
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
# GET SELLER PROFILE
# ============================================================

@router.get("/")
async def get_marketplace_seller(
    request: Request,
):
    """
    GET /marketplace/seller/

    Return the authenticated user's marketplace seller profile.
    """

    user = require_completed_profile(request)

    try:
        return get_seller(
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_seller_error(error) from error


# ============================================================
# CREATE SELLER PROFILE
# ============================================================

@router.post("/")
async def create_marketplace_seller(
    request: Request,
    data: MarketplaceSellerCreate,
):
    """
    POST /marketplace/seller/

    Create a seller profile.

    Required:
        name
        phone
        UPI ID
    """

    user = require_completed_profile(request)

    try:
        return create_seller(
            user_id=user["id"],
            name=data.name,
            phone=data.phone,
            upi_id=data.upi_id,
        )

    except Exception as error:
        raise _handle_seller_error(error) from error


# ============================================================
# UPDATE SELLER PROFILE
# ============================================================

@router.put("/")
async def update_marketplace_seller(
    request: Request,
    data: MarketplaceSellerUpdate,
):
    """
    PUT /marketplace/seller/

    Update the authenticated user's seller profile.
    """

    user = require_completed_profile(request)

    try:
        return update_seller(
            user_id=user["id"],
            name=data.name,
            phone=data.phone,
            upi_id=data.upi_id,
        )

    except Exception as error:
        raise _handle_seller_error(error) from error


# ============================================================
# ACTIVATE SELLER
# ============================================================

@router.post("/activate")
async def activate_marketplace_seller(
    request: Request,
):
    """
    POST /marketplace/seller/activate

    Activate the authenticated user's seller profile.
    """

    user = require_completed_profile(request)

    try:
        return activate_seller(
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_seller_error(error) from error


# ============================================================
# DEACTIVATE SELLER
# ============================================================

@router.post("/deactivate")
async def deactivate_marketplace_seller(
    request: Request,
):
    """
    POST /marketplace/seller/deactivate

    Deactivate the authenticated user's seller profile.

    The seller profile is retained; it is not deleted.
    """

    user = require_completed_profile(request)

    try:
        return deactivate_seller(
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_seller_error(error) from error