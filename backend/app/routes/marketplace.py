from __future__ import annotations

import os
import uuid

import aiofiles
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.middleware.auth_guard import require_completed_profile
from app.schemas.marketplace import (
    CartItemAdd,
    CartItemUpdate,
    MarketplaceCheckoutRequest,
    MarketplaceProductCreate,
    MarketplaceProductUpdate,
)
from app.services.marketplace_order_service import (
    add_cart_item,
    checkout,
    get_cart,
    get_order,
    get_seller_orders,
    get_user_orders,
    remove_cart_item,
    update_cart_item,
)
from app.services.marketplace_service import (
    ALLOWED_MARKETPLACE_FILE_TYPES,
    ALLOWED_MARKETPLACE_PREVIEW_TYPES,
    MAX_MARKETPLACE_FILE_SIZE,
    MAX_MARKETPLACE_PREVIEW_SIZE,
    add_product_attachment,
    create_product,
    delete_product,
    delete_product_attachment,
    get_attachment_for_download,
    get_product,
    get_product_attachment,
    get_product_preview,
    get_marketplace_signed_url,
    upload_marketplace_storage,
    get_products,
    save_product_preview,
    update_product,
)

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/marketplace",
    tags=["Marketplace"],
)


# ============================================================
# FILE DEPENDENCY
# ============================================================

MARKETPLACE_UPLOAD_FILE = File(...)


# ============================================================
# EXCEPTION HANDLER
# ============================================================

def _handle_marketplace_error(error: Exception) -> HTTPException:
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
# PRODUCTS
# ============================================================


@router.get("/")
async def list_marketplace_products(
    request: Request,
    institution_id: int | None = None,
    category: str | None = None,
    product_type: str | None = None,
    search: str | None = None,
):
    """
    GET /marketplace/

    List active marketplace products.
    """

    require_completed_profile(request)

    try:
        return get_products(
            institution_id=institution_id,
            category=category,
            product_type=product_type,
            search=search,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.post("/")
async def create_marketplace_product(
    request: Request,
    data: MarketplaceProductCreate,
):
    """
    POST /marketplace/

    Create a product owned by the authenticated seller.
    """

    user = require_completed_profile(request)

    try:
        return create_product(
            user_id=user["id"],
            data=data,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


# ============================================================
# CART
# ============================================================


@router.get("/cart")
async def get_marketplace_cart(
    request: Request,
):
    """
    GET /marketplace/cart
    """

    user = require_completed_profile(request)

    try:
        return get_cart(
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.post("/cart")
async def add_marketplace_cart_item(
    request: Request,
    data: CartItemAdd,
):
    """
    POST /marketplace/cart

    Add a product to the authenticated user's cart.
    """

    user = require_completed_profile(request)

    try:
        return add_cart_item(
            user_id=user["id"],
            product_id=data.product_id,
            quantity=data.quantity,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.put("/cart/items/{product_id}")
async def update_marketplace_cart_item(
    product_id: int,
    request: Request,
    data: CartItemUpdate,
):
    """
    PUT /marketplace/cart/items/{product_id}
    """

    user = require_completed_profile(request)

    try:
        return update_cart_item(
            user_id=user["id"],
            product_id=product_id,
            quantity=data.quantity,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.delete("/cart/items/{product_id}")
async def remove_marketplace_cart_item(
    product_id: int,
    request: Request,
):
    """
    DELETE /marketplace/cart/items/{product_id}
    """

    user = require_completed_profile(request)

    try:
        return remove_cart_item(
            user_id=user["id"],
            product_id=product_id,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


# ============================================================
# CHECKOUT
# ============================================================


@router.post("/checkout")
async def marketplace_checkout(
    request: Request,
    data: MarketplaceCheckoutRequest,
):
    """
    POST /marketplace/checkout

    Creates a PENDING order.

    This does NOT mark the order as paid.

    The next step is local UPI payment + UTR submission.
    """

    user = require_completed_profile(request)

    try:
        return checkout(
            user_id=user["id"],
            data=data,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


# ============================================================
# BUYER ORDERS
# ============================================================


@router.get("/orders")
async def list_marketplace_orders(
    request: Request,
):
    """
    GET /marketplace/orders

    Return the authenticated buyer's orders.
    """

    user = require_completed_profile(request)

    try:
        return get_user_orders(
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.get("/orders/{order_id}")
async def get_marketplace_order(
    order_id: int,
    request: Request,
):
    """
    GET /marketplace/orders/{order_id}
    """

    user = require_completed_profile(request)

    try:
        return get_order(
            user_id=user["id"],
            order_id=order_id,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


# ============================================================
# SELLER ORDERS
# ============================================================

@router.get("/seller/orders")
async def list_seller_orders(
    request: Request,
):
    """
    GET /marketplace/seller/orders

    Return orders containing products sold by the authenticated
    seller. An account with no sales receives an empty list,
    not a 404.
    """

    user = require_completed_profile(request)

    try:
        return get_seller_orders(
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


# ============================================================
# PRODUCT ATTACHMENTS
# ============================================================


@router.post("/{product_id}/attachments")
async def upload_marketplace_attachment(
    product_id: int,
    request: Request,
    file: UploadFile = MARKETPLACE_UPLOAD_FILE,
):
    """
    POST /marketplace/{product_id}/attachments

    Seller uploads the actual digital product file.
    """

    user = require_completed_profile(request)

    file_path = None

    try:
        if not file.filename:
            raise BadRequestError(
                "Filename is required."
            )

        if file.content_type not in ALLOWED_MARKETPLACE_FILE_TYPES:
            raise BadRequestError(
                "File type is not allowed. "
                "Supported files: PDF, DOC, DOCX, PPT, PPTX, "
                "JPG, PNG, WEBP and TXT."
            )

        contents = await file.read()

        if not contents:
            raise BadRequestError(
                "File cannot be empty."
            )

        if len(contents) > MAX_MARKETPLACE_FILE_SIZE:
            raise BadRequestError(
                "File size cannot exceed 10 MB."
            )

        file_path = upload_marketplace_storage(
            data=contents,
            filename=file.filename,
            content_type=file.content_type,
            kind="files",
        )

        result = add_product_attachment(
            product_id=product_id,
            user_id=user["id"],
            file_name=file.filename,
            file_path=file_path,
            file_type=file.content_type,
            file_size=len(contents),
        )

        return result

    except Exception as error:
        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise _handle_marketplace_error(error) from error


@router.get("/{product_id}/attachments")
async def list_marketplace_attachments(
    product_id: int,
    request: Request,
):
    """
    GET /marketplace/{product_id}/attachments

    Seller can inspect their product's attachments.
    """

    user = require_completed_profile(request)

    try:
        return get_product_attachment(
            product_id=product_id,
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.delete("/{product_id}/attachments/{attachment_id}")
async def delete_marketplace_attachment(
    product_id: int,
    attachment_id: int,
    request: Request,
):
    """
    DELETE /marketplace/{product_id}/attachments/{attachment_id}
    """

    user = require_completed_profile(request)

    try:
        return delete_product_attachment(
            product_id=product_id,
            attachment_id=attachment_id,
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


# ============================================================
# PRODUCT PREVIEW
# ============================================================


@router.post("/{product_id}/preview")
async def upload_marketplace_preview(
    product_id: int,
    request: Request,
    file: UploadFile = MARKETPLACE_UPLOAD_FILE,
):
    """
    POST /marketplace/{product_id}/preview

    Upload a product preview image.
    """

    user = require_completed_profile(request)

    file_path = None

    try:
        if not file.filename:
            raise BadRequestError(
                "Preview image filename is required."
            )

        if file.content_type not in ALLOWED_MARKETPLACE_PREVIEW_TYPES:
            raise BadRequestError(
                "Preview image must be JPG, PNG or WEBP."
            )

        contents = await file.read()

        if not contents:
            raise BadRequestError(
                "Preview image cannot be empty."
            )

        if len(contents) > MAX_MARKETPLACE_PREVIEW_SIZE:
            raise BadRequestError(
                "Preview image cannot exceed 5 MB."
            )

        file_path = upload_marketplace_storage(
            data=contents,
            filename=file.filename,
            content_type=file.content_type,
            kind="previews",
        )

        result = save_product_preview(
            product_id=product_id,
            user_id=user["id"],
            file_path=file_path,
            file_type=file.content_type,
            file_size=len(contents),
        )

        return result

    except Exception as error:
        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise _handle_marketplace_error(error) from error


@router.get("/{product_id}/preview")
async def get_marketplace_preview(
    product_id: int,
    request: Request,
):
    """
    GET /marketplace/{product_id}/preview

    Return the product preview image.
    """

    require_completed_profile(request)

    try:
        preview = get_product_preview(
            product_id=product_id,
        )

        if not preview:
            raise NotFoundError(
                "Product preview not found."
            )

        file_path = preview.get("storage_path")

        if file_path and file_path.startswith("supabase://"):
            signed_url = get_marketplace_signed_url(file_path, expires_in=300)
            return RedirectResponse(url=signed_url, status_code=307)

        if not file_path or not os.path.isfile(file_path):
            raise NotFoundError(
                "Product preview file not found."
            )

        return FileResponse(
            path=file_path,
            media_type=preview.get(
                "file_type",
                "application/octet-stream",
            ),
            filename=preview.get("file_name"),
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error
    
@router.get("/attachments/{attachment_id}/download")
async def download_marketplace_attachment(
    attachment_id: int,
    request: Request,
):
    """
    GET /marketplace/attachments/{attachment_id}/download

    Protected digital download.

    Requirements:
        - authenticated buyer
        - attachment belongs to a purchased product
        - order is CONFIRMED
        - payment is PAID
    """

    user = require_completed_profile(request)

    try:
        attachment = get_attachment_for_download(
            user_id=user["id"],
            attachment_id=attachment_id,
        )

        file_path = attachment["storage_path"]

        if file_path and file_path.startswith("supabase://"):
            signed_url = get_marketplace_signed_url(
                file_path,
                expires_in=300,
                download_name=attachment["file_name"],
            )
            return RedirectResponse(url=signed_url, status_code=307)

        if not file_path or not os.path.isfile(file_path):
            raise NotFoundError(
                "Digital file is no longer available."
            )

        return FileResponse(
            path=file_path,
            media_type=attachment["file_type"],
            filename=attachment["file_name"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error

@router.get("/{product_id}")
async def get_marketplace_product(
    product_id: int,
    request: Request,
):
    """
    GET /marketplace/{product_id}
    """

    require_completed_profile(request)

    try:
        return get_product(
            product_id=product_id,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.put("/{product_id}")
async def update_marketplace_product(
    product_id: int,
    request: Request,
    data: MarketplaceProductUpdate,
):
    """
    PUT /marketplace/{product_id}

    Update own product.
    """

    user = require_completed_profile(request)

    try:
        return update_product(
            product_id=product_id,
            user_id=user["id"],
            data=data,
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error


@router.delete("/{product_id}")
async def delete_marketplace_product(
    product_id: int,
    request: Request,
):
    """
    DELETE /marketplace/{product_id}

    Soft-delete own product.
    """

    user = require_completed_profile(request)

    try:
        return delete_product(
            product_id=product_id,
            user_id=user["id"],
        )

    except Exception as error:
        raise _handle_marketplace_error(error) from error

