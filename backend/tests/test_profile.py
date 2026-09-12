import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import profile as profile_route

client = TestClient(app)


# ============================================================
# TEST USER HELPERS
# ============================================================


def get_program_id(institution_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM programs
            WHERE institution_id = %s
              AND is_active = TRUE
            ORDER BY id
            LIMIT 1
            """,
            (institution_id,),
        )

        program = cursor.fetchone()

        assert program is not None, (
            "No active program exists "
            f"for institution {institution_id}"
        )

        return program["id"]

    finally:
        connection.close()


def get_section_id(program_id, section_suffix="A"):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
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


def create_test_user():
    unique_id = uuid.uuid4().hex

    google_id = f"pytest-profile-{unique_id}"
    email = f"pytest-profile-{unique_id}@edusphere.local"

    connection = get_connection()

    try:
        cursor = connection.cursor()

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
                NULL,
                FALSE,
                'NOT_REQUIRED',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                "Pytest Profile User",
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "email": email,
            "google_id": google_id,
        }

    finally:
        connection.close()


def delete_test_user(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM student_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            DELETE FROM users
            WHERE id = %s
            """,
            (user_id,),
        )

        connection.commit()

    finally:
        connection.close()


def build_test_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": "Pytest Profile User",
        "role_id": None,
        "role": None,
        "profile_completed": False,
        "verification_status": "NOT_REQUIRED",
        "is_active": 1,
        "is_super_admin": 0,
    }


# ============================================================
# CREATE STUDENT PROFILE
# ============================================================


def test_create_student_profile(monkeypatch):
    test_user = create_test_user()
    user_id = test_user["id"]

    try:
        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(test_user),
                "role": "STUDENT",
            },
        )

        institution_id = 1
        program_id = get_program_id(institution_id)
        section_id = get_section_id(program_id, "A")

        response = client.post(
            "/profile/student",
            json={
                "phone": "9876543210",
                "institution_id": institution_id,
                "enrollment_number": "PYTEST-ENROLL-001",
                "program_id": program_id,
                "section_id": section_id,
                "academic_year": "2026-2027",
                "current_year": 1,
                "semester": 1,
                "student_id": "PYTEST-STUDENT-001",
                "admission_year": 2026,
            },
        )

        assert response.status_code == 200, response.text

        data = response.json()

        assert data["message"] == (
            "Student profile created successfully"
        )

        assert data["profile_completed"] is True
        assert data["verification_status"] == "NOT_REQUIRED"

        student_profile_id = data["student_profile_id"]

        # ----------------------------------------------------
        # Verify users table
        # ----------------------------------------------------

        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    u.role_id,
                    r.name AS role,
                    u.profile_completed
                FROM users u
                LEFT JOIN roles r
                    ON u.role_id = r.id
                WHERE u.id = %s
                """,
                (user_id,),
            )

            database_user = cursor.fetchone()

            assert database_user is not None
            assert database_user["role_id"] == 5
            assert database_user["role"] == "STUDENT"
            assert database_user["profile_completed"] == 1

            # ------------------------------------------------
            # Verify student profile
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT
                    sp.id,
                    sp.user_id,
                    sp.enrollment_number,
                    sp.student_id,
                    sp.institution_id,
                    sp.program_id,
                    sp.section_id,

                    p.name AS program,
                    p.code AS program_code,

                    s.name AS section,
                    s.code AS section_code

                FROM student_profiles sp

                INNER JOIN programs p
                    ON sp.program_id = p.id

                INNER JOIN sections s
                    ON sp.section_id = s.id

                WHERE sp.id = %s
                """,
                (student_profile_id,),
            )

            profile = cursor.fetchone()

        finally:
            connection.close()

        assert profile is not None
        assert profile["user_id"] == user_id
        assert profile["enrollment_number"] == "PYTEST-ENROLL-001"
        assert profile["student_id"] == "PYTEST-STUDENT-001"
        assert profile["institution_id"] == institution_id
        assert profile["program_id"] == program_id
        assert profile["section_id"] == section_id

        assert profile["program"] is not None
        assert profile["program_code"] is not None
        assert profile["section"] is not None
        assert profile["section_code"] is not None

    finally:
        delete_test_user(user_id)


# ============================================================
# DUPLICATE ENROLLMENT NUMBER
# ============================================================


def test_duplicate_enrollment_number_is_rejected(monkeypatch):
    first_user = create_test_user()
    second_user = None

    try:
        institution_id = 1
        program_id = get_program_id(institution_id)
        section_id = get_section_id(program_id, "A")

        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(first_user),
                "role": "STUDENT",
            },
        )

        payload = {
            "phone": "9876543210",
            "institution_id": institution_id,
            "enrollment_number": "PYTEST-DUPLICATE-001",
            "program_id": program_id,
            "section_id": section_id,
            "academic_year": "2026-2027",
            "current_year": 1,
            "semester": 1,
            "student_id": "PYTEST-DUPLICATE-STUDENT-001",
            "admission_year": 2026,
        }

        first_response = client.post(
            "/profile/student",
            json=payload,
        )

        assert first_response.status_code == 200, first_response.text

        second_user = create_test_user()

        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(second_user),
                "role": "STUDENT",
            },
        )

        second_response = client.post(
            "/profile/student",
            json={
                **payload,
                "student_id": "PYTEST-DUPLICATE-STUDENT-002",
            },
        )

        assert second_response.status_code == 409, (
            second_response.text
        )

        assert "Enrollment number already exists" in (
            second_response.json()["detail"]
        )

    finally:
        if second_user:
            delete_test_user(second_user["id"])

        delete_test_user(first_user["id"])


# ============================================================
# DUPLICATE STUDENT ID
# ============================================================


def test_duplicate_student_id_is_rejected(monkeypatch):
    first_user = create_test_user()
    second_user = None

    try:
        institution_id = 1
        program_id = get_program_id(institution_id)
        section_id = get_section_id(program_id, "A")

        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(first_user),
                "role": "STUDENT",
            },
        )

        payload = {
            "phone": "9876543210",
            "institution_id": institution_id,
            "enrollment_number": "PYTEST-ENROLL-002",
            "program_id": program_id,
            "section_id": section_id,
            "academic_year": "2026-2027",
            "current_year": 1,
            "semester": 1,
            "student_id": "PYTEST-DUPLICATE-ID-001",
            "admission_year": 2026,
        }

        first_response = client.post(
            "/profile/student",
            json=payload,
        )

        assert first_response.status_code == 200, first_response.text

        second_user = create_test_user()

        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(second_user),
                "role": "STUDENT",
            },
        )

        second_response = client.post(
            "/profile/student",
            json={
                **payload,
                "enrollment_number": "PYTEST-ENROLL-003",
            },
        )

        assert second_response.status_code == 409, (
            second_response.text
        )

        assert "Student ID already exists" in (
            second_response.json()["detail"]
        )

    finally:
        if second_user:
            delete_test_user(second_user["id"])

        delete_test_user(first_user["id"])


# ============================================================
# GET STUDENT PROFILE
# ============================================================


def test_get_student_profile(monkeypatch):
    test_user = create_test_user()
    user_id = test_user["id"]

    try:
        institution_id = 1
        program_id = get_program_id(institution_id)
        section_id = get_section_id(program_id, "A")

        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(test_user),
                "role": "STUDENT",
            },
        )

        # ----------------------------------------------------
        # Create profile first
        # ----------------------------------------------------

        create_response = client.post(
            "/profile/student",
            json={
                "phone": "9876543210",
                "institution_id": institution_id,
                "enrollment_number": "PYTEST-GET-001",
                "program_id": program_id,
                "section_id": section_id,
                "academic_year": "2026-2027",
                "current_year": 1,
                "semester": 1,
                "student_id": "PYTEST-GET-STUDENT-001",
                "admission_year": 2026,
            },
        )

        assert create_response.status_code == 200, (
            create_response.text
        )

        # ----------------------------------------------------
        # Student after profile completion
        # ----------------------------------------------------

        student_user = {
            **build_test_user(test_user),
            "role_id": 5,
            "role": "STUDENT",
            "profile_completed": True,
        }

        monkeypatch.setattr(
            profile_route,
            "require_student",
            lambda request: student_user,
        )

        response = client.get("/profile/student")

        assert response.status_code == 200, response.text

        data = response.json()

        assert data["user_id"] == user_id
        assert data["email"] == test_user["email"]
        assert data["full_name"] == "Pytest Profile User"

        assert data["institution_id"] == institution_id

        assert data["institution_name"] == (
            "University of Engineering & Management, Kolkata"
        )

        assert data["university_code"] == ("IN/WB/Kolkata/UEM29082026")

        assert data["enrollment_number"] == "PYTEST-GET-001"

        assert data["program_id"] == program_id
        assert data["program"]
        assert data["program_code"]

        assert data["section_id"] == section_id
        assert data["section"]
        assert data["section_code"]

        assert data["academic_year"] == "2026-2027"
        assert data["current_year"] == 1
        assert data["semester"] == 1
        assert data["student_id"] == "PYTEST-GET-STUDENT-001"
        assert data["admission_year"] == 2026

    finally:
        delete_test_user(user_id)


# ============================================================
# UPDATE STUDENT PROFILE
# ============================================================


def test_update_student_profile(monkeypatch):
    test_user = create_test_user()
    user_id = test_user["id"]

    try:
        institution_id = 1
        program_id = get_program_id(institution_id)

        section_a_id = get_section_id(
            program_id,
            "A",
        )

        section_b_id = get_section_id(
            program_id,
            "B",
        )

        # ----------------------------------------------------
        # Create initial profile
        # ----------------------------------------------------

        monkeypatch.setattr(
            profile_route,
            "get_current_user",
            lambda request: {
                **build_test_user(test_user),
                "role": "STUDENT",
            },
        )

        create_response = client.post(
            "/profile/student",
            json={
                "phone": "9876543210",
                "institution_id": institution_id,
                "enrollment_number": "PYTEST-UPDATE-001",
                "program_id": program_id,
                "section_id": section_a_id,
                "academic_year": "2026-2027",
                "current_year": 1,
                "semester": 1,
                "student_id": "PYTEST-UPDATE-STUDENT-001",
                "admission_year": 2026,
            },
        )

        assert create_response.status_code == 200, (
            create_response.text
        )

        # ----------------------------------------------------
        # Student after profile completion
        # ----------------------------------------------------

        student_user = {
            **build_test_user(test_user),
            "role_id": 5,
            "role": "STUDENT",
            "profile_completed": True,
        }

        monkeypatch.setattr(
            profile_route,
            "require_student",
            lambda request: student_user,
        )

        # ----------------------------------------------------
        # Update profile
        # ----------------------------------------------------

        response = client.put(
            "/profile/student",
            json={
                "phone": "9123456789",
                "institution_id": institution_id,
                "enrollment_number": "PYTEST-UPDATE-002",
                "program_id": program_id,
                "section_id": section_b_id,
                "academic_year": "2026-2027",
                "current_year": 2,
                "semester": 3,
                "student_id": "PYTEST-UPDATE-STUDENT-002",
                "admission_year": 2025,
            },
        )

        assert response.status_code == 200, response.text

        data = response.json()

        assert data["message"] == (
            "Student profile updated successfully"
        )

        assert data["profile_completed"] is True

        student_profile_id = data["student_profile_id"]

        # ----------------------------------------------------
        # Verify database
        # ----------------------------------------------------

        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    sp.phone,
                    sp.institution_id,
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

                FROM student_profiles sp

                INNER JOIN programs p
                    ON sp.program_id = p.id

                INNER JOIN sections s
                    ON sp.section_id = s.id

                WHERE sp.id = %s
                """,
                (student_profile_id,),
            )

            profile = cursor.fetchone()

        finally:
            connection.close()

        assert profile is not None

        assert profile["phone"] == "9123456789"
        assert profile["institution_id"] == institution_id
        assert profile["enrollment_number"] == (
            "PYTEST-UPDATE-002"
        )

        assert profile["program_id"] == program_id
        assert profile["program"] is not None
        assert profile["program_code"] is not None

        assert profile["section_id"] == section_b_id
        assert profile["section"] is not None
        assert profile["section_code"] is not None

        assert profile["academic_year"] == "2026-2027"
        assert profile["current_year"] == 2
        assert profile["semester"] == 3
        assert profile["student_id"] == (
            "PYTEST-UPDATE-STUDENT-002"
        )
        assert profile["admission_year"] == 2025

    finally:
        delete_test_user(user_id)