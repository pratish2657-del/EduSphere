from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.middleware.auth_guard import require_professor
from app.schemas.professor import ProfessorProfileCreate
from app.services.professor_service import (
    create_professor_profile,
    update_professor_profile,
)

router = APIRouter(
    prefix="/profile",
    tags=["Professor Profile"],
)


# ============================================================
# CREATE PROFESSOR PROFILE
#
# POST /profile/professor
#
# A newly authenticated account may still have role USER/None.
# Creating the profile promotes the account to PROFESSOR.
# ============================================================


@router.post("/professor")
async def create_professor(
    request: Request,
    data: ProfessorProfileCreate,
):
    user = require_professor(request)

    if user["role"] not in (None, "USER", "PROFESSOR"):
        raise HTTPException(
            status_code=403,
            detail="Professor access required",
        )

    try:
        return create_professor_profile(
            user_id=user["id"],
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

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except HTTPException:
        raise

    except Exception as error:
        print("CREATE PROFESSOR ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error


# ============================================================
# UPDATE PROFESSOR PROFILE
#
# PUT /profile/professor
# ============================================================


@router.put("/professor")
async def update_professor(
    request: Request,
    data: ProfessorProfileCreate,
):
    user = require_professor(request)

    try:
        return update_professor_profile(
            user_id=user["id"],
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

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except HTTPException:
        raise

    except Exception as error:
        print("UPDATE PROFESSOR ERROR:", repr(error))
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error
