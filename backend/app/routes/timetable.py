from fastapi import APIRouter, HTTPException, Query, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.middleware.auth_guard import (
    require_admin,
    require_professor,
    require_student,
)
from app.schemas.timetable import (
    ProfessorAssignment,
    TimetableCreate,
    TimetableUpdate,
)
from app.services.timetable_service import (
    assign_professor,
    create_timetable,
    delete_timetable,
    get_admin_professors,
    get_admin_timetable,
    get_professor_timetable,
    get_student_timetable,
    update_timetable,
)

router = APIRouter(
    prefix="/timetable",
    tags=["Timetable"],
)


# ============================================================
# OPTIONAL DAY FILTER
# ============================================================


OPTIONAL_DAY = Query(
    default=None,
    description="Optional day filter, e.g. Monday",
)


# ============================================================
# STUDENT — VIEW OWN SECTION TIMETABLE
# ============================================================


@router.get("/")
async def student_timetable(
    request: Request,
    day: str | None = OPTIONAL_DAY,
):

    student = require_student(request)

    try:
        return get_student_timetable(
            user_id=student["id"],
            day=day,
        )

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve student timetable",
        ) from error


# ============================================================
# PROFESSOR — VIEW OWN ASSIGNED TIMETABLE
# ============================================================


@router.get("/professor")
async def professor_timetable(
    request: Request,
    day: str | None = OPTIONAL_DAY,
):

    professor = require_professor(request)

    try:
        return get_professor_timetable(
            user_id=professor["id"],
            day=day,
        )

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve professor timetable",
        ) from error


# ============================================================
# ADMIN — PROFESSOR LIST
# ============================================================


@router.get("/admin/professors")
async def admin_professors(request: Request):
    admin = require_admin(request)

    try:
        return get_admin_professors(user_id=admin["id"])

    except UnauthorizedError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error

    except ForbiddenError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    except BadRequestError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve verified professors",
        ) from error


# ============================================================
# ADMIN — CREATE
# ============================================================


@router.post("/")
async def create_timetable_route(
    request: Request,
    data: TimetableCreate,
):

    require_admin(request)

    try:
        return create_timetable(data)

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to create timetable",
        ) from error


# ============================================================
# ADMIN — UPDATE
# ============================================================


@router.put("/{timetable_id}")
async def update_timetable_route(
    timetable_id: int,
    request: Request,
    data: TimetableUpdate,
):

    require_admin(request)

    try:
        return update_timetable(
            timetable_id=timetable_id,
            data=data,
        )

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to update timetable",
        ) from error


# ============================================================
# ADMIN — DELETE
# ============================================================


@router.delete("/{timetable_id}")
async def delete_timetable_route(
    timetable_id: int,
    request: Request,
):

    require_admin(request)

    try:
        return delete_timetable(
            timetable_id=timetable_id,
        )

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to delete timetable",
        ) from error


# ============================================================
# ADMIN — ASSIGN PROFESSOR
# ============================================================


@router.put(
    "/{timetable_id}/assign-professor"
)
async def assign_professor_route(
    timetable_id: int,
    request: Request,
    data: ProfessorAssignment,
):

    require_admin(request)

    try:
        return assign_professor(
            timetable_id=timetable_id,
            professor_id=data.professor_id,
        )

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except BadRequestError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to assign professor",
        ) from error
# ============================================================
# ADMIN — VIEW / MANAGE INSTITUTION TIMETABLE
#
# Add Query to the FastAPI imports:
# from fastapi import APIRouter, HTTPException, Query, Request
#
# Add get_admin_timetable to the timetable_service imports.
#
# IMPORTANT:
# Keep this route BEFORE /{timetable_id} routes.
# ============================================================

@router.get("/admin")
async def admin_timetable(
    request: Request,
    program_id: int | None = Query(default=None, ge=1),
    section_id: int | None = Query(default=None, ge=1),
    day: str | None = Query(default=None),
):
    admin = require_admin(request)

    try:
        return get_admin_timetable(
            user_id=admin["id"],
            program_id=program_id,
            section_id=section_id,
            day=day,
        )

    except UnauthorizedError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error

    except ForbiddenError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    except BadRequestError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve institution timetable",
        ) from error
