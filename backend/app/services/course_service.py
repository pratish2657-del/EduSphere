from app.core.exceptions import (
    ConflictError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# GET COURSES
# ============================================================


def get_courses(institution_id=None):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT
                c.id,

                c.institution_id,
                i.name AS institution_name,
                i.university_code,

                c.program_id,
                p.name AS program_name,
                p.code AS program_code,
                p.degree AS program_degree,

                c.name,
                c.code,
                c.semester,
                c.created_at

            FROM courses c

            INNER JOIN institutions i
                ON c.institution_id = i.id

            LEFT JOIN programs p
                ON c.program_id = p.id
        """

        params = []

        if institution_id is not None:

            query += """
                WHERE c.institution_id = %s
            """

            params.append(institution_id)

        query += """
            ORDER BY
                c.semester ASC,
                c.name ASC
        """

        cursor.execute(
            query,
            tuple(params),
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# CREATE COURSE
# ============================================================


def create_course(
    institution_id,
    program_id,
    name,
    code,
    semester,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

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
        # Check program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id,
                name,
                code,
                degree,
                is_active
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
        # Program must belong to selected institution
        # ----------------------------------------------------

        if program["institution_id"] != institution_id:
            raise ConflictError(
                "Program does not belong to this institution"
            )

        # ----------------------------------------------------
        # Program must be active
        # ----------------------------------------------------

        if not bool(program["is_active"]):
            raise ConflictError(
                "Program is inactive"
            )

        # ----------------------------------------------------
        # Check duplicate course code
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM courses
            WHERE institution_id = %s
              AND code = %s
            LIMIT 1
            """,
            (
                institution_id,
                code,
            ),
        )

        existing_course = cursor.fetchone()

        if existing_course:
            raise ConflictError(
                "A course with this code already exists "
                "in this institution"
            )

        # ----------------------------------------------------
        # Create course
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO courses (
                institution_id,
                program_id,
                name,
                code,
                semester
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                institution_id,
                program_id,
                name,
                code,
                semester,
            ),
        )

        course_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Course created successfully",
            "course_id": course_id,
            "institution_id": institution_id,
            "program_id": program_id,
            "name": name,
            "code": code,
            "semester": semester,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE COURSE
# ============================================================


def update_course(
    course_id,
    name,
    code,
    semester,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find course
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id,
                program_id
            FROM courses
            WHERE id = %s
            LIMIT 1
            """,
            (course_id,),
        )

        course = cursor.fetchone()

        if not course:
            raise NotFoundError(
                "Course not found"
            )

        # ----------------------------------------------------
        # Check duplicate course code
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM courses
            WHERE institution_id = %s
              AND code = %s
              AND id != %s
            LIMIT 1
            """,
            (
                course["institution_id"],
                code,
                course_id,
            ),
        )

        existing_course = cursor.fetchone()

        if existing_course:
            raise ConflictError(
                "Another course with this code already "
                "exists in this institution"
            )

        # ----------------------------------------------------
        # Update course
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE courses
            SET
                name = %s,
                code = %s,
                semester = %s
            WHERE id = %s
            """,
            (
                name,
                code,
                semester,
                course_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Course could not be updated"
            )

        connection.commit()

        return {
            "message": "Course updated successfully",
            "course_id": course_id,
            "name": name,
            "code": code,
            "semester": semester,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE COURSE
# ============================================================


def delete_course(course_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find course
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id,
                program_id,
                name,
                code,
                semester
            FROM courses
            WHERE id = %s
            LIMIT 1
            """,
            (course_id,),
        )

        course = cursor.fetchone()

        if not course:
            raise NotFoundError(
                "Course not found"
            )

        # ----------------------------------------------------
        # Check timetable dependency
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM timetables
            WHERE course_id = %s
            LIMIT 1
            """,
            (course_id,),
        )

        timetable = cursor.fetchone()

        if timetable:
            raise ConflictError(
                "Cannot delete this course because "
                "it is used in a timetable. "
                "Remove the timetable entries first."
            )

        # ----------------------------------------------------
        # Delete course
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM courses
            WHERE id = %s
            """,
            (course_id,),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Course could not be deleted"
            )

        connection.commit()

        return {
            "message": "Course deleted successfully",
            "course_id": course_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()