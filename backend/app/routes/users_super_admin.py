from fastapi import APIRouter, HTTPException, Query, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin
from app.schemas.user import UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/manage/all")
async def list_all_users(
    request: Request,
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
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

        if role and role.upper() in {
            "STUDENT", "PROFESSOR", "ADMIN", "DEVELOPER", "SUPER_ADMIN"
        }:
            conditions.append("r.name = %s")
            params.append(role.upper())

        if status and status.upper() in {"ACTIVE", "INACTIVE"}:
            conditions.append("u.is_active = %s")
            params.append(status.upper() == "ACTIVE")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

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
            LEFT JOIN roles r ON u.role_id = r.id
            {where}
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
            LEFT JOIN roles r ON u.role_id = r.id
            {where}
            """,
            tuple(params),
        )
        total = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) AS inactive
            FROM users
        """)
        stats = cursor.fetchone()

        cursor.execute("""
            SELECT r.name AS role, COUNT(u.id) AS count
            FROM roles r
            LEFT JOIN users u ON u.role_id = r.id
            GROUP BY r.id, r.name
            ORDER BY r.name
        """)
        role_rows = cursor.fetchall()

        return {
            "count": len(users),
            "total": total,
            "offset": offset,
            "limit": limit,
            "users": users,
            "stats": stats,
            "role_counts": role_rows,
        }
    finally:
        connection.close()


@router.get("/email/{email}")
async def find_user(email: str, request: Request):
    require_super_admin(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                u.id, u.full_name, u.email, u.profile_completed,
                u.verification_status, u.is_active,
                u.is_super_admin, u.created_at,
                r.name AS role
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.email = %s
            LIMIT 1
        """, (email,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        connection.close()


@router.get("/{user_id}")
async def get_user(user_id: int, request: Request):
    require_super_admin(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                u.id, u.full_name, u.email, u.profile_completed,
                u.verification_status, u.is_active,
                u.is_super_admin, u.created_at,
                r.name AS role
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = %s
            LIMIT 1
        """, (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        connection.close()


@router.put("/{user_id}")
async def update_user_route(
    user_id: int,
    request: Request,
    data: UserUpdate,
):
    super_admin = require_super_admin(request)

    if user_id == super_admin["id"]:
        raise HTTPException(
            status_code=403,
            detail="The Super Admin account cannot be modified here",
        )

    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, is_super_admin
            FROM users
            WHERE id = %s
            LIMIT 1
        """, (user_id,))
        target = cursor.fetchone()

        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if bool(target["is_super_admin"]):
            raise HTTPException(
                status_code=403,
                detail="A Super Admin account cannot be modified here",
            )

        cursor.execute("""
            SELECT id
            FROM roles
            WHERE name = %s
            LIMIT 1
        """, (data.role.upper(),))

        role_row = cursor.fetchone()
        if not role_row:
            raise HTTPException(status_code=400, detail="Invalid role")

        cursor.execute("""
            SELECT id
            FROM users
            WHERE email = %s
              AND id <> %s
            LIMIT 1
        """, (str(data.email), user_id))

        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email already exists")

        cursor.execute("""
            UPDATE users
            SET
                full_name = %s,
                email = %s,
                role_id = %s,
                is_active = %s
            WHERE id = %s
        """, (
            data.full_name.strip(),
            str(data.email),
            role_row["id"],
            bool(data.is_active),
            user_id,
        ))

        connection.commit()

        cursor.execute("""
            SELECT
                u.id, u.full_name, u.email, u.profile_completed,
                u.verification_status, u.is_active,
                u.is_super_admin, u.created_at,
                r.name AS role
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = %s
            LIMIT 1
        """, (user_id,))

        return cursor.fetchone()
    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update user",
        ) from error
    finally:
        connection.close()
