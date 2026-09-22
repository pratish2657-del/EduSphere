from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.middleware.auth_guard import require_super_admin
from app.services.super_admin_marketplace import (
    get_marketplace_order,
    get_marketplace_orders,
    get_marketplace_product,
    get_marketplace_products,
    get_marketplace_summary,
    update_order_status,
    update_product_status,
)

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/super-admin/marketplace",
    tags=["Super Admin Marketplace"],
)


# ============================================================
# ERROR HANDLER
# ============================================================


def _handle_error(
    error: Exception,
) -> None:

    if isinstance(
        error,
        UnauthorizedError,
    ):
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        ForbiddenError,
    ):
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        NotFoundError,
    ):
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        ConflictError,
    ):
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    if isinstance(
        error,
        BadRequestError,
    ):
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    raise HTTPException(
        status_code=500,
        detail="Marketplace management request failed",
    ) from error


# ============================================================
# SUMMARY
#
# GET /super-admin/marketplace/summary
# ============================================================


@router.get("/summary")
async def marketplace_summary(
    request: Request,
):
    require_super_admin(request)

    try:

        return get_marketplace_summary()

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)


# ============================================================
# PRODUCTS
#
# GET /super-admin/marketplace/products
# ============================================================


@router.get("/products")
async def marketplace_products(
    request: Request,
    search: str | None = Query(
        default=None,
    ),
    active: str | None = Query(
        default=None,
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=500,
    ),
):
    require_super_admin(request)

    try:

        return get_marketplace_products(
            search=search,
            active=active,
            limit=limit,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)


# ============================================================
# SINGLE PRODUCT
#
# GET /super-admin/marketplace/products/{product_id}
# ============================================================


@router.get("/products/{product_id}")
async def marketplace_product(
    product_id: int,
    request: Request,
):
    require_super_admin(request)

    try:

        return get_marketplace_product(
            product_id=product_id,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)


# ============================================================
# PRODUCT STATUS
#
# PUT /super-admin/marketplace/products/{product_id}/status
# ============================================================


@router.put(
    "/products/{product_id}/status"
)
async def marketplace_product_status(
    product_id: int,
    request: Request,
):
    require_super_admin(request)

    try:

        body = await request.json()

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail="Invalid JSON request body",
        ) from error

    is_active = body.get(
        "is_active"
    )

    if not isinstance(
        is_active,
        bool,
    ):
        raise HTTPException(
            status_code=400,
            detail="is_active must be true or false",
        )

    try:

        return update_product_status(
            product_id=product_id,
            is_active=is_active,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)


# ============================================================
# ORDERS
#
# GET /super-admin/marketplace/orders
# ============================================================


@router.get("/orders")
async def marketplace_orders(
    request: Request,
    search: str | None = Query(
        default=None,
    ),
    status: str | None = Query(
        default=None,
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=500,
    ),
):
    require_super_admin(request)

    try:

        return get_marketplace_orders(
            search=search,
            status=status,
            limit=limit,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)


# ============================================================
# SINGLE ORDER
#
# GET /super-admin/marketplace/orders/{order_id}
# ============================================================


@router.get("/orders/{order_id}")
async def marketplace_order(
    order_id: int,
    request: Request,
):
    require_super_admin(request)

    try:

        return get_marketplace_order(
            order_id=order_id,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)


# ============================================================
# ORDER STATUS
#
# PUT /super-admin/marketplace/orders/{order_id}/status
# ============================================================


@router.put(
    "/orders/{order_id}/status"
)
async def marketplace_order_status(
    order_id: int,
    request: Request,
):
    require_super_admin(request)

    try:

        body = await request.json()

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail="Invalid JSON request body",
        ) from error

    status = body.get(
        "status"
    )

    if not isinstance(
        status,
        str,
    ):
        raise HTTPException(
            status_code=400,
            detail="status is required",
        )

    status = status.strip().upper()

    if not status:
        raise HTTPException(
            status_code=400,
            detail="status is required",
        )

    try:

        return update_order_status(
            order_id=order_id,
            status=status,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
    ) as error:

        _handle_error(error)