import os
import uuid

import pymysql
from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import result as result_route
from tests.test_users import delete_test_user


client = TestClient(app)


# ============================================================
# HELPERS
# ============================================================


def get_role_id(role_name):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM roles
            WHERE name = %s
            LIMIT 1
            """,
            (role_name,),
        )

        role = cursor.fetchone()

        assert role is not None, (
            f"Role {role_name} does not exist"
        )

        return role["id"]

    finally:
        connection.close()


# ============================================================
# INSTITUTION
# ============================================================


def get_test_institution_id():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM institutions
            ORDER BY id
            LIMIT 1
            """
        )

        institution = cursor.fetchone()

        assert institution is not None, (
            "At least one institution is required "
            "to run result tests"
        )

        return institution["id"]

    finally:
        connection.close()


# ============================================================
# PROGRAM
# ============================================================


def get_program_id(
    institution_id,
    program_name=None,
):
    """
    Resolve a real program from the current database.

    IMPORTANT:
    Do not search for name='B.Tech'.

    In the current database the program name is:

        B.Tech in Computer Science and Engineering
        (Artificial Intelligence)

    while degree='B.Tech'.

    Therefore this helper resolves by degree when no
    exact program name is supplied.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        if program_name:
            cursor.execute(
                """
                SELECT
                    id,
                    institution_id,
                    name,
                    code,
                    degree
                FROM programs
                WHERE institution_id = %s
                  AND name = %s
                  AND is_active = TRUE
                ORDER BY id
                LIMIT 1
                """,
                (
                    institution_id,
                    program_name,
                ),
            )
        else:
            cursor.execute(
                """
                SELECT
                    id,
                    institution_id,
                    name,
                    code,
                    degree
                FROM programs
                WHERE institution_id = %s
                  AND is_active = TRUE
                ORDER BY
                    CASE
                        WHEN degree = 'B.Tech' THEN 0
                        ELSE 1
                    END,
                    id
                LIMIT 1
                """,
                (institution_id,),
            )

        program = cursor.fetchone()

        assert program is not None, (
            f"No active program exists "
            f"for institution {institution_id}"
        )

        return program["id"]

    finally:
        connection.close()


# ============================================================
# SECTION
# ============================================================


def get_section_id(
    program_id,
    section_suffix="A",
):
    """
    Resolve a section for the selected program.

    Current database example:

        CSE-AI-A
        CSE-AI-B
        CSE-AI-C
        CSE-AI-D

    Older tests expected simply:

        A
        B

    This helper supports both.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                program_id,
                name,
                code
            FROM sections
            WHERE program_id = %s
              AND is_active = TRUE
              AND (
                    name = %s
                    OR code = %s
                    OR name LIKE %s
                    OR code LIKE %s
              )
            ORDER BY id
            LIMIT 1
            """,
            (
                program_id,
                section_suffix,
                section_suffix,
                f"%-{section_suffix}",
                f"%-{section_suffix}",
            ),
        )

        section = cursor.fetchone()

        assert section is not None, (
            f"Section '{section_suffix}' does not exist "
            f"for program {program_id}"
        )

        return section["id"]

    finally:
        connection.close()


# ============================================================
# TEST USER
# ============================================================


def create_test_user(
    role_name="PROFESSOR",
    profile_completed=True,
    is_super_admin=False,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-result-{role_name.lower()}-"
            f"{unique_id}@edusphere.local"
        )

        google_id = (
            f"pytest-result-{role_name.lower()}-"
            f"{unique_id}"
        )

        role_id = get_role_id(role_name)

        cursor.execute(
            """
            INSERT INTO users (
                google_id,
                email,
                full_name,
                role_id,
                profile_completed,
                verification_status,
                is_active,
                is_super_admin
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                'PENDING',
                TRUE,
                %s
            )
            """,
            (
                google_id,
                email,
                f"Pytest {role_name}",
                role_id,
                profile_completed,
                is_super_admin,
            ),
        )

        user_id = cursor.lastrowid

        connection.commit()

        return {
            "id": user_id,
            "email": email,
            "full_name": f"Pytest {role_name}",
            "role": role_name,
            "role_id": role_id,
            "profile_completed": profile_completed,
            "verification_status": "PENDING",
            "is_active": 1,
            "is_super_admin": int(
                is_super_admin
            ),
        }

    finally:
        connection.close()


# ============================================================
# PROFESSOR PROFILE
# ============================================================


def create_professor_profile(
    user,
    institution_id=None,
):
    if institution_id is None:
        institution_id = get_test_institution_id()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex[:10]

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
                user["id"],
                "9999999999",
                institution_id,
                f"PY-PROF-{unique_id}",
                "Computer Science",
                "Professor",
                "Computer Science",
                "Programming",
                "10 years",
                "Room 101",
                "Pytest verification",
            ),
        )

        professor_id = cursor.lastrowid

        connection.commit()

        return professor_id

    finally:
        connection.close()


# ============================================================
# STUDENT PROFILE
# ============================================================


def create_student_profile(
    user,
    institution_id=None,
):
    if institution_id is None:
        institution_id = get_test_institution_id()

    unique_id = uuid.uuid4().hex[:10]

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Program
        # ----------------------------------------------------

        program_id = get_program_id(
            institution_id
        )

        # ----------------------------------------------------
        # Section
        # ----------------------------------------------------

        section_id = get_section_id(
            program_id,
            "A",
        )

        # ----------------------------------------------------
        # Student profile
        #
        # IMPORTANT:
        # These values are intentionally kept consistent with
        # the timetable assignment below.
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO student_profiles (
                user_id,
                phone,
                institution_id,
                enrollment_number,
                program_id,
                academic_year,
                current_year,
                semester,
                section_id,
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
                %s
            )
            """,
            (
                user["id"],
                "8888888888",
                institution_id,
                f"PY-ENR-{unique_id}",
                program_id,
                "2025-2026",
                3,
                5,
                section_id,
                f"PY-STU-{unique_id}",
                2023,
            ),
        )

        student_profile_id = cursor.lastrowid

        connection.commit()

        return student_profile_id

    finally:
        connection.close()


# ============================================================
# COURSE
# ============================================================


def create_course(
    institution_id=None,
    program_id=None,
    semester=5,
):
    """
    Create a course using the CURRENT schema.

    IMPORTANT:
    courses.program_id is required by the current
    timetable/result authorization logic.
    """

    if institution_id is None:
        institution_id = get_test_institution_id()

    if program_id is None:
        program_id = get_program_id(
            institution_id
        )

    unique_id = uuid.uuid4().hex[:8].upper()

    connection = get_connection()

    try:
        cursor = connection.cursor()

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
                f"Pytest Result Course {unique_id}",
                f"PYR-{unique_id}",
                semester,
            ),
        )

        course_id = cursor.lastrowid

        connection.commit()

        return course_id

    finally:
        connection.close()


# ============================================================
# TIMETABLE ASSIGNMENT
# ============================================================


def create_timetable_assignment(
    professor_id,
    course_id,
    institution_id,
    program_id=None,
    section_id=None,
    academic_year="2025-2026",
    current_year=3,
):
    """
    Create a timetable using the CURRENT normalized schema.

    CURRENT SCHEMA:

        institution_id
        program_id
        section_id
        course_id
        professor_id
        academic_year
        current_year
        day
        start_time
        end_time
        room

    DO NOT use:

        program
        stream
        section
    """

    if program_id is None:
        program_id = get_program_id(
            institution_id
        )

    if section_id is None:
        section_id = get_section_id(
            program_id,
            "A",
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Verify course
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                institution_id,
                program_id,
                semester
            FROM courses
            WHERE id = %s
            LIMIT 1
            """,
            (course_id,),
        )

        course = cursor.fetchone()

        assert course is not None, (
            f"Course {course_id} does not exist"
        )

        assert course["institution_id"] == (
            institution_id
        ), (
            f"Course {course_id} does not belong "
            f"to institution {institution_id}"
        )

        assert course["program_id"] == (
            program_id
        ), (
            f"Course {course_id} does not belong "
            f"to program {program_id}"
        )

        # ----------------------------------------------------
        # Verify section
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

        assert section is not None, (
            f"Section {section_id} does not exist"
        )

        assert section["program_id"] == (
            program_id
        ), (
            f"Section {section_id} does not belong "
            f"to program {program_id}"
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
                professor_id,
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
                %s,
                %s
            )
            """,
            (
                institution_id,
                program_id,
                section_id,
                course_id,
                professor_id,
                academic_year,
                current_year,
                "Monday",
                "10:00:00",
                "11:00:00",
                "PY-101",
            ),
        )

        timetable_id = cursor.lastrowid

        connection.commit()

        return timetable_id

    finally:
        connection.close()


# ============================================================
# RESULT PAYLOAD
# ============================================================


def result_payload(
    student_profile_id,
    course_id,
    exam_type=None,
    semester=5,
):
    unique_id = uuid.uuid4().hex[:8]

    return {
        "student_profile_id": student_profile_id,
        "course_id": course_id,
        "exam_type": (
            exam_type
            or f"INTERNAL-{unique_id}"
        ),
        "academic_year": "2025-2026",
        "semester": semester,
        "marks_obtained": 82,
        "maximum_marks": 100,
        "grade": "A",
        "grade_point": 9,
        "result_status": "PASS",
    }


# ============================================================
# AUTH USER OBJECTS
# ============================================================


def professor_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": "PROFESSOR",
        "profile_completed": True,
        "verification_status": "PENDING",
        "is_active": 1,
        "is_super_admin": 0,
    }


def admin_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": "ADMIN",
        "profile_completed": True,
        "verification_status": "PENDING",
        "is_active": 1,
        "is_super_admin": 0,
    }


def student_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": "STUDENT",
        "profile_completed": True,
        "verification_status": "PENDING",
        "is_active": 1,
        "is_super_admin": 0,
    }


# ============================================================
# CLEANUP
# ============================================================


def cleanup_test_data(
    user_ids=None,
    result_ids=None,
    attachment_ids=None,
    timetable_ids=None,
    professor_profile_ids=None,
    student_profile_ids=None,
    course_ids=None,
):
    """
    Explicit cleanup for the complete Results test graph.
    """

    user_ids = user_ids or []
    result_ids = result_ids or []
    attachment_ids = attachment_ids or []
    timetable_ids = timetable_ids or []
    professor_profile_ids = (
        professor_profile_ids or []
    )
    student_profile_ids = (
        student_profile_ids or []
    )
    course_ids = course_ids or []

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Attachments
        # ----------------------------------------------------

        if attachment_ids:
            placeholders = ", ".join(
                ["%s"] * len(attachment_ids)
            )

            cursor.execute(
                f"""
                SELECT file_path
                FROM result_attachments
                WHERE id IN ({placeholders})
                """,
                tuple(attachment_ids),
            )

            attachment_rows = cursor.fetchall()

            cursor.execute(
                f"""
                DELETE FROM result_attachments
                WHERE id IN ({placeholders})
                """,
                tuple(attachment_ids),
            )

            for row in attachment_rows:
                file_path = row.get(
                    "file_path"
                )

                if (
                    file_path
                    and os.path.exists(file_path)
                ):
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass

        # ----------------------------------------------------
        # Results
        # ----------------------------------------------------

        if result_ids:
            placeholders = ", ".join(
                ["%s"] * len(result_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM examination_results
                WHERE id IN ({placeholders})
                """,
                tuple(result_ids),
            )

        # ----------------------------------------------------
        # Timetables
        # ----------------------------------------------------

        if timetable_ids:
            placeholders = ", ".join(
                ["%s"] * len(timetable_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM timetables
                WHERE id IN ({placeholders})
                """,
                tuple(timetable_ids),
            )

        # ----------------------------------------------------
        # Student profiles
        # ----------------------------------------------------

        if student_profile_ids:
            placeholders = ", ".join(
                ["%s"] * len(student_profile_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM student_profiles
                WHERE id IN ({placeholders})
                """,
                tuple(student_profile_ids),
            )

        # ----------------------------------------------------
        # Professor verification
        # ----------------------------------------------------

        if professor_profile_ids:
            placeholders = ", ".join(
                ["%s"] * len(professor_profile_ids)
            )

            try:
                cursor.execute(
                    f"""
                    DELETE FROM professor_verifications
                    WHERE professor_id IN ({placeholders})
                    """,
                    tuple(
                        professor_profile_ids
                    ),
                )

            except pymysql.MySQLError:
                connection.rollback()

        # ----------------------------------------------------
        # Professor profiles
        # ----------------------------------------------------

        if professor_profile_ids:
            placeholders = ", ".join(
                ["%s"] * len(professor_profile_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM professor_profiles
                WHERE id IN ({placeholders})
                """,
                tuple(
                    professor_profile_ids
                ),
            )

        # ----------------------------------------------------
        # Courses
        # ----------------------------------------------------

        if course_ids:
            placeholders = ", ".join(
                ["%s"] * len(course_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM courses
                WHERE id IN ({placeholders})
                """,
                tuple(course_ids),
            )

        # ----------------------------------------------------
        # Users
        # ----------------------------------------------------

        if user_ids:
            placeholders = ", ".join(
                ["%s"] * len(user_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM users
                WHERE id IN ({placeholders})
                """,
                tuple(user_ids),
            )

        connection.commit()

    finally:
        connection.close()


# ============================================================
# CREATE RESULT
# ============================================================


def test_create_result(monkeypatch):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_id=professor_profile_id,
            course_id=course_id,
            institution_id=institution_id,
            program_id=program_id,
            section_id=section_id,
        )
    )

    result_id = None

    try:

        professor_data = professor_user(
            professor
        )

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_data,
        )

        response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert response.status_code == 200, (
            response.text
        )

        data = response.json()

        assert data["message"] == (
            "Examination result created successfully"
        )

        assert data["result_id"] is not None

        result_id = data["result_id"]

        assert data["student_profile_id"] == (
            student_profile_id
        )

        assert data["course_id"] == (
            course_id
        )

        assert data["marks_obtained"] == 82

        assert data["maximum_marks"] == 100

        assert data["result_status"] == "PASS"

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=(
                [result_id]
                if result_id
                else []
            ),
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# INVALID MARKS
# ============================================================


def test_create_result_with_invalid_marks(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        payload = result_payload(
            student_profile_id,
            course_id,
        )

        payload["marks_obtained"] = 101

        response = client.post(
            "/results/",
            json=payload,
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "Marks obtained cannot be greater than maximum marks"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# DUPLICATE RESULT
# ============================================================


def test_create_result_duplicate(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        payload = result_payload(
            student_profile_id,
            course_id,
            exam_type="MIDTERM",
        )

        first = client.post(
            "/results/",
            json=payload,
        )

        assert first.status_code == 200, (
            first.text
        )

        result_id = first.json()[
            "result_id"
        ]

        second = client.post(
            "/results/",
            json=payload,
        )

        assert second.status_code == 400

        assert second.json()["detail"] == (
            "A result for this student, course and "
            "examination already exists"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=(
                [result_id]
                if result_id
                else []
            ),
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# PROFESSOR NOT ASSIGNED
# ============================================================


def test_professor_cannot_create_unassigned_result(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "Professor is not assigned to this course "
            "for this student's academic group"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# COURSE SEMESTER MISMATCH
# ============================================================


def test_create_result_course_semester_mismatch(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=4,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
                semester=5,
            ),
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "Result semester does not match "
            "the course semester"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# STUDENT — LIST OWN RESULTS
# ============================================================


def test_student_can_list_own_results(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
                exam_type="FINAL",
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                student
            ),
        )

        response = client.get(
            "/results/"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["count"] >= 1

        result_ids = [
            item["result_id"]
            for item in data["results"]
        ]

        assert result_id in result_ids

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# STUDENT CANNOT GET ANOTHER STUDENT RESULT
# ============================================================


def test_student_cannot_get_another_students_result(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    owner = create_test_user(
        "STUDENT"
    )

    owner_profile_id = (
        create_student_profile(
            owner,
            institution_id,
        )
    )

    other_student = create_test_user(
        "STUDENT"
    )

    other_profile_id = (
        create_student_profile(
            other_student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                owner_profile_id,
                course_id,
                exam_type="FINAL",
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                other_student
            ),
        )

        response = client.get(
            f"/results/{result_id}"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Result not found"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                owner["id"],
                other_student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                owner_profile_id,
                other_profile_id,
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# GET RESULT
# ============================================================


def test_get_result(monkeypatch):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                student
            ),
        )

        response = client.get(
            f"/results/{result_id}"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["result_id"] == result_id

        assert data["student_profile_id"] == (
            student_profile_id
        )

        assert data["course_id"] == course_id

        assert data["course_name"] is not None

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# NONEXISTENT RESULT
# ============================================================


def test_get_nonexistent_result(
    monkeypatch,
):

    student = create_test_user(
        "STUDENT"
    )

    try:

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                student
            ),
        )

        response = client.get(
            "/results/999999"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Result not found"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                student["id"]
            ]
        )


# ============================================================
# UPDATE RESULT
# ============================================================


def test_update_result(monkeypatch):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
                exam_type="INTERNAL",
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        payload = result_payload(
            student_profile_id,
            course_id,
            exam_type="INTERNAL",
        )

        payload["marks_obtained"] = 91
        payload["grade"] = "A+"
        payload["grade_point"] = 10

        payload.pop(
            "student_profile_id"
        )

        response = client.put(
            f"/results/{result_id}",
            json=payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Examination result updated successfully"
        )

        assert data["result_id"] == result_id

        assert data["student_profile_id"] == (
            student_profile_id
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# UPDATE — PROFESSOR NOT ASSIGNED
# ============================================================


def test_professor_cannot_update_unassigned_result(
    monkeypatch,
):

    owner = create_test_user(
        "PROFESSOR"
    )

    other = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    owner_profile_id = (
        create_professor_profile(
            owner,
            institution_id,
        )
    )

    other_profile_id = (
        create_professor_profile(
            other,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    owner_timetable_id = (
        create_timetable_assignment(
            owner_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                owner
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                other
            ),
        )

        payload = result_payload(
            student_profile_id,
            course_id,
            exam_type="UPDATED",
        )

        payload.pop(
            "student_profile_id"
        )

        response = client.put(
            f"/results/{result_id}",
            json=payload,
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "Professor is not assigned to this course "
            "for this student's academic group"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                owner["id"],
                other["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                owner_timetable_id
            ],
            professor_profile_ids=[
                owner_profile_id,
                other_profile_id,
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# DELETE RESULT
# ============================================================


def test_delete_result(monkeypatch):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        response = client.delete(
            f"/results/{result_id}"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Examination result deleted successfully"
        )

        assert data["result_id"] == result_id

        result_id_to_check = result_id

        result_id = None

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id
                FROM examination_results
                WHERE id = %s
                """,
                (result_id_to_check,),
            )

            assert cursor.fetchone() is None

        finally:
            connection.close()

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# DELETE — PROFESSOR NOT ASSIGNED
# ============================================================


def test_professor_cannot_delete_unassigned_result(
    monkeypatch,
):

    owner = create_test_user(
        "PROFESSOR"
    )

    other = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    owner_profile_id = (
        create_professor_profile(
            owner,
            institution_id,
        )
    )

    other_profile_id = (
        create_professor_profile(
            other,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    owner_timetable_id = (
        create_timetable_assignment(
            owner_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                owner
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                other
            ),
        )

        response = client.delete(
            f"/results/{result_id}"
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "Professor is not assigned to this course "
            "for this student's academic group"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                owner["id"],
                other["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                owner_timetable_id
            ],
            professor_profile_ids=[
                owner_profile_id,
                other_profile_id,
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# STUDENT CANNOT CREATE RESULT
# ============================================================


def test_student_cannot_create_result(
    monkeypatch,
):

    student = create_test_user(
        "STUDENT"
    )

    try:

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                student
            ),
        )

        response = client.post(
            "/results/",
            json=result_payload(1, 1),
        )

        assert response.status_code == 403

        assert response.json()["detail"] == (
            "Professor or Admin access required"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                student["id"]
            ]
        )


# ============================================================
# RESULT ATTACHMENT — UPLOAD
# ============================================================


def test_upload_result_attachment(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None
    attachment_id = None

    try:

        professor_data = professor_user(
            professor
        )

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_data,
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        files = {
            "file": (
                "result.pdf",
                b"%PDF-1.4 pytest result attachment",
                "application/pdf",
            )
        }

        response = client.post(
            f"/results/{result_id}/attachments",
            files=files,
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Result attachment uploaded successfully"
        )

        assert data["attachment_id"] is not None

        assert data["result_id"] == result_id

        assert data["file_name"] == (
            "result.pdf"
        )

        attachment_id = data[
            "attachment_id"
        ]

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    id,
                    result_id,
                    file_name,
                    file_type,
                    file_size,
                    uploaded_by
                FROM result_attachments
                WHERE id = %s
                """,
                (attachment_id,),
            )

            attachment = cursor.fetchone()

        finally:
            connection.close()

        assert attachment is not None

        assert attachment["result_id"] == (
            result_id
        )

        assert attachment["file_name"] == (
            "result.pdf"
        )

        assert attachment["file_type"] == (
            "application/pdf"
        )

        assert attachment["file_size"] > 0

        assert attachment["uploaded_by"] == (
            professor["id"]
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            attachment_ids=[
                attachment_id
            ] if attachment_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# ATTACHMENT — INVALID FILE TYPE
# ============================================================


def test_upload_result_attachment_invalid_file_type(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        files = {
            "file": (
                "malware.exe",
                b"not really executable",
                "application/x-msdownload",
            )
        }

        response = client.post(
            f"/results/{result_id}/attachments",
            files=files,
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "File type is not allowed"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# ATTACHMENT — EMPTY FILE
# ============================================================


def test_upload_result_attachment_empty_file(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        files = {
            "file": (
                "empty.pdf",
                b"",
                "application/pdf",
            )
        }

        response = client.post(
            f"/results/{result_id}/attachments",
            files=files,
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "File cannot be empty"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# ATTACHMENT — STUDENT OWNER
# ============================================================


def test_student_can_get_own_result_attachment(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None
    attachment_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        files = {
            "file": (
                "marks.pdf",
                b"%PDF-1.4 own result",
                "application/pdf",
            )
        }

        upload_response = client.post(
            f"/results/{result_id}/attachments",
            files=files,
        )

        assert upload_response.status_code == 200

        attachment_id = (
            upload_response.json()[
                "attachment_id"
            ]
        )

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                student
            ),
        )

        response = client.get(
            f"/results/attachments/{attachment_id}"
        )

        assert response.status_code == 200

        assert response.headers[
            "content-type"
        ] == "application/pdf"

        assert response.content == (
            b"%PDF-1.4 own result"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            attachment_ids=[
                attachment_id
            ] if attachment_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# ATTACHMENT — OTHER STUDENT
# ============================================================


def test_student_cannot_get_another_students_result_attachment(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    owner = create_test_user(
        "STUDENT"
    )

    owner_profile_id = (
        create_student_profile(
            owner,
            institution_id,
        )
    )

    other_student = create_test_user(
        "STUDENT"
    )

    other_profile_id = (
        create_student_profile(
            other_student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None
    attachment_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                owner_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        files = {
            "file": (
                "private.pdf",
                b"%PDF-1.4 private",
                "application/pdf",
            )
        }

        upload_response = client.post(
            f"/results/{result_id}/attachments",
            files=files,
        )

        assert upload_response.status_code == 200

        attachment_id = (
            upload_response.json()[
                "attachment_id"
            ]
        )

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: student_user(
                other_student
            ),
        )

        response = client.get(
            f"/results/attachments/{attachment_id}"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Result attachment not found"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                owner["id"],
                other_student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            attachment_ids=[
                attachment_id
            ] if attachment_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                owner_profile_id,
                other_profile_id,
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# DELETE RESULT ATTACHMENT
# ============================================================


def test_delete_result_attachment(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    institution_id = (
        get_test_institution_id()
    )

    professor_profile_id = (
        create_professor_profile(
            professor,
            institution_id,
        )
    )

    student = create_test_user(
        "STUDENT"
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    section_id = get_section_id(
        program_id,
        "A",
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    timetable_id = (
        create_timetable_assignment(
            professor_profile_id,
            course_id,
            institution_id,
            program_id,
            section_id,
        )
    )

    result_id = None
    attachment_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: professor_user(
                professor
            ),
        )

        create_response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert create_response.status_code == 200

        result_id = create_response.json()[
            "result_id"
        ]

        files = {
            "file": (
                "delete-result.pdf",
                b"%PDF-1.4 delete",
                "application/pdf",
            )
        }

        upload_response = client.post(
            f"/results/{result_id}/attachments",
            files=files,
        )

        assert upload_response.status_code == 200

        attachment_id = (
            upload_response.json()[
                "attachment_id"
            ]
        )

        response = client.delete(
            f"/results/attachments/{attachment_id}"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Result attachment deleted successfully"
        )

        assert data["attachment_id"] == (
            attachment_id
        )

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id
                FROM result_attachments
                WHERE id = %s
                """,
                (attachment_id,),
            )

            assert cursor.fetchone() is None

        finally:
            connection.close()

        attachment_id = None

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            attachment_ids=[
                attachment_id
            ] if attachment_id else [],
            timetable_ids=[
                timetable_id
            ],
            professor_profile_ids=[
                professor_profile_id
            ],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )


# ============================================================
# NONEXISTENT RESULT ATTACHMENT
# ============================================================


def test_get_nonexistent_result_attachment(
    monkeypatch,
):

    professor = create_test_user(
        "PROFESSOR"
    )

    try:

        monkeypatch.setattr(
            result_route,
            "require_completed_profile",
            lambda request: professor_user(
                professor
            ),
        )

        response = client.get(
            "/results/attachments/999999"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Result attachment not found"
        )

    finally:

        cleanup_test_data(
            user_ids=[
                professor["id"]
            ]
        )


# ============================================================
# ADMIN — CREATE RESULT
# ============================================================


def test_admin_can_create_result(
    monkeypatch,
):

    admin = create_test_user(
        "ADMIN"
    )

    student = create_test_user(
        "STUDENT"
    )

    institution_id = (
        get_test_institution_id()
    )

    student_profile_id = (
        create_student_profile(
            student,
            institution_id,
        )
    )

    program_id = get_program_id(
        institution_id
    )

    course_id = create_course(
        institution_id,
        program_id,
        semester=5,
    )

    result_id = None

    try:

        monkeypatch.setattr(
            result_route,
            "require_professor_or_admin",
            lambda request: admin_user(
                admin
            ),
        )

        response = client.post(
            "/results/",
            json=result_payload(
                student_profile_id,
                course_id,
            ),
        )

        assert response.status_code == 200, (
            response.text
        )

        data = response.json()

        assert data["message"] == (
            "Examination result created successfully"
        )

        assert data["result_id"] is not None

        result_id = data["result_id"]

    finally:

        cleanup_test_data(
            user_ids=[
                admin["id"],
                student["id"],
            ],
            result_ids=[
                result_id
            ] if result_id else [],
            student_profile_ids=[
                student_profile_id
            ],
            course_ids=[
                course_id
            ],
        )