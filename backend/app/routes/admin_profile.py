from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    UnauthorizedError,
)
from app.middleware.auth_guard import get_current_user
from app.schemas.admin_profile import AdminProfileCreate
from app.services.admin_profile_service import (
    create_admin_profile,
    get_admin_profile,
    update_admin_profile,
)

router=APIRouter(prefix='/profile',tags=['Admin Profile'])

def _error(error):
    mapping={BadRequestError:400,UnauthorizedError:401,ForbiddenError:403,NotFoundError:404,ConflictError:409,ServiceUnavailableError:503}
    for cls,status in mapping.items():
        if isinstance(error,cls): raise HTTPException(status_code=status,detail=str(error))
    raise error

@router.get('/admin')
async def get_admin_profile_route(request: Request):
    user=get_current_user(request)
    try: return get_admin_profile(user['id'])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError,ServiceUnavailableError,UnauthorizedError) as error: _error(error)

@router.post('/admin')
async def create_admin_profile_route(request: Request,data: AdminProfileCreate):
    user=get_current_user(request)
    try: return create_admin_profile(user['id'],data)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError,ServiceUnavailableError,UnauthorizedError) as error: _error(error)

@router.put('/admin')
async def update_admin_profile_route(request: Request,data: AdminProfileCreate):
    user=get_current_user(request)
    try: return update_admin_profile(user['id'],data)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError,ServiceUnavailableError,UnauthorizedError) as error: _error(error)
