from fastapi import APIRouter, HTTPException, Request

from app.middleware.auth_guard import get_connection, require_super_admin
from app.schemas.user import UserUpdate
from app.services.user_service import (
    get_user_by_email,
    get_user_by_id,
    update_user,
)

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


# ============================================================
# FIND USER BY EMAIL
#
# GET /users/email/{email}
#
# SUPER_ADMIN ONLY
# ============================================================


@router.get("/email/{email}")
async def find_user(
    email: str,
    request: Request,
):

    require_super_admin(request)

    try:
        user = get_user_by_email(email)

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        return user

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve user",
        ) from error

@router.get("/manage/all")
async def list_all_users(
    request: Request,
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    require_super_admin(request)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        conditions = []
        params = []

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append("""
                (
                    u.full_name LIKE %s
                    OR u.email LIKE %s
                    OR CAST(u.id AS CHAR) LIKE %s
                )
            """)
            params.extend([term, term, term])

        if role:
            conditions.append("r.name = %s")
            params.append(role.upper())

        if status:
            conditions.append("u.is_active = %s")
            params.append(status.upper() == "ACTIVE")

        where_clause = ""

        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        cursor.execute(
            f"""
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.profile_completed,
                u.verification_status,
                u.is_active,
                u.is_super_admin,
                u.created_at,
                r.name AS role
            FROM users u
            LEFT JOIN roles r
                ON u.role_id = r.id
            {where_clause}
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        )

        users = cursor.fetchall()

        cursor.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM users u
            LEFT JOIN roles r
                ON u.role_id = r.id
            {where_clause}
            """,
            tuple(params),
        )

        total = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE
                        WHEN is_active = TRUE THEN 1
                        ELSE 0
                    END
                ) AS active,
                SUM(
                    CASE
                        WHEN is_active = FALSE THEN 1
                        ELSE 0
                    END
                ) AS inactive
            FROM users
        """)

        stats = cursor.fetchone()

        return {
            "total": total,
            "users": users,
            "stats": stats,
            "limit": limit,
            "offset": offset,
        }

    finally:
        connection.close()
# ============================================================
# GET USER BY ID
#
# GET /users/{user_id}
#
# SUPER_ADMIN ONLY
# ============================================================


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    request: Request,
):

    require_super_admin(request)

    try:
        user = get_user_by_id(user_id)

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        return user

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve user",
        ) from error


# ============================================================
# UPDATE USER
#
# PUT /users/{user_id}
#
# SUPER_ADMIN ONLY
#
# Allowed:
#   full_name
#   email
#   role
#   is_active
#
# is_super_admin CANNOT be changed here.
# ============================================================


@router.put("/{user_id}")
async def update_user_route(
    user_id: int,
    request: Request,
    data: UserUpdate,
):

    super_admin = require_super_admin(request)

    # --------------------------------------------------------
    # Protect the permanent Super Admin account.
    # --------------------------------------------------------

    if user_id == super_admin["id"]:
        raise HTTPException(
            status_code=403,
            detail=(
                "The Super Admin account cannot be modified "
                "through the user management endpoint"
            ),
        )

    try:
        return update_user(
            user_id=user_id,
            full_name=data.full_name,
            email=str(data.email) if data.email else None,
            role=data.role,
            is_active=data.is_active,
        )

    except ValueError as error:

        error_message = str(error)

        if "not found" in error_message.lower():
            raise HTTPException(
                status_code=404,
                detail=error_message,
            ) from error

        if "already exists" in error_message.lower():
            raise HTTPException(
                status_code=409,
                detail=error_message,
            ) from error

        raise HTTPException(
            status_code=400,
            detail=error_message,
        ) from error

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to update user",
        ) from error