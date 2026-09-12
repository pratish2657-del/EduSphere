from fastapi import APIRouter, Request

from app.middleware.auth_guard import (
    require_completed_profile,
    require_super_admin,
)

router = APIRouter(
    prefix="/protected",
    tags=["Protected"],
)


# ============================================================
# PLATFORM ACCESS
#
# ALL COMPLETED USERS
# ============================================================


@router.get("/platform")
async def platform_access(request: Request):

    user = require_completed_profile(request)

    return {
        "message": "You can access EduSphere",
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "profile_completed": bool(
            user["profile_completed"]
        ),
    }


# ============================================================
# SUPER ADMIN ACCESS
#
# SUPER_ADMIN ONLY
# ============================================================


@router.get("/super-admin")
async def super_admin_access(request: Request):

    user = require_super_admin(request)

    return {
        "message": "Super Admin access granted",
        "email": user["email"],
        "role": user["role"],
        "is_super_admin": bool(
            user["is_super_admin"]
        ),
    }