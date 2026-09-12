"""Developer profile service."""

from app.core.exceptions import (
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection


def _get_developer_user(
    cursor,
    user_id: int,
    verified: bool = False,
):
    """Fetch and validate a Developer account."""

    cursor.execute(
        """
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.role_id,
            u.profile_completed,
            u.verification_status,
            u.is_active,
            u.is_super_admin,
            r.name AS role
        FROM users u
        LEFT JOIN roles r
            ON r.id = u.role_id
        WHERE u.id = %s
        LIMIT 1
        """,
        (user_id,),
    )

    user = cursor.fetchone()

    if not user:
        raise NotFoundError(
            "Developer account not found"
        )

    if not bool(user["is_active"]):
        raise ForbiddenError(
            "Developer account is inactive"
        )

    if user["role"] != "DEVELOPER":
        raise ForbiddenError(
            "Developer role required"
        )

    if bool(user["is_super_admin"]):
        raise ForbiddenError(
            "Super Admin accounts do not use the Developer flow"
        )

    if verified and user["verification_status"] != "VERIFIED":
        raise ForbiddenError(
            "Developer account requires Super Admin verification"
        )

    return user


def require_verified_developer(
    user_id: int,
):
    """Require the Developer to be verified by a Super Admin."""

    connection = get_connection()

    try:
        cursor = connection.cursor()

        return _get_developer_user(
            cursor,
            user_id,
            verified=True,
        )

    finally:
        connection.close()