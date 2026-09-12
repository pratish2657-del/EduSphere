from fastapi import APIRouter, HTTPException, Query, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.middleware.auth_guard import require_admin
from app.schemas.program import (
    ProgramCreate,
    ProgramUpdate,
)
from app.services.program_service import (
    create_program,
    delete_program,
    get_programs,
    update_program,
)

router = APIRouter(
    prefix="/programs",
    tags=["Programs"],
)


# ============================================================
# GET PROGRAMS
#
# GET /programs/
# GET /programs/?institution_id=1
# ============================================================


@router.get("/")
async def list_programs(
    request: Request,
    institution_id: int | None = Query(
        default=None,
        description="Optional institution filter",
    ),
):

    require_admin(request)

    try:

        programs = get_programs(
            institution_id=institution_id,
        )

        return {
            "count": len(programs),
            "programs": programs,
        }

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

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve programs",
        ) from error


# ============================================================
# CREATE PROGRAM
#
# POST /programs/
# ============================================================


@router.post("/")
async def create_program_route(
    request: Request,
    data: ProgramCreate,
):

    require_admin(request)

    try:

        return create_program(data)

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
            detail="Unable to create program",
        ) from error


# ============================================================
# UPDATE PROGRAM
#
# PUT /programs/{program_id}
# ============================================================


@router.put("/{program_id}")
async def update_program_route(
    program_id: int,
    request: Request,
    data: ProgramUpdate,
):

    require_admin(request)

    try:

        return update_program(
            program_id=program_id,
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
            detail="Unable to update program",
        ) from error


# ============================================================
# DELETE PROGRAM
#
# DELETE /programs/{program_id}
# ============================================================


@router.delete("/{program_id}")
async def delete_program_route(
    program_id: int,
    request: Request,
):

    require_admin(request)

    try:

        return delete_program(
            program_id=program_id,
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
            detail="Unable to delete program",
        ) from error