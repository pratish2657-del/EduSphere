from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# GET SECTIONS
# ============================================================


def get_sections(
    program_id=None,
    institution_id=None,
):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        query = """
            SELECT
                s.id,
                s.program_id,

                p.name AS program_name,
                p.code AS program_code,

                p.institution_id,
                i.name AS institution_name,
                i.university_code,

                s.name,
                s.code,
                s.batch_start_year,
                s.batch_end_year,
                s.is_active,
                s.created_at,
                s.updated_at

            FROM sections s

            INNER JOIN programs p
                ON s.program_id = p.id

            INNER JOIN institutions i
                ON p.institution_id = i.id
        """

        conditions = []
        params = []

        if program_id is not None:

            conditions.append(
                "s.program_id = %s"
            )

            params.append(program_id)

        if institution_id is not None:

            conditions.append(
                "p.institution_id = %s"
            )

            params.append(institution_id)

        if conditions:

            query += """
                WHERE
            """

            query += " AND ".join(conditions)

        query += """
            ORDER BY
                p.name ASC,
                s.name ASC
        """

        cursor.execute(
            query,
            tuple(params),
        )

        return cursor.fetchall()

    finally:

        connection.close()


# ============================================================
# CREATE SECTION
# ============================================================


def create_section(data):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        program_id = data.program_id
        name = data.name.strip()
        code = data.code.strip().upper()

        # ----------------------------------------------------
        # Validate text
        # ----------------------------------------------------

        if not name:

            raise BadRequestError(
                "Section name cannot be empty"
            )

        if not code:

            raise BadRequestError(
                "Section code cannot be empty"
            )

        # ----------------------------------------------------
        # Validate batch years
        # ----------------------------------------------------

        if data.batch_start_year > data.batch_end_year:

            raise BadRequestError(
                "Batch start year must be before or "
                "equal to batch end year"
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

        if not program["is_active"]:

            raise ForbiddenError(
                "Cannot create a section under an inactive program"
            )

        # ----------------------------------------------------
        # Check duplicate section code
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM sections
            WHERE program_id = %s
              AND code = %s
            LIMIT 1
            """,
            (
                program_id,
                code,
            ),
        )

        existing_section = cursor.fetchone()

        if existing_section:

            raise ConflictError(
                "A section with this code already exists "
                "in this program"
            )

        # ----------------------------------------------------
        # Create
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO sections (
                program_id,
                name,
                code,
                batch_start_year,
                batch_end_year,
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
                program_id,
                name,
                code,
                data.batch_start_year,
                data.batch_end_year,
                data.is_active,
            ),
        )

        section_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Section created successfully",
            "section_id": section_id,
            "program_id": program_id,
            "name": name,
            "code": code,
            "batch_start_year": data.batch_start_year,
            "batch_end_year": data.batch_end_year,
            "is_active": data.is_active,
        }

    except Exception:

        connection.rollback()
        raise

    finally:

        connection.close()


# ============================================================
# UPDATE SECTION
# ============================================================


def update_section(
    section_id,
    data,
):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find section
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                program_id
            FROM sections
            WHERE id = %s
            LIMIT 1
            """,
            (section_id,),
        )

        section = cursor.fetchone()

        if not section:

            raise NotFoundError(
                "Section not found"
            )

        name = data.name.strip()
        code = data.code.strip().upper()

        if not name:

            raise BadRequestError(
                "Section name cannot be empty"
            )

        if not code:

            raise BadRequestError(
                "Section code cannot be empty"
            )

        if data.batch_start_year > data.batch_end_year:

            raise BadRequestError(
                "Batch start year must be before or "
                "equal to batch end year"
            )

        # ----------------------------------------------------
        # Check program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                is_active
            FROM programs
            WHERE id = %s
            LIMIT 1
            """,
            (section["program_id"],),
        )

        program = cursor.fetchone()

        if not program:

            raise NotFoundError(
                "Program not found"
            )

        if not program["is_active"]:

            raise ForbiddenError(
                "Cannot update a section under an inactive program"
            )

        # ----------------------------------------------------
        # Duplicate code
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM sections
            WHERE program_id = %s
              AND code = %s
              AND id != %s
            LIMIT 1
            """,
            (
                section["program_id"],
                code,
                section_id,
            ),
        )

        existing_section = cursor.fetchone()

        if existing_section:

            raise ConflictError(
                "Another section with this code already "
                "exists in this program"
            )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE sections
            SET
                name = %s,
                code = %s,
                batch_start_year = %s,
                batch_end_year = %s,
                is_active = %s
            WHERE id = %s
            """,
            (
                name,
                code,
                data.batch_start_year,
                data.batch_end_year,
                data.is_active,
                section_id,
            ),
        )

        if cursor.rowcount != 1:

            raise ConflictError(
                "Section could not be updated"
            )

        connection.commit()

        return {
            "message": "Section updated successfully",
            "section_id": section_id,
            "program_id": section["program_id"],
            "name": name,
            "code": code,
            "batch_start_year": data.batch_start_year,
            "batch_end_year": data.batch_end_year,
            "is_active": data.is_active,
        }

    except Exception:

        connection.rollback()
        raise

    finally:

        connection.close()


# ============================================================
# DELETE SECTION
# ============================================================


def delete_section(section_id):

    connection = get_connection()

    try:

        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find section
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                program_id,
                name,
                code
            FROM sections
            WHERE id = %s
            LIMIT 1
            """,
            (section_id,),
        )

        section = cursor.fetchone()

        if not section:

            raise NotFoundError(
                "Section not found"
            )

        # ----------------------------------------------------
        # Student dependency
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM student_profiles
            WHERE section_id = %s
            LIMIT 1
            """,
            (section_id,),
        )

        student = cursor.fetchone()

        if student:

            raise ConflictError(
                "Cannot delete this section because "
                "it is assigned to a student"
            )

        # ----------------------------------------------------
        # Timetable dependency
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id
            FROM timetables
            WHERE section_id = %s
            LIMIT 1
            """,
            (section_id,),
        )

        timetable = cursor.fetchone()

        if timetable:

            raise ConflictError(
                "Cannot delete this section because "
                "it is used in a timetable"
            )

        # ----------------------------------------------------
        # Delete
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM sections
            WHERE id = %s
            """,
            (section_id,),
        )

        if cursor.rowcount != 1:

            raise ConflictError(
                "Section could not be deleted"
            )

        connection.commit()

        return {
            "message": "Section deleted successfully",
            "section_id": section_id,
        }

    except Exception:

        connection.rollback()
        raise

    finally:

        connection.close()