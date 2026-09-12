from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.middleware.auth_guard import require_admin
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
)
from app.services.course_service import (
    create_course,
    delete_course,
    get_courses,
    update_course,
)

router = APIRouter(
    prefix="/courses",
    tags=["Courses"],
)


# ============================================================
# LIST COURSES
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.get("/")
async def list_courses(
    request: Request,
    institution_id: int | None = None,
):

    require_admin(request)

    try:

        courses = get_courses(
            institution_id=institution_id,
        )

        return {
            "count": len(courses),
            "courses": courses,
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve courses",
        ) from error


# ============================================================
# CREATE COURSE
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.post("/")
async def create_course_route(
    request: Request,
    data: CourseCreate,
):

    require_admin(request)

    try:

        result = create_course(
    institution_id=data.institution_id,
    program_id=data.program_id,
    name=data.name,
    code=data.code,
    semester=data.semester,
)

        return result

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

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to create course",
        ) from error


# ============================================================
# UPDATE COURSE
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.put("/{course_id}")
async def update_course_route(
    course_id: int,
    request: Request,
    data: CourseUpdate,
):

    require_admin(request)

    try:

        result = update_course(
            course_id=course_id,
            name=data.name,
            code=data.code,
            semester=data.semester,
        )

        return result

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

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to update course",
        ) from error


# ============================================================
# DELETE COURSE
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.delete("/{course_id}")
async def delete_course_route(
    course_id: int,
    request: Request,
):

    require_admin(request)

    try:

        result = delete_course(
            course_id=course_id,
        )

        return result

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

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to delete course",
        ) from error