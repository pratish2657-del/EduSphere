from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.database import get_connection

# ============================================================
# CONSTANTS
# ============================================================


VALID_DAYS = {
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
}


# ============================================================
# STUDENT — GET TIMETABLE
# ============================================================


def get_student_timetable(user_id, day=None):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Get student
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                sp.user_id,
                sp.institution_id,
                sp.program_id,
                sp.section_id,
                sp.academic_year,
                sp.current_year,
                sp.semester,

                p.name AS program_name,
                p.code AS program_code,

                s.name AS section_name,
                s.code AS section_code

            FROM student_profiles sp

            INNER JOIN users u
                ON sp.user_id = u.id

            INNER JOIN programs p
                ON sp.program_id = p.id

            INNER JOIN sections s
                ON sp.section_id = s.id

            WHERE sp.user_id = %s
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

        # ----------------------------------------------------
        # Validate section belongs to program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM sections
            WHERE id = %s
              AND program_id = %s
            LIMIT 1
            """,
            (
                student["section_id"],
                student["program_id"],
            ),
        )

        section = cursor.fetchone()

        if not section:
            raise ForbiddenError(
                "Student section does not belong to "
                "the student's program"
            )

        # ----------------------------------------------------
        # Build timetable query
        # ----------------------------------------------------

        query = """
            SELECT
                t.id AS timetable_id,

                t.institution_id,
                t.program_id,
                t.section_id,

                t.academic_year,
                t.current_year,

                t.day,
                t.start_time,
                t.end_time,
                t.room,

                c.id AS course_id,
                c.name AS course_name,
                c.code AS course_code,
                c.semester AS course_semester,

                p.name AS program_name,
                p.code AS program_code,

                s.name AS section_name,
                s.code AS section_code,

                pp.id AS professor_id,
                pu.full_name AS professor_name

            FROM timetables t

            INNER JOIN courses c
                ON t.course_id = c.id

            INNER JOIN programs p
                ON t.program_id = p.id

            INNER JOIN sections s
                ON t.section_id = s.id

            LEFT JOIN professor_profiles pp
                ON t.professor_id = pp.id

            LEFT JOIN users pu
                ON pp.user_id = pu.id

            WHERE t.institution_id = %s
              AND t.program_id = %s
              AND t.section_id = %s
              AND c.institution_id = %s
              AND c.program_id = %s
              AND c.semester = %s
        """

        params = [
            student["institution_id"],
            student["program_id"],
            student["section_id"],
            student["institution_id"],
            student["program_id"],
            student["semester"],
        ]

        # ----------------------------------------------------
        # Optional day
        # ----------------------------------------------------

        if day:

            normalized_day = day.strip().upper()

            if normalized_day not in VALID_DAYS:
                raise BadRequestError(
                    "Invalid day"
                )

            query += """
                AND UPPER(t.day) = %s
            """

            params.append(normalized_day)

        # ----------------------------------------------------
        # Ordering
        # ----------------------------------------------------

        query += """
            ORDER BY
                FIELD(
                    UPPER(t.day),
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY'
                ),
                t.start_time
        """

        cursor.execute(
            query,
            tuple(params),
        )

        timetable = cursor.fetchall()

        return {
            "student": {
                "institution_id": student[
                    "institution_id"
                ],
                "program_id": student[
                    "program_id"
                ],
                "program_name": student[
                    "program_name"
                ],
                "program_code": student[
                    "program_code"
                ],
                "section_id": student[
                    "section_id"
                ],
                "section_name": student[
                    "section_name"
                ],
                "section_code": student[
                    "section_code"
                ],
                "academic_year": student[
                    "academic_year"
                ],
                "current_year": student[
                    "current_year"
                ],
                "semester": student[
                    "semester"
                ],
            },
            "count": len(timetable),
            "timetable": timetable,
        }

    finally:
        connection.close()


# ============================================================
# ADMIN — CREATE TIMETABLE
# ============================================================


def create_timetable(data):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Normalize values
        # ----------------------------------------------------

        day = data.day.strip().upper()
        academic_year = data.academic_year.strip()
        room = data.room.strip()

        # ----------------------------------------------------
        # Validate text
        # ----------------------------------------------------

        if not academic_year:
            raise BadRequestError(
                "Academic year cannot be empty"
            )

        if not room:
            raise BadRequestError(
                "Room cannot be empty"
            )

        # ----------------------------------------------------
        # Validate day
        # ----------------------------------------------------

        if day not in VALID_DAYS:
            raise BadRequestError(
                "Invalid day"
            )

        # ----------------------------------------------------
        # Validate time
        # ----------------------------------------------------

        if data.start_time >= data.end_time:
            raise BadRequestError(
                "Start time must be before end time"
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
            (data.institution_id,),
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
                code
            FROM programs
            WHERE id = %s
            LIMIT 1
            """,
            (data.program_id,),
        )

        program = cursor.fetchone()

        if not program:
            raise NotFoundError(
                "Program not found"
            )

        if program["institution_id"] != data.institution_id:
            raise ForbiddenError(
                "Program does not belong to this institution"
            )

        # ----------------------------------------------------
        # Check section
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
            (data.section_id,),
        )

        section = cursor.fetchone()

        if not section:
            raise NotFoundError(
                "Section not found"
            )

        if section["program_id"] != data.program_id:
            raise ForbiddenError(
                "Section does not belong to this program"
            )

        # ----------------------------------------------------
        # Check course
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
            (data.course_id,),
        )

        course = cursor.fetchone()

        if not course:
            raise NotFoundError(
                "Course not found"
            )

        if course["institution_id"] != data.institution_id:
            raise ForbiddenError(
                "Course does not belong to this institution"
            )

        # ----------------------------------------------------
        # Course must belong to program
        # ----------------------------------------------------

        if course["program_id"] != data.program_id:
            raise ForbiddenError(
                "Course does not belong to this program"
            )

        # ----------------------------------------------------
        # Check timetable overlap
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM timetables
            WHERE institution_id = %s
              AND program_id = %s
              AND section_id = %s
              AND academic_year = %s
              AND current_year = %s
              AND UPPER(day) = %s
              AND start_time < %s
              AND end_time > %s

            LIMIT 1
            """,
            (
                data.institution_id,
                data.program_id,
                data.section_id,
                academic_year,
                data.current_year,
                day,
                data.end_time,
                data.start_time,
            ),
        )

        conflict = cursor.fetchone()

        if conflict:
            raise ConflictError(
                "Timetable conflict: another class already "
                "exists during this time"
            )

        # ----------------------------------------------------
        # Insert timetable
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO timetables (
                institution_id,
                program_id,
                section_id,
                course_id,
                academic_year,
                current_year,
                day,
                start_time,
                end_time,
                room
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
                %s
            )
            """,
            (
                data.institution_id,
                data.program_id,
                data.section_id,
                data.course_id,
                academic_year,
                data.current_year,
                day,
                data.start_time,
                data.end_time,
                room,
            ),
        )

        timetable_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Timetable created successfully",
            "timetable_id": timetable_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADMIN — UPDATE TIMETABLE
# ============================================================


def update_timetable(
    timetable_id,
    data,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Normalize
        # ----------------------------------------------------

        day = data.day.strip().upper()
        academic_year = data.academic_year.strip()
        room = data.room.strip()

        # ----------------------------------------------------
        # Validate
        # ----------------------------------------------------

        if day not in VALID_DAYS:
            raise BadRequestError(
                "Invalid day"
            )

        if not academic_year:
            raise BadRequestError(
                "Academic year cannot be empty"
            )

        if not room:
            raise BadRequestError(
                "Room cannot be empty"
            )

        if data.start_time >= data.end_time:
            raise BadRequestError(
                "Start time must be before end time"
            )

        # ----------------------------------------------------
        # Find timetable
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id
            FROM timetables
            WHERE id = %s
            LIMIT 1
            """,
            (timetable_id,),
        )

        timetable = cursor.fetchone()

        if not timetable:
            raise NotFoundError(
                "Timetable entry not found"
            )

        institution_id = timetable[
            "institution_id"
        ]

        # ----------------------------------------------------
        # Check program
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
            (data.program_id,),
        )

        program = cursor.fetchone()

        if not program:
            raise NotFoundError(
                "Program not found"
            )

        if program["institution_id"] != institution_id:
            raise ForbiddenError(
                "Program does not belong to this institution"
            )

        # ----------------------------------------------------
        # Check section
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
            (data.section_id,),
        )

        section = cursor.fetchone()

        if not section:
            raise NotFoundError(
                "Section not found"
            )

        if section["program_id"] != data.program_id:
            raise ForbiddenError(
                "Section does not belong to this program"
            )

        # ----------------------------------------------------
        # Check course
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
            (data.course_id,),
        )

        course = cursor.fetchone()

        if not course:
            raise NotFoundError(
                "Course not found"
            )

        if course["institution_id"] != institution_id:
            raise ForbiddenError(
                "Course does not belong to this institution"
            )

        if course["program_id"] != data.program_id:
            raise ForbiddenError(
                "Course does not belong to this program"
            )

        # ----------------------------------------------------
        # Check conflict
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM timetables
            WHERE institution_id = %s
              AND program_id = %s
              AND section_id = %s
              AND academic_year = %s
              AND current_year = %s
              AND UPPER(day) = %s
              AND start_time < %s
              AND end_time > %s
              AND id != %s

            LIMIT 1
            """,
            (
                institution_id,
                data.program_id,
                data.section_id,
                academic_year,
                data.current_year,
                day,
                data.end_time,
                data.start_time,
                timetable_id,
            ),
        )

        conflict = cursor.fetchone()

        if conflict:
            raise ConflictError(
                "Timetable conflict: another class already "
                "exists during this time"
            )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE timetables
            SET
                program_id = %s,
                section_id = %s,
                course_id = %s,
                academic_year = %s,
                current_year = %s,
                day = %s,
                start_time = %s,
                end_time = %s,
                room = %s

            WHERE id = %s
            """,
            (
                data.program_id,
                data.section_id,
                data.course_id,
                academic_year,
                data.current_year,
                day,
                data.start_time,
                data.end_time,
                room,
                timetable_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Timetable could not be updated"
            )

        connection.commit()

        return {
            "message": "Timetable updated successfully",
            "timetable_id": timetable_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADMIN — DELETE TIMETABLE
# ============================================================


def delete_timetable(timetable_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM timetables
            WHERE id = %s
            LIMIT 1
            """,
            (timetable_id,),
        )

        timetable = cursor.fetchone()

        if not timetable:
            raise NotFoundError(
                "Timetable entry not found"
            )

        cursor.execute(
            """
            DELETE FROM timetables
            WHERE id = %s
            """,
            (timetable_id,),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Timetable entry could not be deleted"
            )

        connection.commit()

        return {
            "message": "Timetable deleted successfully",
            "timetable_id": timetable_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# PROFESSOR — GET OWN TIMETABLE
# ============================================================


def get_professor_timetable(
    user_id,
    day=None,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT
                t.id AS timetable_id,

                t.institution_id,
                t.program_id,
                t.section_id,

                t.day,
                t.start_time,
                t.end_time,
                t.room,

                t.academic_year,
                t.current_year,

                p.name AS program_name,
                p.code AS program_code,

                s.name AS section_name,
                s.code AS section_code,

                c.id AS course_id,
                c.name AS course_name,
                c.code AS course_code,

                pp.id AS professor_id,
                u.full_name AS professor_name

            FROM timetables t

            INNER JOIN professor_profiles pp
                ON t.professor_id = pp.id

            INNER JOIN users u
                ON pp.user_id = u.id

            INNER JOIN courses c
                ON t.course_id = c.id

            INNER JOIN programs p
                ON t.program_id = p.id

            INNER JOIN sections s
                ON t.section_id = s.id

            WHERE pp.user_id = %s
              AND u.is_active = TRUE
        """

        params = [user_id]

        if day:

            normalized_day = day.strip().upper()

            if normalized_day not in VALID_DAYS:
                raise BadRequestError(
                    "Invalid day"
                )

            query += """
                AND UPPER(t.day) = %s
            """

            params.append(normalized_day)

        query += """
            ORDER BY
                FIELD(
                    UPPER(t.day),
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY'
                ),
                t.start_time
        """

        cursor.execute(
            query,
            tuple(params),
        )

        timetable = cursor.fetchall()

        return {
            "count": len(timetable),
            "timetable": timetable,
        }

    finally:
        connection.close()


# ============================================================
# ADMIN — LIST VERIFIED PROFESSORS
# ============================================================


def get_admin_professors(user_id):
    """Return active, verified professors belonging to the admin's institution."""
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT institution_id
            FROM admin_profiles
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        admin = cursor.fetchone()

        if not admin:
            raise NotFoundError("Admin profile not found")

        institution_id = admin["institution_id"]

        cursor.execute(
            """
            SELECT
                pp.id AS professor_id,
                pp.user_id,
                u.full_name,
                u.email,
                pp.department,
                pp.designation,
                (
                    SELECT pv.status
                    FROM professor_verifications pv
                    WHERE pv.professor_id = pp.id
                    ORDER BY pv.id DESC
                    LIMIT 1
                ) AS verification_status
            FROM professor_profiles pp
            INNER JOIN users u
                ON pp.user_id = u.id
            INNER JOIN roles r
                ON u.role_id = r.id
            WHERE pp.institution_id = %s
              AND u.is_active = TRUE
              AND r.name = 'PROFESSOR'
              AND EXISTS (
                    SELECT 1
                    FROM professor_verifications pv
                    WHERE pv.professor_id = pp.id
                      AND pv.status = 'VERIFIED'
              )
            ORDER BY u.full_name ASC, u.email ASC
            """,
            (institution_id,),
        )

        professors = cursor.fetchall()

        return {
            "institution_id": institution_id,
            "count": len(professors),
            "professors": professors,
        }

    finally:
        connection.close()


# ============================================================
# ADMIN — ASSIGN PROFESSOR
# ============================================================


def assign_professor(
    timetable_id,
    professor_id,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Check timetable
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id
            FROM timetables
            WHERE id = %s
            LIMIT 1
            """,
            (timetable_id,),
        )

        timetable = cursor.fetchone()

        if not timetable:
            raise NotFoundError(
                "Timetable entry not found"
            )

        # ----------------------------------------------------
        # Remove professor
        # ----------------------------------------------------

        if professor_id is None:

            cursor.execute(
                """
                UPDATE timetables
                SET professor_id = NULL
                WHERE id = %s
                """,
                (timetable_id,),
            )

            connection.commit()

            return {
                "message": "Professor assignment removed",
                "timetable_id": timetable_id,
                "professor_id": None,
            }

        # ----------------------------------------------------
        # Check professor
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                pp.id,
                pp.institution_id,
                u.is_active,
                r.name AS role,
                (
                    SELECT pv.status
                    FROM professor_verifications pv
                    WHERE pv.professor_id = pp.id
                    ORDER BY pv.id DESC
                    LIMIT 1
                ) AS verification_status

            FROM professor_profiles pp

            INNER JOIN users u
                ON pp.user_id = u.id

            INNER JOIN roles r
                ON u.role_id = r.id

            WHERE pp.id = %s
            LIMIT 1
            """,
            (professor_id,),
        )

        professor = cursor.fetchone()

        if not professor:
            raise NotFoundError(
                "Professor not found"
            )

        if not professor["is_active"]:
            raise UnauthorizedError(
                "Professor account is inactive"
            )

        if professor["role"] != "PROFESSOR":
            raise ForbiddenError(
                "Selected user is not a PROFESSOR"
            )

        if professor["verification_status"] != "VERIFIED":
            raise ForbiddenError(
                "Professor is not verified"
            )

        if (
            professor["institution_id"]
            != timetable["institution_id"]
        ):
            raise ForbiddenError(
                "Professor does not belong to this institution"
            )

        # ----------------------------------------------------
        # Assign
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE timetables
            SET professor_id = %s
            WHERE id = %s
            """,
            (
                professor_id,
                timetable_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Professor assignment could not be completed"
            )

        connection.commit()

        return {
            "message": "Professor assigned successfully",
            "timetable_id": timetable_id,
            "professor_id": professor_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()
def get_admin_timetable(user_id, program_id=None, section_id=None, day=None):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT institution_id
            FROM admin_profiles
            WHERE user_id = %s
            LIMIT 1
            """,
            (user_id,),
        )

        admin = cursor.fetchone()

        if not admin:
            raise NotFoundError("Admin profile not found")

        institution_id = admin["institution_id"]

        query = """
            SELECT
                t.id AS timetable_id,
                t.institution_id,
                t.program_id,
                t.section_id,
                t.course_id,
                t.academic_year,
                t.current_year,
                t.day,
                t.start_time,
                t.end_time,
                t.room,

                p.name AS program_name,
                p.code AS program_code,

                s.name AS section_name,
                s.code AS section_code,

                c.name AS course_name,
                c.code AS course_code,
                c.semester AS course_semester,

                pp.id AS professor_id,
                pu.full_name AS professor_name,
                pu.email AS professor_email

            FROM timetables t

            INNER JOIN programs p
                ON t.program_id = p.id

            INNER JOIN sections s
                ON t.section_id = s.id

            INNER JOIN courses c
                ON t.course_id = c.id

            LEFT JOIN professor_profiles pp
                ON t.professor_id = pp.id

            LEFT JOIN users pu
                ON pp.user_id = pu.id

            WHERE t.institution_id = %s
        """

        params = [institution_id]

        if program_id is not None:
            query += " AND t.program_id = %s"
            params.append(program_id)

        if section_id is not None:
            query += " AND t.section_id = %s"
            params.append(section_id)

        if day:
            normalized_day = day.strip().upper()

            if normalized_day not in VALID_DAYS:
                raise BadRequestError("Invalid day")

            query += " AND UPPER(t.day) = %s"
            params.append(normalized_day)

        query += """
            ORDER BY
                FIELD(
                    UPPER(t.day),
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY'
                ),
                t.start_time,
                p.code,
                s.code
        """

        cursor.execute(query, tuple(params))

        timetable = cursor.fetchall()

        return {
            "institution_id": institution_id,
            "count": len(timetable),
            "timetable": timetable,
        }

    finally:
        connection.close()