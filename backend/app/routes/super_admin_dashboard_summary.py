from fastapi import APIRouter, HTTPException, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin

router = APIRouter(
    prefix="/super-admin/dashboard",
    tags=["Super Admin Dashboard"],
)


@router.get("/summary")
async def get_super_admin_dashboard_summary(request: Request):
    require_super_admin(request)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM institutions
        """)
        institutions = int(cursor.fetchone()["total"] or 0)

        cursor.execute("""
            SELECT
                COUNT(*) AS total_users,
                COALESCE(SUM(
                    CASE WHEN u.is_active = TRUE THEN 1 ELSE 0 END
                ), 0) AS active_users,
                COALESCE(SUM(
                    CASE WHEN u.is_active = FALSE THEN 1 ELSE 0 END
                ), 0) AS inactive_users,
                COALESCE(SUM(
                    CASE WHEN r.name = 'STUDENT' THEN 1 ELSE 0 END
                ), 0) AS students,
                COALESCE(SUM(
                    CASE WHEN r.name = 'PROFESSOR' THEN 1 ELSE 0 END
                ), 0) AS professors,
                COALESCE(SUM(
                    CASE WHEN r.name = 'ADMIN' THEN 1 ELSE 0 END
                ), 0) AS admins
            FROM users u
            LEFT JOIN roles r
                ON u.role_id = r.id
        """)
        user_stats = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM courses
        """)
        courses = int(cursor.fetchone()["total"] or 0)

        return {
            "institutions": institutions,
            "total_institutions": institutions,
            "users": int(user_stats["total_users"] or 0),
            "total_users": int(user_stats["total_users"] or 0),
            "students": int(user_stats["students"] or 0),
            "total_students": int(user_stats["students"] or 0),
            "professors": int(user_stats["professors"] or 0),
            "total_professors": int(user_stats["professors"] or 0),
            "admins": int(user_stats["admins"] or 0),
            "total_admins": int(user_stats["admins"] or 0),
            "courses": courses,
            "total_courses": courses,
            "active_users": int(user_stats["active_users"] or 0),
            "inactive_users": int(user_stats["inactive_users"] or 0),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve Super Admin platform statistics",
        ) from error
    finally:
        connection.close()
