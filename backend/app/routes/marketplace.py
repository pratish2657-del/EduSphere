import os
import uuid

import aiofiles
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.middleware.auth_guard import require_completed_profile
from app.schemas.marketplace import (
    MarketplaceProductCreate,
    MarketplaceProductUpdate,
)
from app.services.marketplace_order_service import (
    add_to_cart,
    checkout,
    get_buyer_order,
    get_buyer_orders,
    get_cart,
    get_seller_orders,
    remove_from_cart,
    update_cart_item,
)
from app.services.marketplace_service import (
    ALLOWED_MARKETPLACE_FILE_TYPES,
    MAX_MARKETPLACE_FILE_SIZE,
    add_product_attachment,
    create_product,
    delete_product,
    delete_product_attachment,
    get_marketplace_attachment_for_download,
    get_product,
    get_product_attachment,
    get_products,
    update_product,
)

router = APIRouter(
    prefix="/marketplace",
    tags=["Marketplace"],
)


# ============================================================
# RUFF / APPLICATION EXCEPTION
# ============================================================


class MarketplaceRouteError(Exception):
    """Base exception for marketplace route errors."""


# ============================================================
# FILE DEPENDENCY
#
# Defined at module level to satisfy Ruff B008.
# ============================================================


MARKETPLACE_UPLOAD_FILE = File(...)


# ============================================================
# LIST PRODUCTS
#
# GET /marketplace/
# ============================================================


@router.get("/")
async def list_products(
    request: Request,
    institution_id: int | None = None,
    category: str | None = None,
    product_type: str | None = None,
    search: str | None = None,
):

    require_completed_profile(request)

    try:
        return get_products(
            institution_id=institution_id,
            category=category,
            product_type=product_type,
            search=search,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# CREATE PRODUCT
#
# POST /marketplace/
# ============================================================


@router.post("/")
async def create_product_route(
    request: Request,
    data: MarketplaceProductCreate,
):

    user = require_completed_profile(request)

    try:
        return create_product(
            user_id=user["id"],
            data=data,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# GET CART
#
# GET /marketplace/cart
# ============================================================


@router.get("/cart")
async def get_cart_route(request: Request):

    user = require_completed_profile(request)

    try:
        return get_cart(
            user_id=user["id"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# ADD TO CART
#
# POST /marketplace/cart
# ============================================================


@router.post("/cart")
async def add_to_cart_route(
    request: Request,
    product_id: int,
    quantity: int = 1,
):

    user = require_completed_profile(request)

    try:
        return add_to_cart(
            user_id=user["id"],
            product_id=product_id,
            quantity=quantity,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# UPDATE CART ITEM
#
# PUT /marketplace/cart/items/{product_id}
# ============================================================


@router.put("/cart/items/{product_id}")
async def update_cart_item_route(
    product_id: int,
    request: Request,
    quantity: int,
):

    user = require_completed_profile(request)

    try:
        return update_cart_item(
            user_id=user["id"],
            product_id=product_id,
            quantity=quantity,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# REMOVE CART ITEM
#
# DELETE /marketplace/cart/items/{product_id}
# ============================================================


@router.delete("/cart/items/{product_id}")
async def remove_from_cart_route(
    product_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return remove_from_cart(
            user_id=user["id"],
            product_id=product_id,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# CHECKOUT
#
# POST /marketplace/checkout
# ============================================================


@router.post("/checkout")
async def checkout_route(
    request: Request,
    institution_id: int,
    payment_method: str = "ONLINE",
    shipping_address: str | None = None,
):

    user = require_completed_profile(request)

    try:
        return checkout(
            user_id=user["id"],
            institution_id=institution_id,
            payment_method=payment_method,
            shipping_address=shipping_address,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# BUYER ORDERS
# ============================================================


@router.get("/orders")
async def buyer_orders_route(request: Request):

    user = require_completed_profile(request)

    try:
        return get_buyer_orders(
            user_id=user["id"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# SINGLE BUYER ORDER
#
# GET /marketplace/orders/{order_id}
# ============================================================


@router.get("/orders/{order_id}")
async def buyer_order_route(
    order_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_buyer_order(
            order_id=order_id,
            user_id=user["id"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


# ============================================================
# SELLER ORDERS
#
# GET /marketplace/seller/orders
# ============================================================


@router.get("/seller/orders")
async def seller_orders_route(request: Request):

    user = require_completed_profile(request)

    try:
        return get_seller_orders(
            user_id=user["id"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# PRODUCT DETAILS
#
# GET /marketplace/{product_id}
# ============================================================


@router.get("/{product_id}")
async def product_details(
    product_id: int,
    request: Request,
):

    require_completed_profile(request)

    try:
        return get_product(
            product_id=product_id,
        )

    except Exception as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


# ============================================================
# UPDATE OWN PRODUCT
#
# PUT /marketplace/{product_id}
# ============================================================


@router.put("/{product_id}")
async def update_product_route(
    product_id: int,
    request: Request,
    data: MarketplaceProductUpdate,
):

    user = require_completed_profile(request)

    try:
        return update_product(
            product_id=product_id,
            user_id=user["id"],
            data=data,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# DELETE OWN PRODUCT
#
# DELETE /marketplace/{product_id}
# ============================================================


@router.delete("/{product_id}")
async def delete_product_route(
    product_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return delete_product(
            product_id=product_id,
            user_id=user["id"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# UPLOAD DIGITAL PRODUCT FILE
#
# POST /marketplace/{product_id}/attachments
# ============================================================


@router.post("/{product_id}/attachments")
async def upload_product_attachment(
    product_id: int,
    request: Request,
    file: UploadFile = MARKETPLACE_UPLOAD_FILE,
):

    user = require_completed_profile(request)

    file_path = None

    try:
        # ----------------------------------------------------
        # Validate filename
        # ----------------------------------------------------

        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Filename is required",
            )

        # ----------------------------------------------------
        # Validate content type
        # ----------------------------------------------------

        if file.content_type not in ALLOWED_MARKETPLACE_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "File type is not allowed. "
                    "Supported files: PDF, DOC, DOCX, "
                    "PPT, PPTX, JPG, PNG, WEBP and TXT."
                ),
            )

        # ----------------------------------------------------
        # Read file
        # ----------------------------------------------------

        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="File cannot be empty",
            )

        # ----------------------------------------------------
        # Maximum 10 MB
        # ----------------------------------------------------

        if len(contents) > MAX_MARKETPLACE_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File size cannot exceed 10 MB",
            )

        # ----------------------------------------------------
        # Private directory
        # ----------------------------------------------------

        upload_directory = os.path.join(
            "private_uploads",
            "marketplace",
        )

        os.makedirs(
            upload_directory,
            exist_ok=True,
        )

        # ----------------------------------------------------
        # Preserve extension only
        # ----------------------------------------------------

        extension = ""

        if "." in file.filename:
            extension = os.path.splitext(
                file.filename
            )[1].lower()

        # ----------------------------------------------------
        # Random filename
        # ----------------------------------------------------

        stored_name = f"{uuid.uuid4().hex}{extension}"

        file_path = os.path.join(
            upload_directory,
            stored_name,
        )

        # ----------------------------------------------------
        # ASYNC FILE WRITE
        # ----------------------------------------------------

        async with aiofiles.open(
            file_path,
            "wb",
        ) as output_file:

            await output_file.write(contents)

        # ----------------------------------------------------
        # Database record
        # ----------------------------------------------------

        result = add_product_attachment(
            product_id=product_id,
            user_id=user["id"],
            file_name=file.filename,
            file_path=file_path,
            file_type=file.content_type,
            file_size=len(contents),
        )

        return result

    except HTTPException:
        # ----------------------------------------------------
        # Cleanup physical file
        # ----------------------------------------------------

        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise

    except Exception as error:
        # ----------------------------------------------------
        # Cleanup if DB operation fails
        # ----------------------------------------------------

        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# DELETE PRODUCT ATTACHMENT
#
# DELETE /marketplace/attachments/{attachment_id}
# ============================================================


@router.delete("/attachments/{attachment_id}")
async def delete_product_attachment_route(
    attachment_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        result = delete_product_attachment(
            attachment_id=attachment_id,
            user_id=user["id"],
        )

        file_path = result.get("file_path")

        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        result.pop("file_path", None)

        return result

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# GET ATTACHMENT INFORMATION
#
# GET /marketplace/attachments/{attachment_id}
# ============================================================


@router.get("/attachments/{attachment_id}")
async def get_attachment_route(
    attachment_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        attachment = get_product_attachment(
            attachment_id=attachment_id,
        )

        # ----------------------------------------------------
        # Seller can access own attachment.
        # ----------------------------------------------------

        if attachment["seller_id"] == user["id"]:
            pass

        else:
            # ------------------------------------------------
            # Buyer must have purchase access.
            # ------------------------------------------------

            try:
                get_marketplace_attachment_for_download(
                    attachment_id=attachment_id,
                    user_id=user["id"],
                )

            except Exception as error:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this attachment",
                ) from error

        # ----------------------------------------------------
        # Never expose filesystem path.
        # ----------------------------------------------------

        attachment.pop("file_path", None)

        return attachment

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


# ============================================================
# DOWNLOAD DIGITAL PRODUCT
#
# GET /marketplace/attachments/{attachment_id}/download
# ============================================================


@router.get("/attachments/{attachment_id}/download")
async def download_marketplace_attachment(
    attachment_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        attachment = get_marketplace_attachment_for_download(
            attachment_id=attachment_id,
            user_id=user["id"],
        )

        file_path = attachment["file_path"]

        # ----------------------------------------------------
        # Validate file path
        # ----------------------------------------------------

        if not file_path:
            raise MarketplaceRouteError(
                "File path is missing"
            )

        if not os.path.isfile(file_path):
            raise MarketplaceRouteError(
                "File is no longer available"
            )

        # ----------------------------------------------------
        # Return private file
        # ----------------------------------------------------

        return FileResponse(
            path=file_path,
            filename=attachment["file_name"],
            media_type=(
                attachment["file_type"]
                or "application/octet-stream"
            ),
        )

    except MarketplaceRouteError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error