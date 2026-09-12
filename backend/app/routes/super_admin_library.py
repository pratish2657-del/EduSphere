import os

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.middleware.auth_guard import require_super_admin
from app.schemas.library import LibraryResourceCreate, LibraryResourceUpdate
from app.services.library_service import (
    create_super_admin_resource,
    delete_super_admin_resource,
    get_super_admin_resource,
    list_super_admin_library,
    super_admin_summary,
    update_super_admin_resource,
)

router = APIRouter(prefix="/super-admin/library", tags=["Super Admin Library"])


def _handle(error):
    mapping = {BadRequestError: 400, ForbiddenError: 403, NotFoundError: 404}
    for error_type, status in mapping.items():
        if isinstance(error, error_type):
            raise HTTPException(status_code=status, detail=str(error)) from error
    raise error


def _create_model(
    title: str,
    resource_type: str,
    institution_id: int,
    author: str | None,
    isbn: str | None,
    category: str | None,
    subject: str | None,
    description: str | None,
    language: str | None,
    publication_year: int | None,
    tags: str | None,
    status: str,
    featured: bool,
):
    return LibraryResourceCreate(
        title=title, resource_type=resource_type, institution_id=institution_id,
        author=author, isbn=isbn, category=category, subject=subject, description=description,
        language=language, publication_year=publication_year, tags=tags, status=status, featured=featured,
    )

OPTIONAL_UPLOAD_FILE = File(None)

@router.get("")
async def super_admin_library_list(
    request: Request,
    institution_id: int | None = None,
    search: str | None = None,
    resource_type: str | None = None,
    status: str | None = None,
    featured: bool | None = None,
):
    try:
        return list_super_admin_library(require_super_admin(request), institution_id, search, resource_type, status, featured)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/summary")
async def super_admin_library_summary(request: Request, institution_id: int | None = None):
    try:
        return super_admin_summary(require_super_admin(request), institution_id)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.post("")
async def super_admin_library_create(
    request: Request,
    title: str = Form(...),
    resource_type: str = Form(...),
    institution_id: int = Form(...),
    author: str | None = Form(None),
    isbn: str | None = Form(None),
    category: str | None = Form(None),
    subject: str | None = Form(None),
    description: str | None = Form(None),
    language: str | None = Form(None),
    publication_year: int | None = Form(None),
    tags: str | None = Form(None),
    status: str = Form("PUBLISHED"),
    featured: bool = Form(False),
    resource_file: UploadFile | None = OPTIONAL_UPLOAD_FILE,
    cover_file: UploadFile | None = OPTIONAL_UPLOAD_FILE,
):
    try:
        admin = require_super_admin(request)
        data = _create_model(title, resource_type, institution_id, author, isbn, category, subject, description, language, publication_year, tags, status, featured)
        return create_super_admin_resource(admin, data, resource_file, cover_file)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/{resource_id}")
async def super_admin_library_resource(resource_id: int, request: Request):
    try:
        return get_super_admin_resource(require_super_admin(request), resource_id)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.put("/{resource_id}")
async def super_admin_library_update(
    resource_id: int,
    request: Request,
    title: str | None = Form(None),
    resource_type: str | None = Form(None),
    institution_id: int | None = Form(None),
    author: str | None = Form(None),
    isbn: str | None = Form(None),
    category: str | None = Form(None),
    subject: str | None = Form(None),
    description: str | None = Form(None),
    language: str | None = Form(None),
    publication_year: int | None = Form(None),
    tags: str | None = Form(None),
    status: str | None = Form(None),
    featured: bool | None = Form(None),
    resource_file: UploadFile | None = OPTIONAL_UPLOAD_FILE,
    cover_file: UploadFile | None = OPTIONAL_UPLOAD_FILE,
):
    try:
        admin = require_super_admin(request)
        values = {k: v for k, v in {
            "title": title, "resource_type": resource_type, "institution_id": institution_id,
            "author": author, "isbn": isbn, "category": category, "subject": subject,
            "description": description, "language": language, "publication_year": publication_year,
            "tags": tags, "status": status, "featured": featured,
        }.items() if v is not None}
        data = LibraryResourceUpdate(**values)
        return update_super_admin_resource(admin, resource_id, data, resource_file, cover_file)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.delete("/{resource_id}")
async def super_admin_library_delete(resource_id: int, request: Request):
    try:
        return delete_super_admin_resource(require_super_admin(request), resource_id)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/{resource_id}/download")
async def super_admin_library_download(resource_id: int, request: Request):
    try:
        resource = get_super_admin_resource(require_super_admin(request), resource_id)
        path = resource.get("resource_file_path")
        if not path or not os.path.isfile(path):
            raise NotFoundError("Library file is not available")
        return FileResponse(path, filename=resource.get("original_file_name") or os.path.basename(path), media_type=resource.get("mime_type") or "application/octet-stream")
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)
