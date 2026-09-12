import os
import uuid
from typing import Annotated

import aiofiles
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
)
from app.middleware.auth_guard import (
    require_admin,
    require_completed_profile,
)
from app.schemas.event import (
    EventCreate,
    EventPublish,
    EventUpdate,
)
from app.services.event_service import (
    add_event_attachment,
    create_event,
    delete_event,
    delete_event_attachment,
    get_event,
    get_event_attachment,
    get_events,
    set_event_published,
    update_event,
)

router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


# ============================================================
# INTERNAL — HANDLE SERVICE ERRORS
# ============================================================


def _handle_service_error(error):

    if isinstance(error, BadRequestError):
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    if isinstance(error, UnauthorizedError):
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    if isinstance(error, ForbiddenError):
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    if isinstance(error, NotFoundError):
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    if isinstance(error, ServiceUnavailableError):
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    raise error


# ============================================================
# ROLE HELPER
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def require_professor_or_admin(request: Request):

    user = require_completed_profile(request)

    # --------------------------------------------------------
    # PROFESSOR
    # --------------------------------------------------------

    if user["role"] == "PROFESSOR":
        return user

    # --------------------------------------------------------
    # ADMIN
    # --------------------------------------------------------

    if user["role"] == "ADMIN":
        return user

    # --------------------------------------------------------
    # SUPER ADMIN
    # --------------------------------------------------------

    if (
        user["role"] == "SUPER_ADMIN"
        and user["is_super_admin"] is True
    ):
        return user

    raise HTTPException(
        status_code=403,
        detail="Professor or Admin access required",
    )


# ============================================================
# VIEW EVENTS
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.get("/")
async def list_events(
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_events(
            user_id=user["id"],
            role=user["role"],
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# VIEW / DOWNLOAD EVENT ATTACHMENT
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.get("/attachments/{attachment_id}")
async def get_event_attachment_route(
    attachment_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:

        attachment = get_event_attachment(
            attachment_id=attachment_id,
            user_id=user["id"],
            role=user["role"],
        )

        file_path = attachment["file_path"]

        if not os.path.isfile(file_path):
            raise HTTPException(
                status_code=404,
                detail="File not found on server",
            )

        return FileResponse(
            path=file_path,
            media_type=(
                attachment["file_type"]
                or "application/octet-stream"
            ),
            filename=attachment["file_name"],
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# VIEW SINGLE EVENT
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.get("/{event_id}")
async def event_details(
    event_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_event(
            event_id=event_id,
            user_id=user["id"],
            role=user["role"],
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# CREATE EVENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.post("/")
async def create_event_route(
    request: Request,
    data: EventCreate,
):

    user = require_professor_or_admin(request)

    try:
        return create_event(
            user_id=user["id"],
            data=data,
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# UPDATE EVENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.put("/{event_id}")
async def update_event_route(
    event_id: int,
    request: Request,
    data: EventUpdate,
):

    user = require_professor_or_admin(request)

    try:
        return update_event(
            event_id=event_id,
            user_id=user["id"],
            role=user["role"],
            data=data,
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# DELETE EVENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.delete("/{event_id}")
async def delete_event_route(
    event_id: int,
    request: Request,
):

    user = require_professor_or_admin(request)

    try:
        return delete_event(
            event_id=event_id,
            user_id=user["id"],
            role=user["role"],
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# PUBLISH / UNPUBLISH
# ADMIN / SUPER_ADMIN ONLY
# ============================================================


@router.put("/{event_id}/publish")
async def publish_event_route(
    event_id: int,
    request: Request,
    data: EventPublish,
):

    require_admin(request)

    try:
        return set_event_published(
            event_id=event_id,
            is_published=data.is_published,
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# UPLOAD EVENT ATTACHMENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.post("/{event_id}/attachments")
async def upload_event_attachment(
    event_id: int,
    request: Request,
    file: Annotated[UploadFile, File()],
):

    user = require_professor_or_admin(request)

    # --------------------------------------------------------
    # Allowed file types
    # --------------------------------------------------------

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "application/vnd.ms-powerpoint",
        (
            "application/vnd.openxmlformats-officedocument."
            "presentationml.presentation"
        ),
        "application/msword",
        (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="File type is not allowed",
        )

    # --------------------------------------------------------
    # Read uploaded file
    # --------------------------------------------------------

    contents = await file.read()

    max_size = 10 * 1024 * 1024

    if len(contents) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File size cannot exceed 10 MB",
        )

    # --------------------------------------------------------
    # Create upload directory
    # --------------------------------------------------------

    upload_directory = os.path.join(
        "uploads",
        "events",
    )

    os.makedirs(
        upload_directory,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Get file extension
    # --------------------------------------------------------

    extension = ""

    if file.filename and "." in file.filename:
        extension = os.path.splitext(
            file.filename
        )[1].lower()

    # --------------------------------------------------------
    # Generate unique filename
    # --------------------------------------------------------

    stored_name = (
        f"{uuid.uuid4().hex}{extension}"
    )

    file_path = os.path.join(
        upload_directory,
        stored_name,
    )

    # --------------------------------------------------------
    # Save physical file asynchronously
    # --------------------------------------------------------

    try:

        async with aiofiles.open(
            file_path,
            "wb",
        ) as output_file:

            await output_file.write(contents)

    except OSError as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to save event attachment",
        ) from error

    # --------------------------------------------------------
    # Save attachment information in database
    # --------------------------------------------------------

    try:

        result = add_event_attachment(
            event_id=event_id,
            user_id=user["id"],
            role=user["role"],
            file_name=(
                file.filename
                or stored_name
            ),
            file_path=file_path,
            file_type=file.content_type,
            file_size=len(contents),
        )

        return result

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:

        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        _handle_service_error(error)

    except Exception:

        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise


# ============================================================
# DELETE EVENT ATTACHMENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.delete("/attachments/{attachment_id}")
async def delete_event_attachment_route(
    attachment_id: int,
    request: Request,
):

    user = require_professor_or_admin(request)

    try:

        result = delete_event_attachment(
            attachment_id=attachment_id,
            user_id=user["id"],
            role=user["role"],
        )

        # ----------------------------------------------------
        # Delete physical file
        # ----------------------------------------------------

        file_path = result.get("file_path")

        if file_path and os.path.exists(file_path):

            try:
                os.remove(file_path)

            except OSError as error:

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Event attachment database record "
                        "was deleted, but the physical file "
                        "could not be removed"
                    ),
                ) from error

        return result

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)