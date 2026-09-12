from fastapi import APIRouter, HTTPException, Request

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.middleware.auth_guard import require_super_admin
from app.schemas.developer_profile import DeveloperVerificationDecision
from app.services.developer_management_service import (
    all_verification_requests,
    pending_developers,
    super_admin_activity_logs,
    verify_developer,
)

router=APIRouter(prefix="/super-admin/developer-verifications",tags=["Developer Verification"])

def _handle(error):
    mapping={BadRequestError:400,ConflictError:409,ForbiddenError:403,NotFoundError:404}
    for typ,status in mapping.items():
        if isinstance(error,typ): raise HTTPException(status_code=status,detail=str(error)) from error
    raise error

@router.get("/pending")
async def pending(request: Request):
    admin=require_super_admin(request)
    try: return pending_developers(admin["id"])
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)

@router.get("")
async def all_requests(request: Request,status: str|None=None):
    admin=require_super_admin(request)
    try: return all_verification_requests(admin["id"],status)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)

@router.put("/{user_id}/verify")
async def verify(user_id:int,request:Request,data:DeveloperVerificationDecision):
    admin=require_super_admin(request)
    try: return verify_developer(admin["id"],user_id,data.status,data.remarks)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)

@router.get("/activity/logs")
async def logs(request: Request,limit:int=200):
    admin=require_super_admin(request)
    try: return super_admin_activity_logs(admin["id"],limit)
    except (BadRequestError,ConflictError,ForbiddenError,NotFoundError) as error: _handle(error)
