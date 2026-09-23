from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.database import get_connection

# ============================================================
# ACADEMIC GROUP VALIDATION
# ============================================================

def _validate_academic_group(
    cursor,
    institution_id,
    program_id,
    section_id,
):
    """
    Validate:

        institution exists
        program exists
        section exists
        section belongs to program

    Returns the academic-group display information.

    student_profiles stores only:
        program_id
        section_id

    Program/section names and codes are resolved through joins.
    """

    # --------------------------------------------------------
    # Institution
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT id
        FROM institutions
        WHERE id = %s
        LIMIT 1
        """,
        (institution_id,),
    )

    institution = cursor.fetchone()

    if not institution:
        raise NotFoundError(
            "Institution not found"
        )

    # --------------------------------------------------------
    # Program + Section
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            p.id AS program_id,
            p.name AS program_name,
            p.code AS program_code,

            s.id AS section_id,
            s.name AS section_name,
            s.code AS section_code

        FROM programs p

        INNER JOIN sections s
            ON s.program_id = p.id

        WHERE p.id = %s
          AND s.id = %s

        LIMIT 1
        """,
        (
            program_id,
            section_id,
        ),
    )

    academic_group = cursor.fetchone()

    if not academic_group:
        raise NotFoundError(
            "Program or section not found"
        )

    return academic_group


# ============================================================
# CREATE STUDENT PROFILE
# ============================================================

def create_student_profile(user_id, data):

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
                u.is_active,
                u.is_super_admin,
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

        if not user["is_active"]:
            raise UnauthorizedError(
                "User account is inactive"
            )

        if user["is_super_admin"]:
            raise ForbiddenError(
                "Super Admin account cannot be changed to STUDENT"
            )

        # ----------------------------------------------------
        # Existing profile
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM student_profiles
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        if cursor.fetchone():
            raise ConflictError(
                "Student profile already exists"
            )

        # ----------------------------------------------------
        # Prevent privileged roles
        # ----------------------------------------------------

        if user["role"] in (
            "ADMIN",
            "SUPER_ADMIN",
            "PROFESSOR",
        ):
            raise ForbiddenError(
                "This account cannot be changed to STUDENT"
            )

        # ----------------------------------------------------
        # Find STUDENT role
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM roles
            WHERE name = 'STUDENT'
            LIMIT 1
            """
        )

        student_role = cursor.fetchone()

        if not student_role:
            raise NotFoundError(
                "STUDENT role does not exist"
            )

        # ----------------------------------------------------
        # Enrollment uniqueness
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM student_profiles
            WHERE enrollment_number = %s
            LIMIT 1
            """,
            (data.enrollment_number,),
        )

        if cursor.fetchone():
            raise ConflictError(
                "Enrollment number already exists"
            )

        # ----------------------------------------------------
        # Student ID uniqueness
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM student_profiles
            WHERE student_id = %s
            LIMIT 1
            """,
            (data.student_id,),
        )

        if cursor.fetchone():
            raise ConflictError(
                "Student ID already exists"
            )

        # ----------------------------------------------------
        # Validate academic group
        # ----------------------------------------------------

        _validate_academic_group(
            cursor=cursor,
            institution_id=data.institution_id,
            program_id=data.program_id,
            section_id=data.section_id,
        )

        # ----------------------------------------------------
        # Insert normalized student profile
        #
        # IMPORTANT:
        #
        # Do NOT insert:
        #     program
        #     stream
        #     section
        #
        # They no longer exist in student_profiles.
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO student_profiles (
                user_id,
                phone,
                upi_id,
                institution_id,
                program_id,
                section_id,
                enrollment_number,
                academic_year,
                current_year,
                semester,
                student_id,
                admission_year
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
                %s,
                %s
            )
            """,
            (
                user_id,
                data.phone,
                str(data.upi_id or '').strip(),
                data.institution_id,
                data.program_id,
                data.section_id,
                data.enrollment_number,
                data.academic_year,
                data.current_year,
                data.semester,
                data.student_id,
                data.admission_year,
            ),
        )

        student_profile_id = cursor.lastrowid

        # ----------------------------------------------------
        # Assign STUDENT role
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users
            SET
                role_id = %s,
                profile_completed = TRUE,
                verification_status = 'NOT_REQUIRED'
            WHERE id = %s
              AND is_super_admin = FALSE
            """,
            (
                student_role["id"],
                user_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ForbiddenError(
                "Student role could not be assigned"
            )

        connection.commit()

        return {
            "message": "Student profile created successfully",
            "student_profile_id": student_profile_id,
            "verification_status": "NOT_REQUIRED",
            "profile_completed": True,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE STUDENT PROFILE
# ============================================================

def update_student_profile(user_id, data):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Verify user
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                u.id,
                u.is_active,
                u.is_super_admin,
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

        if not user["is_active"]:
            raise UnauthorizedError(
                "User account is inactive"
            )

        if user["is_super_admin"]:
            raise ForbiddenError(
                "Super Admin cannot update a student profile"
            )

        if user["role"] != "STUDENT":
            raise ForbiddenError(
                "Student access required"
            )

        # ----------------------------------------------------
        # Find profile
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM student_profiles
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        profile = cursor.fetchone()

        if not profile:
            raise NotFoundError(
                "Student profile not found"
            )

        student_profile_id = profile["id"]

        # ----------------------------------------------------
        # Enrollment uniqueness
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM student_profiles
            WHERE enrollment_number = %s
              AND id != %s
            LIMIT 1
            """,
            (
                data.enrollment_number,
                student_profile_id,
            ),
        )

        if cursor.fetchone():
            raise ConflictError(
                "Enrollment number already exists"
            )

        # ----------------------------------------------------
        # Student ID uniqueness
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM student_profiles
            WHERE student_id = %s
              AND id != %s
            LIMIT 1
            """,
            (
                data.student_id,
                student_profile_id,
            ),
        )

        if cursor.fetchone():
            raise ConflictError(
                "Student ID already exists"
            )

        # ----------------------------------------------------
        # Validate institution/program/section
        # ----------------------------------------------------

        _validate_academic_group(
            cursor=cursor,
            institution_id=data.institution_id,
            program_id=data.program_id,
            section_id=data.section_id,
        )

        # ----------------------------------------------------
        # Update normalized profile
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE student_profiles
            SET
                phone = %s,
                upi_id = %s,
                institution_id = %s,
                program_id = %s,
                section_id = %s,
                enrollment_number = %s,
                academic_year = %s,
                current_year = %s,
                semester = %s,
                student_id = %s,
                admission_year = %s

            WHERE user_id = %s
            """,
            (
                data.phone,
                str(data.upi_id or '').strip(),
                data.institution_id,
                data.program_id,
                data.section_id,
                data.enrollment_number,
                data.academic_year,
                data.current_year,
                data.semester,
                data.student_id,
                data.admission_year,
                user_id,
            ),
        )

        # ----------------------------------------------------
        # Mark profile completed
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users
            SET profile_completed = TRUE
            WHERE id = %s
            """,
            (user_id,),
        )

        connection.commit()

        return {
            "message": "Student profile updated successfully",
            "student_profile_id": student_profile_id,
            "profile_completed": True,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET STUDENT PROFILE
# ============================================================

def get_student_profile(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                u.id AS user_id,
                u.email,
                u.full_name,
                u.profile_completed,
                u.is_active,

                sp.id AS student_profile_id,
                sp.phone,
                sp.upi_id,

                sp.institution_id,
                i.name AS institution_name,
                i.university_code,

                sp.enrollment_number,

                sp.program_id,
                p.name AS program,
                p.code AS program_code,

                sp.section_id,
                s.name AS section,
                s.code AS section_code,

                sp.academic_year,
                sp.current_year,
                sp.semester,

                sp.student_id,
                sp.admission_year

            FROM users u

            INNER JOIN student_profiles sp
                ON sp.user_id = u.id

            INNER JOIN institutions i
                ON sp.institution_id = i.id

            INNER JOIN programs p
                ON sp.program_id = p.id

            INNER JOIN sections s
                ON sp.section_id = s.id
               AND s.program_id = p.id

            WHERE u.id = %s
              AND u.is_active = TRUE

            LIMIT 1
            """,
            (user_id,),
        )

        student = cursor.fetchone()

        if not student:
            raise NotFoundError(
                "Student profile not found"
            )

        return student

    finally:
        connection.close()