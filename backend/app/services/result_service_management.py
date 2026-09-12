
from decimal import Decimal, InvalidOperation

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# RESULT INPUT / SUMMARY HELPERS
# ============================================================

def _resolve_student_profile(
    cursor,
    student_profile_id=None,
    enrollment_number=None,
):
    if enrollment_number:
        enrollment_number = str(enrollment_number).strip()

        cursor.execute(
            """
            SELECT
                id,
                user_id,
                student_id,
                enrollment_number,
                institution_id,
                program_id,
                section_id,
                academic_year,
                current_year,
                semester
            FROM student_profiles
            WHERE enrollment_number = %s
            LIMIT 1
            """,
            (enrollment_number,),
        )
        student = cursor.fetchone()

        if not student:
            raise NotFoundError(
                f"Student with enrollment number '{enrollment_number}' not found"
            )

        if (
            student_profile_id is not None
            and int(student_profile_id) != int(student["id"])
        ):
            raise ConflictError(
                "Enrollment number does not match student profile"
            )

        return student

    if student_profile_id is None:
        raise BadRequestError(
            "Either student_profile_id or enrollment_number is required"
        )

    cursor.execute(
        """
        SELECT
            id,
            user_id,
            student_id,
            enrollment_number,
            institution_id,
            program_id,
            section_id,
            academic_year,
            current_year,
            semester
        FROM student_profiles
        WHERE id = %s
        LIMIT 1
        """,
        (student_profile_id,),
    )
    student = cursor.fetchone()

    if not student:
        raise NotFoundError("Student profile not found")

    return student


def _resolve_course(
    cursor,
    course_id=None,
    subject_code=None,
    institution_id=None,
    program_id=None,
):
    if subject_code:
        subject_code = str(subject_code).strip()

        if institution_id is not None:
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
                WHERE code = %s
                  AND institution_id = %s
                  AND (
                      program_id = %s
                      OR program_id IS NULL
                  )
                ORDER BY
                    CASE
                        WHEN program_id = %s THEN 0
                        ELSE 1
                    END
                LIMIT 1
                """,
                (
                    subject_code,
                    institution_id,
                    program_id,
                    program_id,
                ),
            )
        else:
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
                WHERE code = %s
                LIMIT 1
                """,
                (subject_code,),
            )

        course = cursor.fetchone()

        if not course:
            raise NotFoundError(
                f"Subject with code '{subject_code}' not found for this student's academic group"
            )

        if (
            course_id is not None
            and int(course_id) != int(course["id"])
        ):
            raise ConflictError(
                "Subject code does not match course"
            )

        return course

    if course_id is None:
        raise BadRequestError(
            "Either course_id or subject_code is required"
        )

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
        raise NotFoundError("Course not found")

    return course


def _decimal(value, field_name, minimum=None):
    if value is None:
        return None

    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as error:
        raise BadRequestError(
            f"{field_name} must be a valid number"
        ) from error

    if minimum is not None and number < Decimal(str(minimum)):
        raise BadRequestError(
            f"{field_name} cannot be less than {minimum}"
        )

    return number


def _validate_academic_result_values(data):
    marks = _decimal(data.marks_obtained, "marks_obtained", 0)
    maximum_marks = _decimal(data.maximum_marks, "maximum_marks", 0.01)

    if (marks is None) != (maximum_marks is None):
        raise BadRequestError(
            "marks_obtained and maximum_marks must be provided together"
        )

    if (
        marks is not None
        and maximum_marks is not None
        and marks > maximum_marks
    ):
        raise BadRequestError(
            "Marks obtained cannot be greater than maximum marks"
        )

    grade_point = _decimal(data.grade_point, "grade_point", 0)
    credits = _decimal(data.credits, "credits", 0)
    credit_points = _decimal(data.credit_points, "credit_points", 0)

    if (
        credits is not None
        and credit_points is not None
        and grade_point is not None
    ):
        expected = credits * grade_point
        if abs(credit_points - expected) > Decimal("0.01"):
            raise ConflictError(
                "Credit points must equal credits multiplied by points"
            )

    return (
        marks,
        maximum_marks,
        grade_point,
        credits,
        credit_points,
    )


def _semester_summary(
    cursor,
    student_profile_id,
    academic_year,
    semester,
):
    cursor.execute(
        """
        SELECT
            COALESCE(SUM(credits), 0) AS total_credits,
            COALESCE(SUM(credit_points), 0) AS total_credit_points,
            COUNT(*) AS result_count
        FROM examination_results
        WHERE student_profile_id = %s
          AND academic_year = %s
          AND semester = %s
          AND credits IS NOT NULL
          AND credit_points IS NOT NULL
        """,
        (
            student_profile_id,
            academic_year,
            semester,
        ),
    )

    row = cursor.fetchone() or {}

    total_credits = Decimal(str(row.get("total_credits") or 0))
    total_credit_points = Decimal(
        str(row.get("total_credit_points") or 0)
    )

    sgpa = (
        total_credit_points / total_credits
        if total_credits > 0
        else Decimal(0)
    )

    return {
        "academic_year": academic_year,
        "semester": semester,
        "result_count": int(row.get("result_count") or 0),
        "total_credits": total_credits,
        "total_credit_points": total_credit_points,
        "sgpa": sgpa.quantize(Decimal("0.01")),
    }


def _all_semester_summaries(cursor, student_profile_id):
    cursor.execute(
        """
        SELECT
            academic_year,
            semester,
            COALESCE(SUM(credits), 0) AS total_credits,
            COALESCE(SUM(credit_points), 0) AS total_credit_points,
            COUNT(*) AS result_count
        FROM examination_results
        WHERE student_profile_id = %s
        GROUP BY academic_year, semester
        ORDER BY academic_year DESC, semester DESC
        """,
        (student_profile_id,),
    )

    summaries = []

    for row in cursor.fetchall():
        total_credits = Decimal(str(row["total_credits"] or 0))
        total_credit_points = Decimal(
            str(row["total_credit_points"] or 0)
        )

        sgpa = (
            total_credit_points / total_credits
            if total_credits > 0
            else Decimal(0)
        )

        summaries.append(
            {
                "academic_year": row["academic_year"],
                "semester": row["semester"],
                "result_count": int(row["result_count"] or 0),
                "total_credits": total_credits,
                "total_credit_points": total_credit_points,
                "sgpa": sgpa.quantize(Decimal("0.01")),
            }
        )

    return summaries


# ============================================================
# HELPER — CHECK PROFESSOR ACCESS TO STUDENT/COURSE
# ============================================================


def _verify_professor_result_access(
    cursor,
    professor_user_id,
    student_profile_id,
    course_id,
):
    """
    A professor can upload/update/delete a result only when
    the professor is assigned to teach that course for the
    student's academic group.

    Normalized academic structure:

        student_profiles.program_id
            -> programs.id

        student_profiles.section_id
            -> sections.id

        timetables.program_id
            -> programs.id

        timetables.section_id
            -> sections.id
    """

    # --------------------------------------------------------
    # Get student academic information
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            sp.id,
            sp.institution_id,

            sp.program_id,
            p.name AS program_name,
            p.code AS program_code,

            sp.section_id,
            s.name AS section_name,
            s.code AS section_code,

            sp.academic_year,
            sp.current_year,
            sp.semester

        FROM student_profiles sp

        INNER JOIN programs p
            ON sp.program_id = p.id

        INNER JOIN sections s
            ON sp.section_id = s.id
           AND s.program_id = p.id

        WHERE sp.id = %s

        LIMIT 1
        """,
        (student_profile_id,),
    )

    student = cursor.fetchone()

    if not student:
        raise NotFoundError(
            "Student profile not found"
        )

    # --------------------------------------------------------
    # Get course
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            c.id,
            c.institution_id,
            c.semester

        FROM courses c

        WHERE c.id = %s

        LIMIT 1
        """,
        (course_id,),
    )

    course = cursor.fetchone()

    if not course:
        raise NotFoundError(
            "Course not found"
        )

    # --------------------------------------------------------
    # Institution protection
    # --------------------------------------------------------

    if (
        course["institution_id"]
        != student["institution_id"]
    ):
        raise ConflictError(
            "Course does not belong to the student's institution"
        )

    # --------------------------------------------------------
    # Professor must be assigned to this course/group
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT
            t.id

        FROM timetables t

        INNER JOIN professor_profiles pp
            ON t.professor_id = pp.id

        WHERE pp.user_id = %s

          AND t.course_id = %s
          AND t.institution_id = %s

          AND t.program_id = %s
          AND t.section_id = %s

          AND t.academic_year = %s
          AND t.current_year = %s

        LIMIT 1
        """,
        (
            professor_user_id,
            course_id,
            student["institution_id"],
            student["program_id"],
            student["section_id"],
            student["academic_year"],
            student["current_year"],
        ),
    )

    assignment = cursor.fetchone()

    if not assignment:
        raise ForbiddenError(
            "Professor is not assigned to this course "
            "for this student's academic group"
        )

    return student, course


# ============================================================
# STUDENT — GET OWN RESULTS
# ============================================================


def get_student_results(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                sp.id AS student_profile_id,
                sp.student_id,
                sp.enrollment_number,
                sp.institution_id,

                p.id AS program_id,
                p.name AS program_name,
                p.code AS program_code,

                sp.academic_year,
                sp.current_year,
                sp.semester,

                s.id AS section_id,
                s.name AS section_name,
                s.code AS section_code,

                er.id AS result_id,
                er.exam_type,
                er.academic_year AS result_academic_year,
                er.semester AS result_semester,

                er.marks_obtained,
                er.maximum_marks,
                er.grade,
                er.grade_point,
                er.credits,
                er.credit_points,
                er.result_status,

                er.uploaded_by,
                uploader.full_name AS uploaded_by_name,

                er.created_at,
                er.updated_at,

                c.id AS course_id,
                c.name AS course_name,
                c.code AS course_code

            FROM student_profiles sp

            INNER JOIN programs p
                ON sp.program_id = p.id

            INNER JOIN sections s
                ON sp.section_id = s.id
               AND s.program_id = p.id

            INNER JOIN examination_results er
                ON er.student_profile_id = sp.id

            INNER JOIN courses c
                ON er.course_id = c.id

            INNER JOIN users uploader
                ON er.uploaded_by = uploader.id

            INNER JOIN users student_user
                ON sp.user_id = student_user.id

            WHERE sp.user_id = %s
              AND student_user.is_active = TRUE

            ORDER BY
                er.academic_year DESC,
                er.semester DESC,
                c.name ASC,
                er.exam_type ASC
            """,
            (user_id,),
        )

        results = cursor.fetchall()

        if not results:
            return {
                "count": 0,
                "student": None,
                "results": [],
                "semester_summaries": [],
            }

        first = results[0]

        student = {
            "student_profile_id": first["student_profile_id"],
            "student_id": first["student_id"],
            "enrollment_number": first["enrollment_number"],
            "institution_id": first["institution_id"],
            "program_id": first["program_id"],
            "program_name": first["program_name"],
            "program_code": first["program_code"],
            "academic_year": first["academic_year"],
            "current_year": first["current_year"],
            "semester": first["semester"],
            "section_id": first["section_id"],
            "section_name": first["section_name"],
            "section_code": first["section_code"],
        }

        summaries = _all_semester_summaries(
            cursor,
            first["student_profile_id"],
        )

        return {
            "count": len(results),
            "student": student,
            "results": results,
            "semester_summaries": summaries,
        }

    finally:
        connection.close()



# ============================================================
# PROFESSOR / ADMIN / SUPER_ADMIN — RESULT MANAGEMENT LIST
# ============================================================

def get_result_management_results(
    user_id,
    role,
    enrollment_number=None,
    subject_code=None,
    academic_year=None,
    semester=None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        conditions = []
        params = []

        if enrollment_number:
            conditions.append("sp.enrollment_number = %s")
            params.append(str(enrollment_number).strip())

        if subject_code:
            conditions.append("c.code = %s")
            params.append(str(subject_code).strip())

        if academic_year:
            conditions.append("er.academic_year = %s")
            params.append(str(academic_year).strip())

        if semester is not None:
            conditions.append("er.semester = %s")
            params.append(int(semester))

        if role == "PROFESSOR":
            conditions.append("""
                EXISTS (
                    SELECT 1
                    FROM timetables tt
                    INNER JOIN professor_profiles pp
                        ON tt.professor_id = pp.id
                    WHERE pp.user_id = %s
                      AND tt.course_id = er.course_id
                      AND tt.institution_id = sp.institution_id
                      AND tt.program_id = sp.program_id
                      AND tt.section_id = sp.section_id
                      AND tt.academic_year = sp.academic_year
                      AND tt.current_year = sp.current_year
                )
            """)
            params.append(user_id)
        elif role not in ["ADMIN", "SUPER_ADMIN"]:
            raise ForbiddenError("Result management access denied")

        where_sql = " AND ".join(conditions) if conditions else "1=1"

        cursor.execute(
            f"""
            SELECT
                er.id AS result_id,
                er.student_profile_id,
                sp.student_id,
                sp.enrollment_number,
                sp.institution_id,
                p.id AS program_id,
                p.name AS program_name,
                p.code AS program_code,
                sp.academic_year AS student_academic_year,
                sp.current_year,
                sp.semester AS student_semester,
                s.id AS section_id,
                s.name AS section_name,
                s.code AS section_code,
                er.course_id,
                c.name AS course_name,
                c.code AS course_code,
                er.exam_type,
                er.academic_year AS result_academic_year,
                er.semester AS result_semester,
                er.marks_obtained,
                er.maximum_marks,
                er.grade,
                er.grade_point,
                er.credits,
                er.credit_points,
                er.result_status,
                er.uploaded_by,
                uploader.full_name AS uploaded_by_name,
                er.created_at,
                er.updated_at
            FROM examination_results er
            INNER JOIN student_profiles sp
                ON er.student_profile_id = sp.id
            INNER JOIN programs p
                ON sp.program_id = p.id
            INNER JOIN sections s
                ON sp.section_id = s.id
               AND s.program_id = p.id
            INNER JOIN courses c
                ON er.course_id = c.id
            INNER JOIN users uploader
                ON er.uploaded_by = uploader.id
            WHERE {where_sql}
            ORDER BY er.academic_year DESC, er.semester DESC,
                     sp.enrollment_number ASC, c.code ASC, er.exam_type ASC
            LIMIT 500
            """,
            tuple(params),
        )

        results = cursor.fetchall()

        return {
            "count": len(results),
            "results": results,
        }

    finally:
        connection.close()


# ============================================================
# GET SINGLE RESULT
# ============================================================


def get_result(
    result_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                er.id AS result_id,

                er.student_profile_id,

                sp.user_id AS student_user_id,
                sp.student_id,
                sp.enrollment_number,

                sp.institution_id,

                sp.program_id,
                p.name AS program_name,
                p.code AS program_code,

                sp.section_id,
                s.name AS section_name,
                s.code AS section_code,

                sp.academic_year,
                sp.current_year,
                sp.semester,

                er.course_id,

                c.name AS course_name,
                c.code AS course_code,

                er.exam_type,
                er.academic_year AS result_academic_year,
                er.semester AS result_semester,

                er.marks_obtained,
                er.maximum_marks,

                er.grade,
                er.grade_point,
                er.credits,
                er.credit_points,
                er.result_status,

                er.uploaded_by,
                uploader.full_name AS uploaded_by_name,

                er.created_at,
                er.updated_at

            FROM examination_results er

            INNER JOIN student_profiles sp
                ON er.student_profile_id = sp.id

            INNER JOIN programs p
                ON sp.program_id = p.id

            INNER JOIN sections s
                ON sp.section_id = s.id
               AND s.program_id = p.id

            INNER JOIN courses c
                ON er.course_id = c.id

            INNER JOIN users uploader
                ON er.uploaded_by = uploader.id

            WHERE er.id = %s

            LIMIT 1
            """,
            (result_id,),
        )

        result = cursor.fetchone()

        if not result:
            raise NotFoundError(
                "Result not found"
            )

        # ----------------------------------------------------
        # STUDENT — only own result
        # ----------------------------------------------------

        if role == "STUDENT":

            if result["student_user_id"] != user_id:
                raise NotFoundError(
                    "Result not found"
                )

        # ----------------------------------------------------
        # PROFESSOR
        # ----------------------------------------------------

        elif role == "PROFESSOR":

            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=result[
                    "student_profile_id"
                ],
                course_id=result["course_id"],
            )

        # ----------------------------------------------------
        # ADMIN / SUPER_ADMIN
        # ----------------------------------------------------

        elif role not in [
            "ADMIN",
            "SUPER_ADMIN",
        ]:

            raise ForbiddenError(
                "Access denied"
            )

        return result

    finally:
        connection.close()


# ============================================================
# CREATE RESULT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def create_result(
    user_id,
    role,
    data,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        (
            marks,
            maximum_marks,
            grade_point,
            credits,
            credit_points,
        ) = _validate_academic_result_values(data)

        student = _resolve_student_profile(
            cursor=cursor,
            student_profile_id=getattr(data, "student_profile_id", None),
            enrollment_number=getattr(data, "enrollment_number", None),
        )

        course = _resolve_course(
            cursor=cursor,
            course_id=getattr(data, "course_id", None),
            subject_code=getattr(data, "subject_code", None),
            institution_id=student["institution_id"],
            program_id=student["program_id"],
        )

        if course["institution_id"] != student["institution_id"]:
            raise ConflictError(
                "Course does not belong to the student's institution"
            )

        if course["semester"] != data.semester:
            raise ConflictError(
                "Result semester does not match the course semester"
            )

        if role == "PROFESSOR":
            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=student["id"],
                course_id=course["id"],
            )
        elif role not in ["ADMIN", "SUPER_ADMIN"]:
            raise ForbiddenError(
                "Only Professor or Admin can create results"
            )

        cursor.execute(
            """
            SELECT id
            FROM examination_results
            WHERE student_profile_id = %s
              AND course_id = %s
              AND exam_type = %s
              AND academic_year = %s
              AND semester = %s
            LIMIT 1
            """,
            (
                student["id"],
                course["id"],
                data.exam_type,
                data.academic_year,
                data.semester,
            ),
        )

        if cursor.fetchone():
            raise ConflictError(
                "A result for this student, course and examination already exists"
            )

        cursor.execute(
            """
            INSERT INTO examination_results (
                student_profile_id,
                course_id,
                exam_type,
                academic_year,
                semester,
                marks_obtained,
                maximum_marks,
                grade,
                grade_point,
                credits,
                credit_points,
                result_status,
                uploaded_by
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                student["id"],
                course["id"],
                data.exam_type,
                data.academic_year,
                data.semester,
                marks,
                maximum_marks,
                data.grade,
                grade_point,
                credits,
                credit_points,
                data.result_status,
                user_id,
            ),
        )

        result_id = cursor.lastrowid

        summary = _semester_summary(
            cursor,
            student["id"],
            data.academic_year,
            data.semester,
        )

        connection.commit()

        return {
            "message": "Examination result created successfully",
            "result_id": result_id,
            "student_profile_id": student["id"],
            "enrollment_number": student["enrollment_number"],
            "course_id": course["id"],
            "subject_code": course["code"],
            "subject_name": course["name"],
            "exam_type": data.exam_type,
            "academic_year": data.academic_year,
            "semester": data.semester,
            "marks_obtained": marks,
            "maximum_marks": maximum_marks,
            "grade": data.grade,
            "grade_point": grade_point,
            "credits": credits,
            "credit_points": credit_points,
            "result_status": data.result_status,
            "semester_summary": summary,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE RESULT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def update_result(
    result_id,
    user_id,
    role,
    data,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        (
            marks,
            maximum_marks,
            grade_point,
            credits,
            credit_points,
        ) = _validate_academic_result_values(data)

        cursor.execute(
            """
            SELECT
                id,
                student_profile_id
            FROM examination_results
            WHERE id = %s
            LIMIT 1
            """,
            (result_id,),
        )

        existing = cursor.fetchone()

        if not existing:
            raise NotFoundError("Result not found")

        student_profile_id = existing["student_profile_id"]

        student = _resolve_student_profile(
            cursor=cursor,
            student_profile_id=student_profile_id,
            enrollment_number=getattr(data, "enrollment_number", None),
        )

        course = _resolve_course(
            cursor=cursor,
            course_id=getattr(data, "course_id", None),
            subject_code=getattr(data, "subject_code", None),
            institution_id=student["institution_id"],
            program_id=student["program_id"],
        )

        if course["institution_id"] != student["institution_id"]:
            raise ConflictError(
                "Course does not belong to the student's institution"
            )

        if course["semester"] != data.semester:
            raise ConflictError(
                "Result semester does not match the course semester"
            )

        if role == "PROFESSOR":
            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=student_profile_id,
                course_id=course["id"],
            )
        elif role not in ["ADMIN", "SUPER_ADMIN"]:
            raise ForbiddenError(
                "Only Professor or Admin can update results"
            )

        cursor.execute(
            """
            SELECT id
            FROM examination_results
            WHERE student_profile_id = %s
              AND course_id = %s
              AND exam_type = %s
              AND academic_year = %s
              AND semester = %s
              AND id != %s
            LIMIT 1
            """,
            (
                student_profile_id,
                course["id"],
                data.exam_type,
                data.academic_year,
                data.semester,
                result_id,
            ),
        )

        if cursor.fetchone():
            raise ConflictError(
                "Another result already exists for this student, course and examination"
            )

        cursor.execute(
            """
            UPDATE examination_results
            SET
                course_id = %s,
                exam_type = %s,
                academic_year = %s,
                semester = %s,
                marks_obtained = %s,
                maximum_marks = %s,
                grade = %s,
                grade_point = %s,
                credits = %s,
                credit_points = %s,
                result_status = %s
            WHERE id = %s
            """,
            (
                course["id"],
                data.exam_type,
                data.academic_year,
                data.semester,
                marks,
                maximum_marks,
                data.grade,
                grade_point,
                credits,
                credit_points,
                data.result_status,
                result_id,
            ),
        )

        summary = _semester_summary(
            cursor,
            student_profile_id,
            data.academic_year,
            data.semester,
        )

        connection.commit()

        return {
            "message": "Examination result updated successfully",
            "result_id": result_id,
            "student_profile_id": student_profile_id,
            "enrollment_number": student["enrollment_number"],
            "course_id": course["id"],
            "subject_code": course["code"],
            "subject_name": course["name"],
            "credits": credits,
            "credit_points": credit_points,
            "semester_summary": summary,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE RESULT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def delete_result(
    result_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find result
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                student_profile_id,
                course_id

            FROM examination_results

            WHERE id = %s

            LIMIT 1
            """,
            (result_id,),
        )

        result = cursor.fetchone()

        if not result:
            raise NotFoundError(
                "Result not found"
            )

        # ----------------------------------------------------
        # Professor authorization
        # ----------------------------------------------------

        if role == "PROFESSOR":

            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=result[
                    "student_profile_id"
                ],
                course_id=result["course_id"],
            )

        elif role not in [
            "ADMIN",
            "SUPER_ADMIN",
        ]:

            raise ForbiddenError(
                "Only Professor or Admin can delete results"
            )

        # ----------------------------------------------------
        # Delete
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM examination_results

            WHERE id = %s
            """,
            (result_id,),
        )

        connection.commit()

        return {
            "message": (
                "Examination result deleted successfully"
            ),
            "result_id": result_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADD RESULT ATTACHMENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def add_result_attachment(
    result_id,
    user_id,
    role,
    file_name,
    file_path,
    file_type,
    file_size,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find result
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                student_profile_id,
                course_id

            FROM examination_results

            WHERE id = %s

            LIMIT 1
            """,
            (result_id,),
        )

        result = cursor.fetchone()

        if not result:
            raise NotFoundError(
                "Result not found"
            )

        # ----------------------------------------------------
        # Professor authorization
        # ----------------------------------------------------

        if role == "PROFESSOR":

            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=result[
                    "student_profile_id"
                ],
                course_id=result["course_id"],
            )

        elif role not in [
            "ADMIN",
            "SUPER_ADMIN",
        ]:

            raise ForbiddenError(
                "Only Professor or Admin can upload "
                "result attachments"
            )

        # ----------------------------------------------------
        # Insert attachment
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO result_attachments (
                result_id,
                file_name,
                file_path,
                file_type,
                file_size,
                uploaded_by
            )
            VALUES (
                %s, %s, %s, %s, %s, %s
            )
            """,
            (
                result_id,
                file_name,
                file_path,
                file_type,
                file_size,
                user_id,
            ),
        )

        attachment_id = cursor.lastrowid

        connection.commit()

        return {
            "message": (
                "Result attachment uploaded successfully"
            ),
            "attachment_id": attachment_id,
            "result_id": result_id,
            "file_name": file_name,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET RESULT ATTACHMENT
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def get_result_attachment(
    attachment_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ra.id AS attachment_id,
                ra.result_id,
                ra.file_name,
                ra.file_path,
                ra.file_type,
                ra.file_size,

                er.student_profile_id,
                er.course_id,

                sp.user_id AS student_user_id

            FROM result_attachments ra

            INNER JOIN examination_results er
                ON ra.result_id = er.id

            INNER JOIN student_profiles sp
                ON er.student_profile_id = sp.id

            WHERE ra.id = %s

            LIMIT 1
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Result attachment not found"
            )

        # ----------------------------------------------------
        # Student — ONLY own result
        # ----------------------------------------------------

        if role == "STUDENT":

            if (
                attachment["student_user_id"]
                != user_id
            ):
                raise NotFoundError(
                    "Result attachment not found"
                )

        # ----------------------------------------------------
        # Professor — only assigned result
        # ----------------------------------------------------

        elif role == "PROFESSOR":

            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=attachment[
                    "student_profile_id"
                ],
                course_id=attachment["course_id"],
            )

        # ----------------------------------------------------
        # Admin / Super Admin
        # ----------------------------------------------------

        elif role not in [
            "ADMIN",
            "SUPER_ADMIN",
        ]:

            raise ForbiddenError(
                "Access denied"
            )

        return attachment

    finally:
        connection.close()


# ============================================================
# DELETE RESULT ATTACHMENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def delete_result_attachment(
    attachment_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ra.id AS attachment_id,
                ra.file_path,

                er.student_profile_id,
                er.course_id

            FROM result_attachments ra

            INNER JOIN examination_results er
                ON ra.result_id = er.id

            WHERE ra.id = %s

            LIMIT 1
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Result attachment not found"
            )

        # ----------------------------------------------------
        # Professor authorization
        # ----------------------------------------------------

        if role == "PROFESSOR":

            _verify_professor_result_access(
                cursor=cursor,
                professor_user_id=user_id,
                student_profile_id=attachment[
                    "student_profile_id"
                ],
                course_id=attachment["course_id"],
            )

        elif role not in [
            "ADMIN",
            "SUPER_ADMIN",
        ]:

            raise ForbiddenError(
                "Only Professor or Admin can delete "
                "result attachments"
            )

        # ----------------------------------------------------
        # Delete database record
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM result_attachments

            WHERE id = %s
            """,
            (attachment_id,),
        )

        connection.commit()

        return {
            "message": (
                "Result attachment deleted successfully"
            ),
            "attachment_id": attachment_id,
            "file_path": attachment["file_path"],
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()