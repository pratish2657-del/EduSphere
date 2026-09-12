from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
)
from app.middleware.auth_guard import require_admin, require_super_admin
from app.schemas.admin import (
    AdminCreate,
    AdminStatusUpdate,
    ProfessorVerificationUpdate,
)
from app.services.admin_service import (
    create_admin,
    get_admins,
    get_pending_professors,
    update_admin_status,
    verify_professor,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============================================================
# ERROR HANDLER
# ============================================================


def _handle_service_error(error):
    if isinstance(error, BadRequestError):
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if isinstance(error, UnauthorizedError):
        raise HTTPException(
            status_code=401,
            detail=str(error),
        )

    if isinstance(error, ForbiddenError):
        raise HTTPException(
            status_code=403,
            detail=str(error),
        )

    if isinstance(error, NotFoundError):
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    if isinstance(error, ConflictError):
        raise HTTPException(
            status_code=409,
            detail=str(error),
        )

    if isinstance(error, ServiceUnavailableError):
        raise HTTPException(
            status_code=503,
            detail=str(error),
        )

    raise error


# ============================================================
# PROFESSOR MANAGEMENT
# ADMIN + SUPER_ADMIN
# ============================================================


@router.get("/professors/pending")
async def pending_professors(request: Request):

    require_admin(request)

    try:
        professors = get_pending_professors()

        return {
            "count": len(professors),
            "professors": professors,
        }

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


@router.put("/professors/{professor_id}/verify")
async def verify_professor_route(
    professor_id: int,
    request: Request,
    data: ProfessorVerificationUpdate,
):

    admin = require_admin(request)

    try:
        result = verify_professor(
            professor_id=professor_id,
            admin_user_id=admin["id"],
            status=data.status.upper(),
            remarks=data.remarks,
        )

        return result

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


# ============================================================
# ADMIN MANAGEMENT
# SUPER_ADMIN ONLY
# ============================================================


@router.get("/admins")
async def list_admins(request: Request):

    require_super_admin(request)

    try:
        admins = get_admins()

        return {
            "count": len(admins),
            "admins": admins,
        }

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


@router.post("/admins")
async def create_admin_route(
    request: Request,
    data: AdminCreate,
):

    super_admin = require_super_admin(request)

    try:
        result = create_admin(
            super_admin_id=super_admin["id"],
            google_id=data.google_id,
            email=data.email,
            full_name=data.full_name,
        )

        return result

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)


@router.put("/admins/{admin_id}/status")
async def update_admin_status_route(
    admin_id: int,
    request: Request,
    data: AdminStatusUpdate,
):

    super_admin = require_super_admin(request)

    try:
        result = update_admin_status(
            super_admin_id=super_admin["id"],
            admin_id=admin_id,
            is_active=data.is_active,
        )

        return result

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)
        
# APPEND these routes to app/routes/admin.py

from app.schemas.admin_verification import AdminVerificationUpdate
from app.services.admin_service import get_pending_admin_requests, verify_admin_request


@router.get('/admin-applications/pending')
async def pending_admin_applications(request: Request):
    require_super_admin(request)
    try:
        applications = get_pending_admin_requests()
        return {'count': len(applications), 'applications': applications}
    except (BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError,
            ConflictError, ServiceUnavailableError) as error:
        _handle_service_error(error)


@router.put('/admin-applications/{user_id}/verify')
async def verify_admin_application_route(
    user_id: int, request: Request, data: AdminVerificationUpdate
):
    super_admin = require_super_admin(request)
    try:
        return verify_admin_request(
            super_admin_id=super_admin['id'], user_id=user_id,
            status=data.status.upper(), remarks=data.remarks,
        )
    except (BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError,
            ConflictError, ServiceUnavailableError) as error:
        _handle_service_error(error)

# ============================================================
# ADMIN USERS ROUTE
# Append this section to app/routes/admin.py
# ============================================================

from app.services.admin_service import get_institution_users


@router.get("/users")
async def institution_users(
    request: Request,
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
):
    admin = require_admin(request)

    try:
        return get_institution_users(
            admin_user_id=admin["id"],
            search=search,
            role=role,
            status=status,
            page=page,
            limit=limit,
        )

    except (
        BadRequestError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
        ServiceUnavailableError,
    ) as error:
        _handle_service_error(error)
