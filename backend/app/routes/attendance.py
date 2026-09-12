from datetime import date

from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
)
from app.middleware.auth_guard import require_completed_profile
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate
from app.services.attendance_service import (
    create_attendance,
    get_attendance,
    get_attendance_summary,
    get_course_attendance,
    get_student_attendance,
    update_attendance,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


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
# CREATE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


@router.post("/")
async def create_attendance_route(
    request: Request,
    data: AttendanceCreate,
):

    user = require_completed_profile(request)

    try:
        return create_attendance(
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
# STUDENT ATTENDANCE
# STUDENT — OWN ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


@router.get("/student/{student_id}")
async def student_attendance_route(
    student_id: int,
    request: Request,
    course_id: int | None = None,
):

    user = require_completed_profile(request)

    try:
        return get_student_attendance(
            student_id=student_id,
            user_id=user["id"],
            course_id=course_id,
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
# ATTENDANCE SUMMARY
# ============================================================


@router.get("/student/{student_id}/course/{course_id}/summary")
async def attendance_summary_route(
    student_id: int,
    course_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_attendance_summary(
            student_id=student_id,
            user_id=user["id"],
            course_id=course_id,
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
# COURSE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


@router.get("/course/{course_id}")
async def course_attendance_route(
    course_id: int,
    request: Request,
    attendance_date: date | None = None,
):

    user = require_completed_profile(request)

    try:
        return get_course_attendance(
            course_id=course_id,
            user_id=user["id"],
            attendance_date=attendance_date,
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
# GET ATTENDANCE BY ID
# ============================================================


@router.get("/{attendance_id}")
async def get_attendance_route(
    attendance_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_attendance(
            attendance_id=attendance_id,
            user_id=user["id"],
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
# UPDATE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


@router.put("/{attendance_id}")
async def update_attendance_route(
    attendance_id: int,
    request: Request,
    data: AttendanceUpdate,
):

    user = require_completed_profile(request)

    try:
        return update_attendance(
            attendance_id=attendance_id,
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