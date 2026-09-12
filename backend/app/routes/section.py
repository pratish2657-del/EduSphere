from fastapi import APIRouter, HTTPException, Query, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.middleware.auth_guard import require_admin
from app.schemas.section import (
    SectionCreate,
    SectionUpdate,
)
from app.services.section_service import (
    create_section,
    delete_section,
    get_sections,
    update_section,
)

router = APIRouter(
    prefix="/sections",
    tags=["Sections"],
)


# ============================================================
# GET SECTIONS
#
# GET /sections/
# GET /sections/?program_id=1
# GET /sections/?institution_id=1
# ============================================================


@router.get("/")
async def list_sections(
    request: Request,
    program_id: int | None = Query(
        default=None,
        description="Optional program filter",
    ),
    institution_id: int | None = Query(
        default=None,
        description="Optional institution filter",
    ),
):

    require_admin(request)

    try:

        sections = get_sections(
            program_id=program_id,
            institution_id=institution_id,
        )

        return {
            "count": len(sections),
            "sections": sections,
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
            detail="Unable to retrieve sections",
        ) from error


# ============================================================
# CREATE SECTION
#
# POST /sections/
# ============================================================


@router.post("/")
async def create_section_route(
    request: Request,
    data: SectionCreate,
):

    require_admin(request)

    try:

        return create_section(data)

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
            detail="Unable to create section",
        ) from error


# ============================================================
# UPDATE SECTION
#
# PUT /sections/{section_id}
# ============================================================


@router.put("/{section_id}")
async def update_section_route(
    section_id: int,
    request: Request,
    data: SectionUpdate,
):

    require_admin(request)

    try:

        return update_section(
            section_id=section_id,
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
            detail="Unable to update section",
        ) from error


# ============================================================
# DELETE SECTION
#
# DELETE /sections/{section_id}
# ============================================================


@router.delete("/{section_id}")
async def delete_section_route(
    section_id: int,
    request: Request,
):

    require_admin(request)

    try:

        return delete_section(
            section_id=section_id,
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
            detail="Unable to delete section",
        ) from error