from fastapi import APIRouter, HTTPException, Query, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin

router = APIRouter(
    prefix="/super-admin/activity",
    tags=["Super Admin Activity"],
)


@router.get("/")
async def get_system_activity(
    request: Request,
    activity_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()

        # The current project does not have a dedicated audit-log table.
        # Build a truthful platform activity feed from existing persisted records.
        sources = []

        if not activity_type or activity_type.upper() == "USER":
            sources.append("""
                SELECT
                    'USER' AS activity_type,
                    u.id AS reference_id,
                    'USER_CREATED' AS action,
                    COALESCE(u.full_name, u.email, 'User') AS subject,
                    u.email AS actor,
                    u.created_at AS occurred_at,
                    CONCAT('User account created (ID ', u.id, ')') AS description
                FROM users u
            """)

        if not activity_type or activity_type.upper() == "ADMIN_APPLICATION":
            sources.append("""
                SELECT
                    'ADMIN_APPLICATION' AS activity_type,
                    av.id AS reference_id,
                    CONCAT('ADMIN_APPLICATION_', av.status) AS action,
                    COALESCE(u.full_name, u.email, CONCAT('User ', av.user_id)) AS subject,
                    verifier.email AS actor,
                    COALESCE(av.verified_at, av.submitted_at) AS occurred_at,
                    CONCAT(
                        'Admin application ',
                        LOWER(av.status),
                        ' for user ID ',
                        av.user_id
                    ) AS description
                FROM admin_verifications av
                LEFT JOIN users u ON u.id = av.user_id
                LEFT JOIN users verifier ON verifier.id = av.verified_by
            """)

        if not activity_type or activity_type.upper() == "COURSE":
            sources.append("""
                SELECT
                    'COURSE' AS activity_type,
                    c.id AS reference_id,
                    'COURSE_CREATED' AS action,
                    c.name AS subject,
                    i.name AS actor,
                    c.created_at AS occurred_at,
                    CONCAT(
                        'Course ',
                        COALESCE(c.code, ''),
                        ' created in ',
                        COALESCE(i.name, 'institution')
                    ) AS description
                FROM courses c
                LEFT JOIN institutions i ON i.id = c.institution_id
            """)

        if not activity_type or activity_type.upper() == "EVENT":
            sources.append("""
                SELECT
                    'EVENT' AS activity_type,
                    e.id AS reference_id,
                    'EVENT_CREATED' AS action,
                    e.title AS subject,
                    u.email AS actor,
                    e.created_at AS occurred_at,
                    CONCAT(
                        'Event created: ',
                        e.title
                    ) AS description
                FROM events e
                LEFT JOIN users u ON u.id = e.created_by
            """)

        if not sources:
            raise HTTPException(status_code=400, detail="Invalid activity type")

        union_sql = " UNION ALL ".join(sources)

        search_clause = ""
        params = []

        if search and search.strip():
            search_clause = """
                WHERE (
                    subject LIKE %s
                    OR actor LIKE %s
                    OR action LIKE %s
                    OR description LIKE %s
                )
            """
            term = f"%{search.strip()}%"
            params.extend([term, term, term, term])

        cursor.execute(
            f"""
            SELECT
                activity_type,
                reference_id,
                action,
                subject,
                actor,
                occurred_at,
                description
            FROM (
                {union_sql}
            ) activity
            {search_clause}
            ORDER BY occurred_at DESC
            LIMIT %s
            """,
            (*params, limit),
        )

        activities = cursor.fetchall()

        return {
            "count": len(activities),
            "activities": activities,
            "note": "Activity is assembled from existing platform records; no dedicated audit-log table is currently present.",
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve system activity",
        ) from error
    finally:
        connection.close()
