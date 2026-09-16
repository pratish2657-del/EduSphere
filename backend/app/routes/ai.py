from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.middleware.auth_guard import require_completed_profile
from app.schemas.ai import (
    AIAskRequest,
    AIAskResponse,
    AIClearResponse,
    AIConversationResponse,
    AIChatMessage,
)
from app.services.ai_service import (
    ask_ai,
    clear_conversation,
    get_conversation_messages,
)

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
# LOAD CURRENT CONVERSATION
# ============================================================

@router.get(
    "/conversation",
    response_model=AIConversationResponse,
)
async def get_ai_conversation(request: Request):
    user = require_completed_profile(request)

    try:
        conversation_id, messages = get_conversation_messages(
            user_id=user["id"],
            conversation_id=None,
            limit=40,
        )

        return {
            "conversation_id": conversation_id,
            "messages": [
                {
                    "id": item["id"],
                    "role": item["role"],
                    "content": item["content"],
                    "created_at": (
                        item["created_at"].isoformat()
                        if hasattr(
                            item["created_at"],
                            "isoformat",
                        )
                        else str(item["created_at"])
                        if item["created_at"] is not None
                        else None
                    ),
                }
                for item in messages
            ],
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to load AI conversation.",
        ) from error


# ============================================================
# ASK AI
# ============================================================

@router.post(
    "/ask",
    response_model=AIAskResponse,
)
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
            conversation_id=data.conversation_id,
        )

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


# ============================================================
# CLEAR CONVERSATION
# ============================================================

@router.delete(
    "/conversation",
    response_model=AIClearResponse,
)
async def clear_ai_conversation(request: Request):
    user = require_completed_profile(request)

    try:
        conversation_id = clear_conversation(
            user_id=user["id"],
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to clear AI conversation.",
        ) from error
