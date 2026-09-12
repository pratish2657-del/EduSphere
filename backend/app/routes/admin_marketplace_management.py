from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.middleware.auth_guard import require_admin
from app.services.admin_marketplace_management import (
    delete_marketplace_product,
    get_marketplace_management,
    set_product_status,
    set_seller_status,
)

router = APIRouter(prefix="/admin/marketplace", tags=["Admin Marketplace Management"])


class ProductStatusUpdate(BaseModel):
    is_active: bool


class SellerStatusUpdate(BaseModel):
    suspended: bool


@router.get("/dashboard")
async def marketplace_management_dashboard(request: Request):
    user = require_admin(request)
    try:
        return get_marketplace_management(user["id"])
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load marketplace management",
        ) from error


@router.put("/products/{product_id}/status")
async def marketplace_product_status(
    product_id: int,
    request: Request,
    data: ProductStatusUpdate,
):
    user = require_admin(request)
    try:
        return set_product_status(user["id"], product_id, data.is_active)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/products/{product_id}")
async def marketplace_product_delete(
    product_id: int,
    request: Request,
):
    user = require_admin(request)
    try:
        return delete_marketplace_product(user["id"], product_id)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/sellers/{seller_id}/status")
async def marketplace_seller_status(
    seller_id: int,
    request: Request,
    data: SellerStatusUpdate,
):
    user = require_admin(request)
    try:
        return set_seller_status(user["id"], seller_id, data.suspended)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
