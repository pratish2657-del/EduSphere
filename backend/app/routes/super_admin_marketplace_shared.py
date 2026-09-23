from fastapi import APIRouter, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin

# ============================================================
# SUPER ADMIN SHARED MARKETPLACE CONTEXT
# ============================================================
#
# This router does NOT create a separate marketplace.
# It only provides platform-level context needed by the
# shared /marketplace/* UI when a Super Admin is using it.
# ============================================================


router = APIRouter(
    prefix="/super-admin/marketplace",
    tags=["Super Admin Marketplace Shared"],
)


# ============================================================
# SUPER ADMIN AUTHENTICATION
# ============================================================


def _super_admin(request: Request):
    return require_super_admin(request)


# ============================================================
# INSTITUTIONS
# ============================================================


@router.get("/institutions")
async def marketplace_institutions(
    request: Request,
):
    require_super_admin(request)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                name,
                university_code
            FROM institutions
            ORDER BY name ASC
            """
        )

        institutions = cursor.fetchall()

        return {
            "count": len(institutions),
            "institutions": institutions,
        }

    finally:
        connection.close()