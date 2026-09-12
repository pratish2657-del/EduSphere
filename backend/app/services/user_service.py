import os

from app.database import get_connection

ALLOWED_ROLES = {
    "STUDENT",
    "PROFESSOR",
    "ADMIN",
    "DEVELOPER",
    "SUPER_ADMIN",
}


def get_user_by_id(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT
                u.id,
                u.google_id,
                u.email,
                u.full_name,
                u.role_id,
                r.name AS role,
                u.profile_completed,
                u.verification_status,
                u.is_active,
                u.is_super_admin,
                u.created_at,
                u.updated_at
            FROM users u
            LEFT JOIN roles r
                ON u.role_id = r.id
            WHERE u.id = %s
            LIMIT 1
        """

        cursor.execute(query, (user_id,))

        return cursor.fetchone()

    finally:
        connection.close()


def get_user_by_email(email):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT
                u.id,
                u.google_id,
                u.email,
                u.full_name,
                u.role_id,
                r.name AS role,
                u.profile_completed,
                u.verification_status,
                u.is_active,
                u.is_super_admin
            FROM users u
            LEFT JOIN roles r
                ON u.role_id = r.id
            WHERE LOWER(u.email) = LOWER(%s)
            LIMIT 1
        """

        cursor.execute(query, (email.strip().lower(),))

        return cursor.fetchone()

    finally:
        connection.close()


def update_user(
    user_id,
    full_name=None,
    email=None,
    role=None,
    is_active=None,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # FIND USER
        # ====================================================

        cursor.execute(
            """
            SELECT
                id,
                email,
                is_super_admin
            FROM users
            WHERE id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise ValueError("User not found")

        is_super_admin = bool(user["is_super_admin"])

        # ====================================================
        # SUPER ADMIN PROTECTION
        # ====================================================

        if is_super_admin:

            if is_active is False:
                raise ValueError(
                    "The Super Admin account cannot be deactivated"
                )

            if role is not None and role.strip().upper() != "SUPER_ADMIN":
                raise ValueError(
                    "The Super Admin role cannot be changed"
                )

        # ====================================================
        # NORMALIZE ROLE
        # ====================================================

        normalized_role = None

        if role is not None:

            normalized_role = role.strip().upper()

            if normalized_role not in ALLOWED_ROLES:
                raise ValueError("Invalid user role")

        # ====================================================
        # PROTECT SUPER ADMIN ROLE
        # ====================================================

        if normalized_role == "SUPER_ADMIN" and not is_super_admin:
            raise ValueError(
                "SUPER_ADMIN role can only be assigned to "
                "the configured Super Admin account"
            )

        # ====================================================
        # NORMALIZE EMAIL
        # ====================================================

        normalized_email = None

        if email is not None:

            normalized_email = str(email).strip().lower()

            if not normalized_email:
                raise ValueError("Email cannot be empty")

            cursor.execute(
                """
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER(%s)
                  AND id <> %s
                LIMIT 1
                """,
                (
                    normalized_email,
                    user_id,
                ),
            )

            duplicate = cursor.fetchone()

            if duplicate:
                raise ValueError("Email already exists")

        # ====================================================
        # SUPER ADMIN EMAIL PROTECTION
        # ====================================================

        if is_super_admin and normalized_email is not None:

            super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")

            if not super_admin_email:
                raise RuntimeError(
                    "SUPER_ADMIN_EMAIL is not configured"
                )

            super_admin_email = super_admin_email.strip().lower()

            if normalized_email != super_admin_email:
                raise ValueError(
                    "The Super Admin email cannot be changed"
                )

        # ====================================================
        # BUILD UPDATE
        # ====================================================

        updates = []
        values = []

        if full_name is not None:

            normalized_name = full_name.strip()

            if not normalized_name:
                raise ValueError(
                    "Full name cannot be empty"
                )

            updates.append("full_name = %s")
            values.append(normalized_name)

        if normalized_email is not None:

            updates.append("email = %s")
            values.append(normalized_email)

        if normalized_role is not None:

            cursor.execute(
                """
                SELECT id
                FROM roles
                WHERE name = %s
                LIMIT 1
                """,
                (normalized_role,),
            )

            role_record = cursor.fetchone()

            if not role_record:
                raise ValueError(
                    f"{normalized_role} role does not exist"
                )

            updates.append("role_id = %s")
            values.append(role_record["id"])

        if is_active is not None:

            updates.append("is_active = %s")
            values.append(bool(is_active))

        # ====================================================
        # NOTHING TO UPDATE
        # ====================================================

        if not updates:
            raise ValueError(
                "No user fields were provided for update"
            )

        # ====================================================
        # UPDATE DATABASE
        # ====================================================

        values.append(user_id)

        query = f"""
            UPDATE users
            SET {", ".join(updates)}
            WHERE id = %s
        """

        cursor.execute(query, tuple(values))

        connection.commit()

        # ====================================================
        # RETURN UPDATED USER
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.google_id,
                u.email,
                u.full_name,
                u.role_id,
                r.name AS role,
                u.profile_completed,
                u.verification_status,
                u.is_active,
                u.is_super_admin,
                u.created_at,
                u.updated_at
            FROM users u
            LEFT JOIN roles r
                ON u.role_id = r.id
            WHERE u.id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        updated_user = cursor.fetchone()

        if not updated_user:
            raise RuntimeError(
                "Unable to retrieve updated user"
            )

        return {
            "message": "User updated successfully",
            "user": updated_user,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()