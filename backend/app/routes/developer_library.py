import os
import uuid
from typing import Annotated

import anyio
from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.middleware.auth_guard import get_current_user
from app.schemas.developer_library import (
    LibraryResourceCreate,
    LibraryResourceUpdate,
)
from app.services.developer_management_service import (
    UPLOAD_DIR,
    activity_logs,
    create_resource,
    delete_resource,
    get_resource_for_download,
    library_summary,
    list_institutions,
    list_resources,
    require_verified_developer,
    update_resource,
)

router = APIRouter(
    prefix="/developer/library",
    tags=["Developer Library"],
)

MAX_FILE_SIZE = 50 * 1024 * 1024

ALLOWED_RESOURCE_EXTENSIONS = {
    ".pdf",
    ".epub",
    ".doc",
    ".docx",
    ".txt",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".zip",
}

ALLOWED_COVER_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def _handle(error: Exception) -> None:
    """Convert application exceptions into HTTP exceptions."""

    mapping = {
        BadRequestError: 400,
        ConflictError: 409,
        ForbiddenError: 403,
        NotFoundError: 404,
    }

    for error_type, status_code in mapping.items():
        if isinstance(error, error_type):
            raise HTTPException(
                status_code=status_code,
                detail=str(error),
            ) from error

    raise error


def _write_file(
    path: str,
    data: bytes,
) -> None:
    """Write bytes to disk in a synchronous worker function."""

    with open(path, "wb") as handle:
        handle.write(data)


async def _save_upload(
    upload: UploadFile | None,
    allowed: set[str],
    label: str,
):
    """Validate and save an uploaded file."""

    if not upload or not upload.filename:
        return None

    ext = os.path.splitext(
        upload.filename
    )[1].lower()

    if ext not in allowed:
        raise BadRequestError(
            f"Unsupported {label} file type"
        )

    data = await upload.read()

    if len(data) > MAX_FILE_SIZE:
        raise BadRequestError(
            "File exceeds the 50 MB limit"
        )

    os.makedirs(
        UPLOAD_DIR,
        exist_ok=True,
    )

    path = os.path.join(
        UPLOAD_DIR,
        f"{uuid.uuid4().hex}{ext}",
    )

    # File writing is blocking, so run it outside
    # the async event loop.
    await anyio.to_thread.run_sync(
        _write_file,
        path,
        data,
    )

    return {
        "path": path,
        "original_file_name": upload.filename,
        "mime_type": (
            upload.content_type
            or "application/octet-stream"
        ),
        "file_size": len(data),
    }


@router.get("/institutions")
async def developer_library_institutions(
    request: Request,
):
    """Return institutions available to the Developer."""

    user = get_current_user(request)

    try:
        return list_institutions(
            user["id"],
        )
    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        _handle(error)


@router.get("")
async def developer_library_list(
    request: Request,
    search: str | None = None,
    resource_type: str | None = None,
    status: str | None = None,
    featured: bool | None = None,
    institution_id: int | None = None,
):
    """List Developer Library resources."""

    user = get_current_user(request)

    try:
        return list_resources(
            user["id"],
            search,
            resource_type,
            status,
            featured,
            institution_id,
        )
    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        _handle(error)


@router.get("/summary")
async def developer_library_summary(
    request: Request,
):
    """Return Developer Library summary."""

    user = get_current_user(request)

    try:
        return library_summary(
            user["id"],
        )
    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        _handle(error)


@router.get("/activity")
async def developer_library_activity(
    request: Request,
    limit: int = 100,
):
    """Return Developer Library activity logs."""

    user = get_current_user(request)

    try:
        return activity_logs(
            user["id"],
            limit,
        )
    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        _handle(error)


@router.post("")
async def developer_library_create(
    request: Request,
    institution_id: Annotated[
        int,
        Form(...),
    ],
    title: Annotated[
        str,
        Form(...),
    ],
    resource_type: Annotated[
        str,
        Form(...),
    ],
    author: Annotated[
        str | None,
        Form(),
    ] = None,
    isbn: Annotated[
        str | None,
        Form(),
    ] = None,
    category: Annotated[
        str | None,
        Form(),
    ] = None,
    subject: Annotated[
        str | None,
        Form(),
    ] = None,
    description: Annotated[
        str | None,
        Form(),
    ] = None,
    language: Annotated[
        str | None,
        Form(),
    ] = None,
    publication_year: Annotated[
        int | None,
        Form(),
    ] = None,
    tags: Annotated[
        str | None,
        Form(),
    ] = None,
    status: Annotated[
        str,
        Form(),
    ] = "DRAFT",
    featured: Annotated[
        bool,
        Form(),
    ] = False,
    resource_file: Annotated[
        UploadFile | None,
        File(),
    ] = None,
    cover_file: Annotated[
        UploadFile | None,
        File(),
    ] = None,
):
    """Create a new Developer Library resource."""

    user = get_current_user(request)

    file_info = None
    cover_info = None

    try:
        require_verified_developer(
            user["id"],
        )

        file_info = await _save_upload(
            resource_file,
            ALLOWED_RESOURCE_EXTENSIONS,
            "resource",
        )

        cover_info = await _save_upload(
            cover_file,
            ALLOWED_COVER_EXTENSIONS,
            "cover",
        )

        data = LibraryResourceCreate(
            institution_id=institution_id,
            title=title,
            resource_type=resource_type,
            author=author,
            isbn=isbn,
            category=category,
            subject=subject,
            description=description,
            language=language,
            publication_year=publication_year,
            tags=tags,
            status=status,
            featured=featured,
        )

        return create_resource(
            user["id"],
            data,
            file_info,
            cover_info,
            institution_id,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        for info in (
            file_info,
            cover_info,
        ):
            if info and info.get("path"):
                try:
                    os.remove(
                        info["path"],
                    )
                except OSError:
                    pass

        _handle(error)


@router.put("/{resource_id}")
async def developer_library_update(
    resource_id: int,
    request: Request,
    institution_id: Annotated[
        int | None,
        Form(),
    ] = None,
    title: Annotated[
        str | None,
        Form(),
    ] = None,
    resource_type: Annotated[
        str | None,
        Form(),
    ] = None,
    author: Annotated[
        str | None,
        Form(),
    ] = None,
    isbn: Annotated[
        str | None,
        Form(),
    ] = None,
    category: Annotated[
        str | None,
        Form(),
    ] = None,
    subject: Annotated[
        str | None,
        Form(),
    ] = None,
    description: Annotated[
        str | None,
        Form(),
    ] = None,
    language: Annotated[
        str | None,
        Form(),
    ] = None,
    publication_year: Annotated[
        int | None,
        Form(),
    ] = None,
    tags: Annotated[
        str | None,
        Form(),
    ] = None,
    status: Annotated[
        str | None,
        Form(),
    ] = None,
    featured: Annotated[
        bool | None,
        Form(),
    ] = None,
    resource_file: Annotated[
        UploadFile | None,
        File(),
    ] = None,
    cover_file: Annotated[
        UploadFile | None,
        File(),
    ] = None,
):
    """Update an existing Developer Library resource."""

    user = get_current_user(request)

    file_info = None
    cover_info = None

    try:
        require_verified_developer(
            user["id"],
        )

        values = {
            key: value
            for key, value in {
                "institution_id": institution_id,
                "title": title,
                "resource_type": resource_type,
                "author": author,
                "isbn": isbn,
                "category": category,
                "subject": subject,
                "description": description,
                "language": language,
                "publication_year": publication_year,
                "tags": tags,
                "status": status,
                "featured": featured,
            }.items()
            if value is not None
        }

        file_info = await _save_upload(
            resource_file,
            ALLOWED_RESOURCE_EXTENSIONS,
            "resource",
        )

        cover_info = await _save_upload(
            cover_file,
            ALLOWED_COVER_EXTENSIONS,
            "cover",
        )

        data = LibraryResourceUpdate(
            **values,
        )

        return update_resource(
            user["id"],
            resource_id,
            data,
            file_info,
            cover_info,
            institution_id,
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        for info in (
            file_info,
            cover_info,
        ):
            if info and info.get("path"):
                try:
                    os.remove(
                        info["path"],
                    )
                except OSError:
                    pass

        _handle(error)


@router.delete("/{resource_id}")
async def developer_library_delete(
    resource_id: int,
    request: Request,
):
    """Delete a Developer Library resource."""

    user = get_current_user(request)

    try:
        return delete_resource(
            user["id"],
            resource_id,
        )
    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        _handle(error)


@router.get("/{resource_id}/download")
async def developer_library_download(
    resource_id: int,
    request: Request,
):
    """Download a Developer Library resource."""

    user = get_current_user(request)

    try:
        row = get_resource_for_download(
            resource_id,
            user["id"],
        )

        return FileResponse(
            row["resource_file_path"],
            filename=(
                row.get("original_file_name")
                or f"resource-{resource_id}"
            ),
            media_type=(
                row.get("mime_type")
                or "application/octet-stream"
            ),
        )

    except (
        BadRequestError,
        ConflictError,
        ForbiddenError,
        NotFoundError,
    ) as error:
        _handle(error)