from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.middleware.auth_guard import get_current_user
from app.schemas.developer_profile import DeveloperProfileCreate
from app.services.developer_management_service import (
    get_developer_profile,
    save_developer_profile,
)

router=APIRouter(prefix="/developer",tags=["Developer Profile"])

def _handle(error):
    mapping={BadRequestError:400,ConflictError:409,ForbiddenError:403,NotFoundError:404}
    for typ,status in mapping.items():
        if isinstance(error,typ): raise HTTPException(status_code=status,detail=str(error)) from error
    raise error

@router.get("/profile")
async def get_profile(request: Request):
    user=get_current_user(request)
    try: return get_developer_profile(user["id"])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)

@router.post("/profile")
async def create_profile(request: Request,data: DeveloperProfileCreate):
    user=get_current_user(request)
    try: return save_developer_profile(user["id"],data)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)

@router.put("/profile")
async def update_profile(request: Request,data: DeveloperProfileCreate):
    user=get_current_user(request)
    try: return save_developer_profile(user["id"],data)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)
