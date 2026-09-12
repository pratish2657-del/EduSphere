import uuid

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import dashboard as dashboard_route
from app.routes import professor_dashboard as professor_dashboard_route
from app.routes import student


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
            f"{role_name} role does not exist"
        )

        return role["id"]

    finally:
        connection.close()


def get_institution_id():
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
            "No institution exists in the test database"
        )

        return institution["id"]

    finally:
        connection.close()


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
            f"No active program exists for institution "
            f"{institution_id}"
        )

        return program["id"]

    finally:
        connection.close()


def get_section_id(program_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM sections
            WHERE program_id = %s
              AND is_active = TRUE
            ORDER BY id
            LIMIT 1
            """,
            (program_id,),
        )

        section = cursor.fetchone()

        assert section is not None, (
            f"No active section exists for program "
            f"{program_id}"
        )

        return section["id"]

    finally:
        connection.close()


def create_test_user(
    role_name="STUDENT",
    profile_completed=True,
    verification_status="NOT_REQUIRED",
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-dashboard-"
            f"{role_name.lower()}-"
            f"{unique_id}@edusphere.local"
        )

        google_id = (
            f"pytest-dashboard-"
            f"{role_name.lower()}-"
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
                %s,
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                f"Pytest Dashboard {role_name}",
                role_id,
                profile_completed,
                verification_status,
            ),
        )

        connection.commit()

        user_id = cursor.lastrowid

        return {
            "id": user_id,
            "email": email,
            "full_name": f"Pytest Dashboard {role_name}",
            "role": role_name,
            "role_id": role_id,
            "profile_completed": profile_completed,
            "verification_status": verification_status,
            "is_active": 1,
            "is_super_admin": 0,
        }

    finally:
        connection.close()


# ============================================================
# STUDENT PROFILE DIRECT CREATION
# ============================================================


def create_student_profile_direct(
    user_id,
    institution_id,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex[:10]

        # ----------------------------------------------------
        # Resolve an existing active program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name,
                code
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
            f"No active program exists for institution "
            f"{institution_id}"
        )

        program_id = program["id"]

        # ----------------------------------------------------
        # Resolve an existing active section
        # belonging to the selected program
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name,
                code
            FROM sections
            WHERE program_id = %s
              AND is_active = TRUE
            ORDER BY id
            LIMIT 1
            """,
            (program_id,),
        )

        section = cursor.fetchone()

        assert section is not None, (
            f"No active section exists for program "
            f"{program_id}"
        )

        section_id = section["id"]

        # ----------------------------------------------------
        # Insert normalized student profile
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
                user_id,
                "9876543210",
                institution_id,
                f"ENR-{unique_id}",
                program_id,
                "2025-2026",
                2,
                3,
                section_id,
                f"STU-{unique_id}",
                2024,
            ),
        )

        connection.commit()

        return cursor.lastrowid

    finally:
        connection.close()


# ============================================================
# PROFESSOR PROFILE DIRECT CREATION
# ============================================================


def create_professor_profile_direct(
    user_id,
    institution_id,
):
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
                user_id,
                "9876543210",
                institution_id,
                f"EMP-{unique_id}",
                "Computer Science",
                "Assistant Professor",
                "Artificial Intelligence",
                "AI, Machine Learning",
                "5 years",
                "Room 101",
                "Verified for dashboard testing",
            ),
        )

        connection.commit()

        return cursor.lastrowid

    finally:
        connection.close()


# ============================================================
# DELETE TEST USER
# ============================================================


def delete_test_user(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Result attachments belonging to user's results
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM result_attachments
            WHERE result_id IN (
                SELECT id
                FROM examination_results
                WHERE student_profile_id IN (
                    SELECT id
                    FROM student_profiles
                    WHERE user_id = %s
                )
            )
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Examination results
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM examination_results
            WHERE student_profile_id IN (
                SELECT id
                FROM student_profiles
                WHERE user_id = %s
            )
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Timetables belonging to professor
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM timetables
            WHERE professor_id IN (
                SELECT id
                FROM professor_profiles
                WHERE user_id = %s
            )
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Course teacher relationships
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM course_teachers
            WHERE professor_id IN (
                SELECT id
                FROM professor_profiles
                WHERE user_id = %s
            )
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Professor verification
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM professor_verifications
            WHERE professor_id IN (
                SELECT id
                FROM professor_profiles
                WHERE user_id = %s
            )
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Professor profile
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM professor_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Student profile
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM student_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # User
        # ----------------------------------------------------

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


# ============================================================
# USER DATA
# ============================================================


def student_user_data(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": user["role"],
        "profile_completed": user["profile_completed"],
        "verification_status": user["verification_status"],
        "is_active": 1,
        "is_super_admin": 0,
    }


def professor_user_data(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": "PROFESSOR",
        "profile_completed": True,
        "verification_status": "VERIFIED",
        "is_active": 1,
        "is_super_admin": 0,
    }


# ============================================================
# STUDENT DASHBOARD
# ============================================================


def test_student_dashboard_success(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        create_student_profile_direct(
            user["id"],
            get_institution_id(),
        )

        test_user = student_user_data(user)

        monkeypatch.setattr(
            dashboard_route,
            "require_student",
            lambda request: test_user,
        )

        response = client.get("/dashboard/")

        assert response.status_code == 200

        data = response.json()

        assert (
            data["message"]
            == "Welcome to EduSphere Student Dashboard"
        )

        assert "user" in data
        assert "student" in data

        assert data["user"]["id"] == user["id"]
        assert data["user"]["email"] == user["email"]
        assert data["user"]["role"] == "STUDENT"

    finally:
        delete_test_user(user["id"])


def test_student_dashboard_returns_student_profile(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        student_profile_id = create_student_profile_direct(
            user["id"],
            get_institution_id(),
        )

        test_user = student_user_data(user)

        monkeypatch.setattr(
            dashboard_route,
            "require_student",
            lambda request: test_user,
        )

        response = client.get("/dashboard/")

        assert response.status_code == 200

        data = response.json()

        student = data["student"]

        assert student["user_id"] == user["id"]
        assert (
            student["student_profile_id"]
            == student_profile_id
        )

        assert student["email"] == user["email"]
        assert student["full_name"] == user["full_name"]

        assert "institution_id" in student
        assert "institution_name" in student

        assert "enrollment_number" in student

        assert "program_id" in student
        assert "program" in student
        assert "program_code" in student

        assert "section_id" in student
        assert "section" in student
        assert "section_code" in student

        assert "academic_year" in student
        assert "current_year" in student
        assert "semester" in student

        assert "student_id" in student
        assert "admission_year" in student

    finally:
        delete_test_user(user["id"])


def test_student_dashboard_profile_completed_is_boolean(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        create_student_profile_direct(
            user["id"],
            get_institution_id(),
        )

        test_user = student_user_data(user)

        monkeypatch.setattr(
            dashboard_route,
            "require_student",
            lambda request: test_user,
        )

        response = client.get("/dashboard/")

        assert response.status_code == 200

        data = response.json()

        assert isinstance(
            data["user"]["profile_completed"],
            bool,
        )

    finally:
        delete_test_user(user["id"])


def test_non_student_cannot_access_dashboard(
    monkeypatch,
):
    user = create_test_user("ADMIN")

    try:

        def reject_student(request):
            raise HTTPException(
                status_code=403,
                detail="Student access required",
            )

        monkeypatch.setattr(
            dashboard_route,
            "require_student",
            reject_student,
        )

        response = client.get("/dashboard/")

        assert response.status_code == 403

        assert response.json()["detail"] == (
            "Student access required"
        )

    finally:
        delete_test_user(user["id"])


def test_student_dashboard_profile_not_found(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        test_user = student_user_data(user)

        monkeypatch.setattr(
            dashboard_route,
            "require_student",
            lambda request: test_user,
        )

        response = client.get("/dashboard/")

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Student profile not found"
        )

    finally:
        delete_test_user(user["id"])


def test_student_dashboard_requires_authentication():
    response = client.get("/dashboard/")

    assert response.status_code == 401

    assert response.json()["detail"] == (
        "You must login with Google first"
    )


# ============================================================
# PROFESSOR DASHBOARD
# ============================================================


def test_professor_dashboard_success(monkeypatch):
    user = create_test_user(
        "PROFESSOR",
        profile_completed=True,
        verification_status="VERIFIED",
    )

    try:
        professor_profile_id = (
            create_professor_profile_direct(
                user["id"],
                get_institution_id(),
            )
        )

        professor = professor_user_data(user)

        monkeypatch.setattr(
            professor_dashboard_route,
            "require_professor",
            lambda request: professor,
        )

        response = client.get(
            "/professor/dashboard/"
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            data["message"]
            == "Welcome to EduSphere Professor Dashboard"
        )

        assert "professor" in data
        assert "courses" in data
        assert "timetable" in data

        assert (
            data["professor"]["id"]
            == professor_profile_id
        )

        assert (
            data["professor"]["user_id"]
            == user["id"]
        )

        assert (
            data["professor"]["email"]
            == user["email"]
        )

    finally:
        delete_test_user(user["id"])


def test_professor_dashboard_returns_profile_details(
    monkeypatch,
):
    user = create_test_user(
        "PROFESSOR",
        profile_completed=True,
        verification_status="VERIFIED",
    )

    try:
        create_professor_profile_direct(
            user["id"],
            get_institution_id(),
        )

        professor = professor_user_data(user)

        monkeypatch.setattr(
            professor_dashboard_route,
            "require_professor",
            lambda request: professor,
        )

        response = client.get(
            "/professor/dashboard/"
        )

        assert response.status_code == 200

        profile = response.json()["professor"]

        assert profile["email"] == user["email"]
        assert profile["full_name"] == user["full_name"]

        assert "phone" in profile
        assert "employee_id" in profile
        assert "department" in profile
        assert "designation" in profile
        assert "specialization" in profile
        assert "subjects" in profile
        assert "academic_experience" in profile
        assert "office_information" in profile
        assert "verification_details" in profile

    finally:
        delete_test_user(user["id"])


def test_professor_dashboard_courses_structure(
    monkeypatch,
):
    user = create_test_user(
        "PROFESSOR",
        profile_completed=True,
        verification_status="VERIFIED",
    )

    try:
        create_professor_profile_direct(
            user["id"],
            get_institution_id(),
        )

        professor = professor_user_data(user)

        monkeypatch.setattr(
            professor_dashboard_route,
            "require_professor",
            lambda request: professor,
        )

        response = client.get(
            "/professor/dashboard/"
        )

        assert response.status_code == 200

        courses = response.json()["courses"]

        assert "count" in courses
        assert "items" in courses

        assert isinstance(
            courses["count"],
            int,
        )

        assert isinstance(
            courses["items"],
            list,
        )

        assert (
            courses["count"]
            == len(courses["items"])
        )

    finally:
        delete_test_user(user["id"])


def test_professor_dashboard_timetable_structure(
    monkeypatch,
):
    user = create_test_user(
        "PROFESSOR",
        profile_completed=True,
        verification_status="VERIFIED",
    )

    try:
        create_professor_profile_direct(
            user["id"],
            get_institution_id(),
        )

        professor = professor_user_data(user)

        monkeypatch.setattr(
            professor_dashboard_route,
            "require_professor",
            lambda request: professor,
        )

        response = client.get(
            "/professor/dashboard/"
        )

        assert response.status_code == 200

        timetable = response.json()["timetable"]

        assert "count" in timetable
        assert "items" in timetable

        assert isinstance(
            timetable["count"],
            int,
        )

        assert isinstance(
            timetable["items"],
            list,
        )

        assert (
            timetable["count"]
            == len(timetable["items"])
        )

    finally:
        delete_test_user(user["id"])


def test_non_professor_cannot_access_professor_dashboard(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:

        def reject_professor(request):
            raise HTTPException(
                status_code=403,
                detail="Professor access required",
            )

        monkeypatch.setattr(
            professor_dashboard_route,
            "require_professor",
            reject_professor,
        )

        response = client.get(
            "/professor/dashboard/"
        )

        assert response.status_code == 403

        assert response.json()["detail"] == (
            "Professor access required"
        )

    finally:
        delete_test_user(user["id"])


def test_professor_dashboard_profile_not_found(
    monkeypatch,
):
    user = create_test_user(
        "PROFESSOR",
        profile_completed=True,
        verification_status="VERIFIED",
    )

    try:
        professor = professor_user_data(user)

        monkeypatch.setattr(
            professor_dashboard_route,
            "require_professor",
            lambda request: professor,
        )

        response = client.get(
            "/professor/dashboard/"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Professor profile not found"
        )

    finally:
        delete_test_user(user["id"])


def test_professor_dashboard_requires_authentication():
    response = client.get(
        "/professor/dashboard/"
    )

    assert response.status_code == 401

    assert response.json()["detail"] == (
        "You must login with Google first"
    )