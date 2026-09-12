from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.database import get_connection

# ============================================================
# RESOLVE INSTITUTION
#
# Supports both:
#   1. institution_id
#   2. institution_code / university_code
#
# This keeps compatibility with existing backend tests while
# allowing the new frontend to submit Institution Code.
# ============================================================


def _resolve_institution(cursor, data):
    # --------------------------------------------------------
    # Option 1: Numeric institution ID
    # --------------------------------------------------------

    if data.institution_id is not None:
        cursor.execute(
            """
            SELECT id
            FROM institutions
            WHERE id = %s
            LIMIT 1
            """,
            (data.institution_id,),
        )

        institution = cursor.fetchone()

        if not institution:
            raise NotFoundError("Institution not found")

        return institution["id"]

    # --------------------------------------------------------
    # Option 2: Institution / University Code
    # --------------------------------------------------------

    institution_code = (data.institution_code or "").strip()

    if institution_code:
        cursor.execute(
            """
            SELECT id
            FROM institutions
            WHERE university_code = %s
            LIMIT 1
            """,
            (institution_code,),
        )

        institution = cursor.fetchone()

        if not institution:
            raise NotFoundError(
                f"Institution code '{institution_code}' was not found"
            )

        return institution["id"]

    # --------------------------------------------------------
    # Neither supplied
    # --------------------------------------------------------

    raise BadRequestError(
        "Institution ID or institution code is required"
    )


# ============================================================
# CREATE PROFESSOR PROFILE
# ============================================================


def create_professor_profile(user_id, data):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Get user
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                u.id,
                u.role_id,
                u.is_super_admin,
                u.profile_completed,
                u.is_active,
                r.name AS role

            FROM users u

            LEFT JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise NotFoundError("User not found")

        # ----------------------------------------------------
        # Check active account
        # ----------------------------------------------------

        if not user["is_active"]:
            raise UnauthorizedError(
                "User account is inactive"
            )

        # ----------------------------------------------------
        # Super Admin protection
        # ----------------------------------------------------

        if bool(user["is_super_admin"]):
            raise ForbiddenError(
                "Super Admin account cannot be changed to PROFESSOR"
            )

        # ----------------------------------------------------
        # Check existing professor profile
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM professor_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        existing_profile = cursor.fetchone()

        if existing_profile:
            raise ConflictError(
                "Professor profile already exists"
            )

        # ----------------------------------------------------
        # Get PROFESSOR role
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM roles
            WHERE name = 'PROFESSOR'
            LIMIT 1
            """
        )

        professor_role = cursor.fetchone()

        if not professor_role:
            raise NotFoundError(
                "PROFESSOR role does not exist"
            )

        # ----------------------------------------------------
        # Resolve institution
        #
        # Supports:
        #   institution_id
        #   institution_code
        # ----------------------------------------------------

        institution_id = _resolve_institution(
            cursor,
            data,
        )

        # ----------------------------------------------------
        # Create professor profile
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO professor_profiles (
                user_id,
                phone,
                institution_id,
                employee_id,
                department,
                designation,
                specialization,
                subjects,
                academic_experience,
                office_information,
                verification_details
            )

            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                user_id,
                data.phone,
                institution_id,
                data.employee_id,
                data.department,
                data.designation,
                data.specialization,
                data.subjects,
                data.academic_experience,
                data.office_information,
                data.verification_details,
            ),
        )

        professor_id = cursor.lastrowid

        # ----------------------------------------------------
        # Assign PROFESSOR role
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users

            SET
                role_id = %s,
                profile_completed = TRUE,
                verification_status = 'PENDING'

            WHERE id = %s
              AND is_super_admin = FALSE
            """,
            (
                professor_role["id"],
                user_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ForbiddenError(
                "Professor role could not be assigned"
            )

        # ----------------------------------------------------
        # Create verification record
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO professor_verifications (
                professor_id,
                status,
                submitted_at
            )

            VALUES (
                %s,
                'PENDING',
                CURRENT_TIMESTAMP
            )
            """,
            (professor_id,),
        )

        # ----------------------------------------------------
        # Commit
        # ----------------------------------------------------

        connection.commit()

        return {
            "message": "Professor profile submitted successfully",
            "professor_id": professor_id,
            "verification_status": "PENDING",
            "profile_completed": True,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE PROFESSOR PROFILE
# ============================================================


def update_professor_profile(user_id, data):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Get current user
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                u.id,
                u.role_id,
                u.is_super_admin,
                u.is_active,
                r.name AS role

            FROM users u

            LEFT JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise NotFoundError(
                "User not found"
            )

        # ----------------------------------------------------
        # Check active account
        # ----------------------------------------------------

        if not user["is_active"]:
            raise UnauthorizedError(
                "User account is inactive"
            )

        # ----------------------------------------------------
        # Super Admin protection
        # ----------------------------------------------------

        if bool(user["is_super_admin"]):
            raise ForbiddenError(
                "Super Admin account cannot be changed to PROFESSOR"
            )

        # ----------------------------------------------------
        # Only PROFESSOR can update
        # ----------------------------------------------------

        if user["role"] != "PROFESSOR":
            raise ForbiddenError(
                "Professor access required"
            )

        # ----------------------------------------------------
        # Find professor profile
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM professor_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        profile = cursor.fetchone()

        if not profile:
            raise NotFoundError(
                "Professor profile does not exist"
            )

        professor_id = profile["id"]

        # ----------------------------------------------------
        # Get current verification status
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                status
            FROM professor_verifications
            WHERE professor_id = %s
            LIMIT 1
            """,
            (professor_id,),
        )

        verification = cursor.fetchone()

        # ----------------------------------------------------
        # Resolve institution
        #
        # Supports:
        #   institution_id
        #   institution_code
        # ----------------------------------------------------

        institution_id = _resolve_institution(
            cursor,
            data,
        )

        # ----------------------------------------------------
        # Update professor details
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE professor_profiles

            SET
                phone = %s,
                institution_id = %s,
                employee_id = %s,
                department = %s,
                designation = %s,
                specialization = %s,
                subjects = %s,
                academic_experience = %s,
                office_information = %s,
                verification_details = %s

            WHERE user_id = %s
            """,
            (
                data.phone,
                institution_id,
                data.employee_id,
                data.department,
                data.designation,
                data.specialization,
                data.subjects,
                data.academic_experience,
                data.office_information,
                data.verification_details,
                user_id,
            ),
        )

        # ----------------------------------------------------
        # Start a new verification cycle
        # ----------------------------------------------------

        if verification:

            # ------------------------------------------------
            # Still pending
            # ------------------------------------------------

            if verification["status"] == "PENDING":

                cursor.execute(
                    """
                    UPDATE professor_verifications

                    SET
                        status = 'PENDING',
                        submitted_at = CURRENT_TIMESTAMP

                    WHERE professor_id = %s
                    """,
                    (professor_id,),
                )

            # ------------------------------------------------
            # VERIFIED or REJECTED
            #
            # Profile update starts a new review cycle.
            # ------------------------------------------------

            else:

                cursor.execute(
                    """
                    UPDATE professor_verifications

                    SET
                        status = 'PENDING',
                        remarks = NULL,
                        verified_by = NULL,
                        verified_at = NULL,
                        submitted_at = CURRENT_TIMESTAMP

                    WHERE professor_id = %s
                    """,
                    (professor_id,),
                )

        # ----------------------------------------------------
        # Safety fallback if verification record is missing
        # ----------------------------------------------------

        else:

            cursor.execute(
                """
                INSERT INTO professor_verifications (
                    professor_id,
                    status,
                    submitted_at
                )

                VALUES (
                    %s,
                    'PENDING',
                    CURRENT_TIMESTAMP
                )
                """,
                (professor_id,),
            )

        # ----------------------------------------------------
        # Update user verification status
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users

            SET
                profile_completed = TRUE,
                verification_status = 'PENDING'

            WHERE id = %s
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Commit
        # ----------------------------------------------------

        connection.commit()

        return {
            "message": "Professor profile updated and submitted for review",
            "professor_id": professor_id,
            "verification_status": "PENDING",
            "profile_completed": True,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()