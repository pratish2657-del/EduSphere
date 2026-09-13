from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.middleware.auth_guard import get_current_user
from app.schemas.library import LibraryResourceCreate, LibraryResourceUpdate
from app.services.library_service import (
    create_super_admin_resource,
    delete_super_admin_resource,
    get_super_admin_download,
    list_super_admin_library,
    update_super_admin_resource,
)

router = APIRouter(prefix="/super-admin/library", tags=["Super Admin Library"])


def _handle(error: Exception) -> None:
    mapping = {
        BadRequestError: 400,
        ForbiddenError: 403,
        NotFoundError: 404,
    }
    for error_type, status_code in mapping.items():
        if isinstance(error, error_type):
            raise HTTPException(status_code=status_code, detail=str(error)) from error
    raise error


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
        return list_super_admin_library(
            get_current_user(request),
            institution_id,
            search,
            resource_type,
            status,
            featured,
        )
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.post("")
async def super_admin_library_create(
    request: Request,
    institution_id: Annotated[int, Form(...)],
    title: Annotated[str, Form(...)],
    resource_type: Annotated[str, Form(...)],
    author: Annotated[str | None, Form()] = None,
    isbn: Annotated[str | None, Form()] = None,
    category: Annotated[str | None, Form()] = None,
    subject: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    language: Annotated[str | None, Form()] = None,
    publication_year: Annotated[int | None, Form()] = None,
    tags: Annotated[str | None, Form()] = None,
    status: Annotated[str, Form()] = "PUBLISHED",
    featured: Annotated[bool, Form()] = False,
    resource_file: Annotated[UploadFile | None, File()] = None,
    cover_file: Annotated[UploadFile | None, File()] = None,
):
    try:
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
        return create_super_admin_resource(
            get_current_user(request),
            data,
            resource_file,
            cover_file,
        )
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.put("/{resource_id}")
async def super_admin_library_update(
    resource_id: int,
    request: Request,
    institution_id: Annotated[int | None, Form()] = None,
    title: Annotated[str | None, Form()] = None,
    resource_type: Annotated[str | None, Form()] = None,
    author: Annotated[str | None, Form()] = None,
    isbn: Annotated[str | None, Form()] = None,
    category: Annotated[str | None, Form()] = None,
    subject: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    language: Annotated[str | None, Form()] = None,
    publication_year: Annotated[int | None, Form()] = None,
    tags: Annotated[str | None, Form()] = None,
    status: Annotated[str | None, Form()] = None,
    featured: Annotated[bool | None, Form()] = None,
    resource_file: Annotated[UploadFile | None, File()] = None,
    cover_file: Annotated[UploadFile | None, File()] = None,
):
    try:
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
        data = LibraryResourceUpdate(**values)
        return update_super_admin_resource(
            get_current_user(request),
            resource_id,
            data,
            resource_file,
            cover_file,
        )
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.delete("/{resource_id}")
async def super_admin_library_delete(resource_id: int, request: Request):
    try:
        return delete_super_admin_resource(get_current_user(request), resource_id)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/{resource_id}/download")
async def super_admin_library_download(resource_id: int, request: Request):
    try:
        resource = get_super_admin_download(get_current_user(request), resource_id)
        return RedirectResponse(url=resource["signed_url"], status_code=307)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)
