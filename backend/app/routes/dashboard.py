from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
)
from app.middleware.auth_guard import require_student
from app.services.student_service import get_student_profile

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ============================================================
# STUDENT DASHBOARD
# ============================================================


@router.get("/")
async def dashboard(request: Request):

    user = require_student(request)

    try:
        student = get_student_profile(user["id"])

        return {
            "message": "Welcome to EduSphere Student Dashboard",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["full_name"],
                "role": user["role"],
                "profile_completed": bool(
                    user["profile_completed"]
                ),
            },
            "student": student,
        }

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

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load student dashboard",
        ) from error