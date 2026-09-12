from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
)
from app.middleware.auth_guard import require_admin
from app.schemas.professor_verification import (
    ProfessorVerificationDecision,
)
from app.services.professor_verification_service import (
    get_pending_professors,
    get_professor_verification,
    reject_professor,
    verify_professor,
)

router = APIRouter(
    prefix="/professor-verifications",
    tags=["Professor Verification"],
)


# ============================================================
# LIST PENDING PROFESSORS
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.get("/pending")
async def list_pending_professors(
    request: Request,
):

    require_admin(request)

    try:

        professors = get_pending_professors()

        return {
            "count": len(professors),
            "professors": professors,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve pending professors",
        ) from error


# ============================================================
# GET PROFESSOR VERIFICATION
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.get("/{professor_id}")
async def get_professor(
    professor_id: int,
    request: Request,
):

    require_admin(request)

    try:

        return get_professor_verification(
            professor_id=professor_id,
        )

    except NotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve professor verification",
        ) from error


# ============================================================
# VERIFY PROFESSOR
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.put("/{professor_id}/verify")
async def verify_professor_route(
    professor_id: int,
    request: Request,
    data: ProfessorVerificationDecision,
):

    admin = require_admin(request)

    try:

        return verify_professor(
            professor_id=professor_id,
            admin_user_id=admin["id"],
            remarks=data.remarks,
        )

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

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to verify professor",
        ) from error


# ============================================================
# REJECT PROFESSOR
#
# ADMIN + SUPER_ADMIN
# ============================================================


@router.put("/{professor_id}/reject")
async def reject_professor_route(
    professor_id: int,
    request: Request,
    data: ProfessorVerificationDecision,
):

    admin = require_admin(request)

    try:

        return reject_professor(
            professor_id=professor_id,
            admin_user_id=admin["id"],
            remarks=data.remarks,
        )

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

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to reject professor",
        ) from error