from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# GET PROGRAMS
# ============================================================


def get_programs(institution_id=None):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT
                p.id,
                p.institution_id,
                i.name AS institution_name,
                i.university_code,

                p.name,
                p.code,
                p.degree,
                p.duration_years,
                p.is_active,
                p.created_at,
                p.updated_at

            FROM programs p

            INNER JOIN institutions i
                ON p.institution_id = i.id
        """

        params = []

        if institution_id is not None:

            query += """
                WHERE p.institution_id = %s
            """

            params.append(institution_id)

        query += """
            ORDER BY
                p.name ASC
        """

        cursor.execute(
            query,
            tuple(params),
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# CREATE PROGRAM
# ============================================================


def create_program(data):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        institution_id = data.institution_id
        name = data.name.strip()
        code = data.code.strip().upper()
        degree = data.degree.strip()

        # ----------------------------------------------------
        # Validate text
        # ----------------------------------------------------

        if not name:
            raise BadRequestError(
                "Program name cannot be empty"
            )

        if not code:
            raise BadRequestError(
                "Program code cannot be empty"
            )

        if not degree:
            raise BadRequestError(
                "Degree cannot be empty"
            )

        # ----------------------------------------------------
        # Check institution
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name
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

        # ----------------------------------------------------
        # Check duplicate program code
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM programs
            WHERE institution_id = %s
              AND code = %s
            LIMIT 1
            """,
            (
                institution_id,
                code,
            ),
        )

        existing_program = cursor.fetchone()

        if existing_program:
            raise ConflictError(
                "A program with this code already exists "
                "in this institution"
            )

        # ----------------------------------------------------
        # Create program
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO programs (
                institution_id,
                name,
                code,
                degree,
                duration_years,
                is_active
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                institution_id,
                name,
                code,
                degree,
                data.duration_years,
                data.is_active,
            ),
        )

        program_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Program created successfully",
            "program_id": program_id,
            "institution_id": institution_id,
            "name": name,
            "code": code,
            "degree": degree,
            "duration_years": data.duration_years,
            "is_active": data.is_active,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE PROGRAM
# ============================================================


def update_program(
    program_id,
    data,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id
            FROM programs
            WHERE id = %s
            LIMIT 1
            """,
            (program_id,),
        )

        program = cursor.fetchone()

        if not program:
            raise NotFoundError(
                "Program not found"
            )

        name = data.name.strip()
        code = data.code.strip().upper()
        degree = data.degree.strip()

        # ----------------------------------------------------
        # Validate text
        # ----------------------------------------------------

        if not name:
            raise BadRequestError(
                "Program name cannot be empty"
            )

        if not code:
            raise BadRequestError(
                "Program code cannot be empty"
            )

        if not degree:
            raise BadRequestError(
                "Degree cannot be empty"
            )

        # ----------------------------------------------------
        # Check duplicate code
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM programs
            WHERE institution_id = %s
              AND code = %s
              AND id != %s
            LIMIT 1
            """,
            (
                program["institution_id"],
                code,
                program_id,
            ),
        )

        existing_program = cursor.fetchone()

        if existing_program:
            raise ConflictError(
                "Another program with this code already "
                "exists in this institution"
            )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE programs
            SET
                name = %s,
                code = %s,
                degree = %s,
                duration_years = %s,
                is_active = %s
            WHERE id = %s
            """,
            (
                name,
                code,
                degree,
                data.duration_years,
                data.is_active,
                program_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Program could not be updated"
            )

        connection.commit()

        return {
            "message": "Program updated successfully",
            "program_id": program_id,
            "name": name,
            "code": code,
            "degree": degree,
            "duration_years": data.duration_years,
            "is_active": data.is_active,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE PROGRAM
# ============================================================


def delete_program(program_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id,
                name,
                code
            FROM programs
            WHERE id = %s
            LIMIT 1
            """,
            (program_id,),
        )

        program = cursor.fetchone()

        if not program:
            raise NotFoundError(
                "Program not found"
            )

        # ----------------------------------------------------
        # Check course dependency
        #
        # Courses currently reference programs.
        # Do not allow deletion while courses exist.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM courses
            WHERE program_id = %s
            LIMIT 1
            """,
            (program_id,),
        )

        course = cursor.fetchone()

        if course:
            raise ConflictError(
                "Cannot delete this program because "
                "it is used by a course"
            )

        # ----------------------------------------------------
        # Check timetable dependency
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM timetables
            WHERE program_id = %s
            LIMIT 1
            """,
            (program_id,),
        )

        timetable = cursor.fetchone()

        if timetable:
            raise ConflictError(
                "Cannot delete this program because "
                "it is used in a timetable"
            )

        # ----------------------------------------------------
        # Check student dependency
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM student_profiles
            WHERE program_id = %s
            LIMIT 1
            """,
            (program_id,),
        )

        student = cursor.fetchone()

        if student:
            raise ConflictError(
                "Cannot delete this program because "
                "it is assigned to a student"
            )

        # ----------------------------------------------------
        # Delete
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM programs
            WHERE id = %s
            """,
            (program_id,),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Program could not be deleted"
            )

        connection.commit()

        return {
            "message": "Program deleted successfully",
            "program_id": program_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()