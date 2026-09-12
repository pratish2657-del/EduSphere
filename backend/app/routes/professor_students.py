from fastapi import APIRouter, HTTPException, Query, Request

from app.middleware.auth_guard import require_professor
from app.services.professor_students_service import get_professor_students

router = APIRouter(prefix="/professor/students", tags=["Professor Students"])

@router.get("/")
async def professor_students(
    request: Request,
    search: str | None = Query(default=None),
    course_id: int | None = Query(default=None, ge=1),
    semester: int | None = Query(default=None, ge=1),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=100),
):
    professor = require_professor(request)
    try:
        return get_professor_students(professor["id"], search, course_id, semester, page, limit)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Unable to retrieve professor students.") from error
