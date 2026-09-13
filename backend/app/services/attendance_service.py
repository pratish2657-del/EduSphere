from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# INTERNAL — GET USER
# ============================================================


def _get_user(cursor, user_id):

    cursor.execute(
        """
        SELECT
            u.id,
            u.is_active,
            r.name AS role,
            u.is_super_admin

        FROM users u

        LEFT JOIN roles r
            ON u.role_id = r.id

        WHERE u.id = %s

        LIMIT 1
        """,
        (user_id,),
    )

    user = cursor.fetchone()

    if not user:
        raise NotFoundError("User account not found")

    if not user["is_active"]:
        raise ForbiddenError("Your account is inactive")

    return user


# ============================================================
# INTERNAL — CHECK PROFESSOR COURSE ACCESS
# ============================================================


def _check_professor_course_access(cursor, professor_id, course_id):
    """
    Verify professor access through either supported assignment path:
      - course_teachers.professor_id -> users.id
      - timetables.professor_id -> professor_profiles.id
        -> professor_profiles.user_id
    """

    cursor.execute(
        """
        SELECT 1
        FROM course_teachers
        WHERE professor_id = %s
          AND course_id = %s

        UNION ALL

        SELECT 1
        FROM timetables t
        INNER JOIN professor_profiles pp
            ON pp.id = t.professor_id
        WHERE pp.user_id = %s
          AND t.course_id = %s

        LIMIT 1
        """,
        (
            professor_id,
            course_id,
            professor_id,
            course_id,
        ),
    )

    teaching = cursor.fetchone()

    if not teaching:
        raise ForbiddenError(
            "You are not assigned to this course"
        )


# ============================================================
# INTERNAL — CHECK STUDENT COURSE ENROLLMENT
# ============================================================


def _check_student_course_enrollment(
    cursor,
    student_id,
    course_id,
):
    """
    Check enrollment using the canonical users.id and also tolerate
    legacy rows where course_enrollments.student_id contains the
    student_profiles.id.
    """

    cursor.execute(
        """
        SELECT
            ce.id
        FROM course_enrollments ce
        LEFT JOIN student_profiles sp
            ON sp.id = ce.student_id
        WHERE ce.course_id = %s
          AND (
              ce.student_id = %s
              OR sp.user_id = %s
          )
        LIMIT 1
        """,
        (
            course_id,
            student_id,
            student_id,
        ),
    )

    enrollment = cursor.fetchone()

    if not enrollment:
        raise ForbiddenError(
            "Student is not enrolled in this course"
        )


# ============================================================
# INTERNAL — CHECK STUDENT
# ============================================================


def _check_student(cursor, student_id):

    cursor.execute(
        """
        SELECT
            u.id,
            r.name AS role,
            u.is_active
        FROM users u
        LEFT JOIN roles r
            ON u.role_id = r.id
        LEFT JOIN student_profiles sp
            ON sp.user_id = u.id
        WHERE u.id = %s
           OR sp.id = %s
        LIMIT 1
        """,
        (
            student_id,
            student_id,
        ),
    )

    student = cursor.fetchone()

    if not student:
        raise NotFoundError("Student not found")

    if not student["is_active"]:
        raise ForbiddenError(
            "Student account is inactive"
        )

    if student["role"] != "STUDENT":
        raise BadRequestError(
            "Attendance can only be recorded for students"
        )

    return student


# ============================================================
# INTERNAL — ADMIN CHECK
# ============================================================


def _is_admin(user):

    return user["role"] in ["ADMIN", "SUPER_ADMIN"]


# ============================================================
# CREATE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


def create_attendance(user_id, data):

    allowed_statuses = [
        "PRESENT",
        "ABSENT",
        "LATE",
        "EXCUSED",
    ]

    status = data.status.upper().strip()

    if status not in allowed_statuses:
        raise BadRequestError(
            "Invalid attendance status. "
            "Use PRESENT, ABSENT, LATE, or EXCUSED"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Get current user
        # ----------------------------------------------------

        user = _get_user(cursor, user_id)

        # ----------------------------------------------------
        # Only professor/admin can create attendance
        # ----------------------------------------------------

        if user["role"] != "PROFESSOR" and not _is_admin(user):
            raise ForbiddenError(
                "Only professors or admins can create attendance"
            )

        # ----------------------------------------------------
        # Check student
        # ----------------------------------------------------

        student = _check_student(cursor, data.student_id)
        canonical_student_id = student["id"]

        # ----------------------------------------------------
        # Check professor course access
        # ----------------------------------------------------

        if user["role"] == "PROFESSOR":
            _check_professor_course_access(
                cursor,
                user_id,
                data.course_id,
            )

        # ----------------------------------------------------
        # Check student enrollment
        # ----------------------------------------------------

        _check_student_course_enrollment(
            cursor,
            canonical_student_id,
            data.course_id,
        )

        # ----------------------------------------------------
        # Check duplicate attendance
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id

            FROM attendance

            WHERE student_id = %s
              AND course_id = %s
              AND attendance_date = %s

            LIMIT 1
            """,
            (
                canonical_student_id,
                data.course_id,
                data.attendance_date,
            ),
        )

        existing = cursor.fetchone()

        if existing:
            raise ConflictError(
                "Attendance already exists for this "
                "student, course, and date"
            )

        # ----------------------------------------------------
        # Create attendance
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO attendance (
                student_id,
                course_id,
                attendance_date,
                status
            )

            VALUES (
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                data.student_id,
                data.course_id,
                data.attendance_date,
                status,
            ),
        )

        attendance_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Attendance marked successfully",
            "attendance_id": attendance_id,
            "student_id": canonical_student_id,
            "course_id": data.course_id,
            "attendance_date": data.attendance_date,
            "status": status,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# MARK ATTENDANCE
# ALIAS
# ============================================================


def mark_attendance(
    professor_id,
    student_id,
    course_id,
    attendance_date,
    status,
):

    class AttendanceData:
        pass

    data = AttendanceData()

    data.student_id = student_id
    data.course_id = course_id
    data.attendance_date = attendance_date
    data.status = status

    return create_attendance(
        user_id=professor_id,
        data=data,
    )


# ============================================================
# GET ATTENDANCE
# SINGLE RECORD
# ============================================================


def get_attendance(attendance_id, user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        user = _get_user(cursor, user_id)

        # ----------------------------------------------------
        # Find attendance
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                a.id,
                a.student_id,

                student.full_name
                    AS student_name,

                a.course_id,

                c.name
                    AS course_name,

                c.code
                    AS course_code,

                a.attendance_date,
                a.status

            FROM attendance a

            INNER JOIN users student
                ON a.student_id = student.id

            INNER JOIN courses c
                ON a.course_id = c.id

            WHERE a.id = %s

            LIMIT 1
            """,
            (attendance_id,),
        )

        attendance = cursor.fetchone()

        if not attendance:
            raise NotFoundError(
                "Attendance record not found"
            )

        # ----------------------------------------------------
        # Admin access
        # ----------------------------------------------------

        if _is_admin(user):
            return attendance

        # ----------------------------------------------------
        # Professor access
        # ----------------------------------------------------

        if user["role"] == "PROFESSOR":
            _check_professor_course_access(
                cursor,
                user_id,
                attendance["course_id"],
            )

            return attendance

        # ----------------------------------------------------
        # Student access
        # ----------------------------------------------------

        if user["role"] == "STUDENT":

            if attendance["student_id"] != user_id:
                raise ForbiddenError(
                    "You can only view your own attendance"
                )

            _check_student_course_enrollment(
                cursor,
                user_id,
                attendance["course_id"],
            )

            return attendance

        raise ForbiddenError(
            "You are not authorized to view this attendance"
        )

    finally:
        connection.close()


# ============================================================
# UPDATE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


def update_attendance(
    attendance_id,
    user_id,
    data,
):

    allowed_statuses = [
        "PRESENT",
        "ABSENT",
        "LATE",
        "EXCUSED",
    ]

    status = data.status.upper().strip()

    if status not in allowed_statuses:
        raise BadRequestError(
            "Invalid attendance status. "
            "Use PRESENT, ABSENT, LATE, or EXCUSED"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        user = _get_user(cursor, user_id)

        # ----------------------------------------------------
        # Professor/admin only
        # ----------------------------------------------------

        if user["role"] != "PROFESSOR" and not _is_admin(user):
            raise ForbiddenError(
                "Only professors or admins can update attendance"
            )

        # ----------------------------------------------------
        # Find attendance
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                student_id,
                course_id,
                attendance_date,
                status

            FROM attendance

            WHERE id = %s

            FOR UPDATE
            """,
            (attendance_id,),
        )

        attendance = cursor.fetchone()

        if not attendance:
            raise NotFoundError(
                "Attendance record not found"
            )

        # ----------------------------------------------------
        # Professor course access
        # ----------------------------------------------------

        if user["role"] == "PROFESSOR":
            _check_professor_course_access(
                cursor,
                user_id,
                attendance["course_id"],
            )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE attendance

            SET
                status = %s

            WHERE id = %s
            """,
            (status, attendance_id),
        )

        connection.commit()

        return {
            "message": "Attendance updated successfully",
            "attendance_id": attendance_id,
            "status": status,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


def delete_attendance(
    professor_id,
    attendance_id,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        user = _get_user(
            cursor,
            professor_id,
        )

        if user["role"] != "PROFESSOR" and not _is_admin(user):
            raise ForbiddenError(
                "Only professors or admins can delete attendance"
            )

        cursor.execute(
            """
            SELECT
                id,
                student_id,
                course_id,
                attendance_date,
                status

            FROM attendance

            WHERE id = %s

            FOR UPDATE
            """,
            (attendance_id,),
        )

        attendance = cursor.fetchone()

        if not attendance:
            raise NotFoundError(
                "Attendance record not found"
            )

        if user["role"] == "PROFESSOR":
            _check_professor_course_access(
                cursor,
                professor_id,
                attendance["course_id"],
            )

        cursor.execute(
            """
            DELETE FROM attendance

            WHERE id = %s
            """,
            (attendance_id,),
        )

        connection.commit()

        return {
            "message": "Attendance deleted successfully",
            "attendance_id": attendance_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET STUDENT ATTENDANCE
# STUDENT — OWN ATTENDANCE
# PROFESSOR / ADMIN — AUTHORIZED ACCESS
# ============================================================


def get_student_attendance(
    student_id,
    user_id,
    course_id=None,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        user = _get_user(cursor, user_id)

        student = _check_student(
            cursor,
            student_id,
        )
        canonical_student_id = student["id"]

        # ----------------------------------------------------
        # Student can only see own attendance
        # ----------------------------------------------------

        if user["role"] == "STUDENT":

            if user_id != canonical_student_id:
                raise ForbiddenError(
                    "You can only view your own attendance"
                )

        # ----------------------------------------------------
        # Professor access
        # ----------------------------------------------------

        elif user["role"] == "PROFESSOR":

            if course_id is None:
                raise BadRequestError(
                    "Professor must specify a course"
                )

            _check_professor_course_access(
                cursor,
                user_id,
                course_id,
            )

            _check_student_course_enrollment(
                cursor,
                canonical_student_id,
                course_id,
            )

        # ----------------------------------------------------
        # Admin access
        # ----------------------------------------------------

        elif _is_admin(user):
            pass

        else:
            raise ForbiddenError(
                "You are not authorized to view "
                "student attendance"
            )

        # ----------------------------------------------------
        # Course-specific attendance
        # ----------------------------------------------------

        if course_id is not None:

            _check_student_course_enrollment(
                cursor,
                canonical_student_id,
                course_id,
            )

            cursor.execute(
                """
                SELECT
                    a.id,
                    a.student_id,
                    a.course_id,

                    c.name
                        AS course_name,

                    c.code
                        AS course_code,

                    a.attendance_date,
                    a.status

                FROM attendance a

                INNER JOIN courses c
                    ON a.course_id = c.id

                WHERE a.student_id = %s
                  AND a.course_id = %s

                ORDER BY
                    a.attendance_date DESC,
                    a.id DESC
                """,
                (
                    canonical_student_id,
                    course_id,
                ),
            )

        else:

            cursor.execute(
                """
                SELECT
                    a.id,
                    a.student_id,
                    a.course_id,

                    c.name
                        AS course_name,

                    c.code
                        AS course_code,

                    a.attendance_date,
                    a.status

                FROM attendance a

                INNER JOIN courses c
                    ON a.course_id = c.id

                WHERE a.student_id = %s

                ORDER BY
                    a.attendance_date DESC,
                    a.id DESC
                """,
                (canonical_student_id,),
            )

        attendance = cursor.fetchall()

        return {
            "count": len(attendance),
            "attendance": attendance,
        }

    finally:
        connection.close()


# ============================================================
# GET COURSE ATTENDANCE
# PROFESSOR / ADMIN
# ============================================================


def get_course_attendance(
    course_id,
    user_id,
    attendance_date=None,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        user = _get_user(
            cursor,
            user_id,
        )

        # ----------------------------------------------------
        # Professor must teach course
        # ----------------------------------------------------

        if user["role"] == "PROFESSOR":

            _check_professor_course_access(
                cursor,
                user_id,
                course_id,
            )

        elif not _is_admin(user):

            raise ForbiddenError(
                "Only professors or admins can view "
                "course attendance"
            )

        # ----------------------------------------------------
        # Filter by date
        # ----------------------------------------------------

        if attendance_date is not None:

            cursor.execute(
                """
                SELECT
                    a.id,
                    a.student_id,

                    student.full_name
                        AS student_name,

                    a.course_id,

                    c.name
                        AS course_name,

                    c.code
                        AS course_code,

                    a.attendance_date,
                    a.status

                FROM attendance a

                INNER JOIN users student
                    ON a.student_id = student.id

                INNER JOIN courses c
                    ON a.course_id = c.id

                WHERE a.course_id = %s
                  AND a.attendance_date = %s

                ORDER BY
                    student.full_name ASC
                """,
                (
                    course_id,
                    attendance_date,
                ),
            )

        else:

            cursor.execute(
                """
                SELECT
                    a.id,
                    a.student_id,

                    student.full_name
                        AS student_name,

                    a.course_id,

                    c.name
                        AS course_name,

                    c.code
                        AS course_code,

                    a.attendance_date,
                    a.status

                FROM attendance a

                INNER JOIN users student
                    ON a.student_id = student.id

                INNER JOIN courses c
                    ON a.course_id = c.id

                WHERE a.course_id = %s

                ORDER BY
                    a.attendance_date DESC,
                    student.full_name ASC
                """,
                (course_id,),
            )

        attendance = cursor.fetchall()

        return {
            "count": len(attendance),
            "attendance": attendance,
        }

    finally:
        connection.close()


# ============================================================
# GET ATTENDANCE SUMMARY
# STUDENT — OWN SUMMARY
# PROFESSOR / ADMIN — AUTHORIZED ACCESS
# ============================================================


def get_attendance_summary(
    student_id,
    user_id,
    course_id,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        user = _get_user(
            cursor,
            user_id,
        )

        student = _check_student(
            cursor,
            student_id,
        )
        canonical_student_id = student["id"]

        # ----------------------------------------------------
        # Student can only see own summary
        # ----------------------------------------------------

        if user["role"] == "STUDENT":

            if user_id != canonical_student_id:
                raise ForbiddenError(
                    "You can only view your own attendance summary"
                )

        # ----------------------------------------------------
        # Professor must teach course
        # ----------------------------------------------------

        elif user["role"] == "PROFESSOR":

            _check_professor_course_access(
                cursor,
                user_id,
                course_id,
            )

        # ----------------------------------------------------
        # Admin allowed
        # ----------------------------------------------------

        elif not _is_admin(user):

            raise ForbiddenError(
                "You are not authorized to view "
                "this attendance summary"
            )

        # ----------------------------------------------------
        # Student must be enrolled
        # ----------------------------------------------------

        _check_student_course_enrollment(
            cursor,
            canonical_student_id,
            course_id,
        )

        # ----------------------------------------------------
        # Get summary
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                c.id AS course_id,

                c.name AS course_name,

                c.code AS course_code,

                COUNT(a.id)
                    AS total_classes,

                SUM(
                    CASE
                        WHEN a.status = 'PRESENT'
                        THEN 1
                        ELSE 0
                    END
                ) AS present_count,

                SUM(
                    CASE
                        WHEN a.status = 'ABSENT'
                        THEN 1
                        ELSE 0
                    END
                ) AS absent_count,

                SUM(
                    CASE
                        WHEN a.status = 'LATE'
                        THEN 1
                        ELSE 0
                    END
                ) AS late_count,

                SUM(
                    CASE
                        WHEN a.status = 'EXCUSED'
                        THEN 1
                        ELSE 0
                    END
                ) AS excused_count

            FROM courses c

            LEFT JOIN attendance a
                ON a.course_id = c.id
               AND a.student_id = %s

            WHERE c.id = %s

            GROUP BY
                c.id,
                c.name,
                c.code
            """,
            (
                canonical_student_id,
                course_id,
            ),
        )

        summary = cursor.fetchone()

        if not summary:
            raise NotFoundError(
                "Course not found"
            )

        total_classes = summary["total_classes"] or 0
        present_count = summary["present_count"] or 0
        absent_count = summary["absent_count"] or 0
        late_count = summary["late_count"] or 0
        excused_count = summary["excused_count"] or 0

        # ----------------------------------------------------
        # Attendance percentage
        # ----------------------------------------------------

        if total_classes > 0:
            attendance_percentage = round(
                (present_count / total_classes) * 100,
                2,
            )
        else:
            attendance_percentage = 0.0

        return {
            "course_id": summary["course_id"],
            "course_name": summary["course_name"],
            "course_code": summary["course_code"],
            "total_classes": total_classes,
            "present_count": present_count,
            "absent_count": absent_count,
            "late_count": late_count,
            "excused_count": excused_count,
            "attendance_percentage": attendance_percentage,
        }

    finally:
        connection.close()