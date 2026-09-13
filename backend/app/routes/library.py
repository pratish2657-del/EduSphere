from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.middleware.auth_guard import get_current_user
from app.services.library_service import (
    get_library_download,
    get_library_resource,
    library_summary,
    list_library,
)

router = APIRouter(prefix="/library", tags=["Library"])


def _handle(error):
    mapping = {BadRequestError: 400, ForbiddenError: 403, NotFoundError: 404}
    for error_type, status in mapping.items():
        if isinstance(error, error_type):
            raise HTTPException(status_code=status, detail=str(error)) from error
    raise error


@router.get("")
async def library_list(
    request: Request,
    search: str | None = None,
    resource_type: str | None = None,
    category: str | None = None,
    featured: bool | None = None,
):
    try:
        return list_library(get_current_user(request), search, resource_type, category, featured)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/summary")
async def library_summary_route(request: Request):
    try:
        return library_summary(get_current_user(request))
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/{resource_id}")
async def library_resource(resource_id: int, request: Request):
    try:
        return get_library_resource(get_current_user(request), resource_id)
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)


@router.get("/{resource_id}/download")
async def library_download(resource_id: int, request: Request):
    try:
        resource = get_library_download(get_current_user(request), resource_id)
        return RedirectResponse(
            url=resource["signed_url"],
            status_code=307,
        )
    except (BadRequestError, ForbiddenError, NotFoundError) as error:
        _handle(error)
