from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.middleware.auth_guard import require_completed_profile
from app.schemas.ai import AIAskRequest, AIAskResponse
from app.services.ai_service import ask_ai

router = APIRouter(prefix="/ai", tags=["AI"])


# ============================================================
# AI HOME
# ============================================================


@router.get("/")
async def ai_home(request: Request):

    user = require_completed_profile(request)

    return {
        "message": "EduSphere AI is available",
        "user_id": user["id"],
        "role": user["role"],
    }


# ============================================================
# ASK AI
# ============================================================


@router.post("/ask", response_model=AIAskResponse)
async def ask_ai_route(
    request: Request,
    data: AIAskRequest,
):

    user = require_completed_profile(request)

    try:
        result = ask_ai(
            user_id=user["id"],
            role=user["role"],
            message=data.message,
            course_id=data.course_id,
            additional_context=data.context,
        )

        # ----------------------------------------------------
        # AI unavailable
        # ----------------------------------------------------

        if not result["ai_available"]:
            raise HTTPException(
                status_code=503,
                detail=result,
            )

        return result

    except HTTPException:
        raise

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

    except ServiceUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error