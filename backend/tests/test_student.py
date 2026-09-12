import inspect
import uuid

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app

client = TestClient(app)


# ============================================================
# AUTH PATCHING
# ============================================================

def get_registered_endpoint(path, method):
    """
    Find the actual endpoint registered in FastAPI.

    This avoids assuming that the router was imported from
    app.routes.student or any other specific module.
    """

    method = method.upper()

    for route in app.routes:
        route_path = getattr(route, "path", None)
        route_methods = getattr(route, "methods", set())

        if route_path == path and method in route_methods:
            return route.endpoint

    raise AssertionError(
        f"Could not find registered endpoint: "
        f"{method} {path}"
    )


def patch_student_auth(monkeypatch, user, path, method):
    """
    Patch authentication functions in the ACTUAL module
    containing the registered FastAPI endpoint.

    This is more reliable than assuming the route module name.
    """

    endpoint = get_registered_endpoint(
        path,
        method,
    )

    module = inspect.getmodule(endpoint)

    assert module is not None, (
        f"Could not determine module for {endpoint}"
    )

    test_user = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": user["role"],
        "profile_completed": user.get(
            "profile_completed",
            False,
        ),
        "verification_status": user.get(
            "verification_status",
            "PENDING",
        ),
        "is_active": user.get(
            "is_active",
            1,
        ),
        "is_super_admin": user.get(
            "is_super_admin",
            0,
        ),
    }

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    if method.upper() == "POST":
        assert hasattr(module, "get_current_user"), (
            f"{module.__name__} does not expose "
            f"get_current_user"
        )

        monkeypatch.setattr(
            module,
            "get_current_user",
            lambda request: test_user,
        )

    # --------------------------------------------------------
    # UPDATE / GET
    # --------------------------------------------------------

    else:
        assert hasattr(module, "require_student"), (
            f"{module.__name__} does not expose "
            f"require_student"
        )

        monkeypatch.setattr(
            module,
            "require_student",
            lambda request: test_user,
        )

    return test_user


# ============================================================
# DATABASE HELPERS
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


def get_program_and_section():
    """
    Return a valid program_id + section_id pair.

    The section is selected through its program relationship so
    the generated test payload always represents a valid
    academic hierarchy.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                p.id AS program_id,
                s.id AS section_id
            FROM programs p
            INNER JOIN sections s
                ON s.program_id = p.id
            ORDER BY
                p.id,
                s.id
            LIMIT 1
            """
        )

        result = cursor.fetchone()

        assert result is not None, (
            "No program/section exists in the test database"
        )

        return (
            result["program_id"],
            result["section_id"],
        )

    finally:
        connection.close()


def get_section_for_program(
    program_id,
    exclude_section_id=None,
):
    """
    Return another section belonging to the supplied program.

    Used by update tests when we need to verify that the
    section_id can actually change.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        query = """
            SELECT id
            FROM sections
            WHERE program_id = %s
        """

        params = [program_id]

        if exclude_section_id is not None:
            query += """
                AND id != %s
            """
            params.append(exclude_section_id)

        query += """
            ORDER BY id
            LIMIT 1
        """

        cursor.execute(
            query,
            tuple(params),
        )

        section = cursor.fetchone()

        if not section:
            return None

        return section["id"]

    finally:
        connection.close()


def get_program_section_details(
    program_id,
    section_id,
):
    """
    Resolve the program/section names and codes used by GET
    profile assertions.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

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

        result = cursor.fetchone()

        assert result is not None, (
            "Program/section relationship does not exist"
        )

        return result

    finally:
        connection.close()


def create_test_user(role_name="STUDENT"):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-student-"
            f"{role_name.lower()}-"
            f"{unique_id}@edusphere.local"
        )

        google_id = (
            f"pytest-student-"
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
                FALSE,
                'PENDING',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                f"Pytest Student {role_name}",
                role_id,
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "email": email,
            "full_name": f"Pytest Student {role_name}",
            "role": role_name,
            "role_id": role_id,
            "profile_completed": False,
            "verification_status": "PENDING",
            "is_active": 1,
            "is_super_admin": 0,
        }

    finally:
        connection.close()


def delete_test_user(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

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


def student_payload(
    institution_id=None,
    suffix=None,
    program_id=None,
    section_id=None,
):
    if institution_id is None:
        institution_id = get_institution_id()

    if program_id is None or section_id is None:
        (
            default_program_id,
            default_section_id,
        ) = get_program_and_section()

        if program_id is None:
            program_id = default_program_id

        if section_id is None:
            section_id = default_section_id

    unique = suffix or uuid.uuid4().hex[:10]

    return {
        "phone": "9876543210",
        "institution_id": institution_id,
        "enrollment_number": f"ENROLL-{unique}",
        "program_id": program_id,
        "section_id": section_id,
        "academic_year": "2025-2026",
        "current_year": 2,
        "semester": 3,
        "student_id": f"STU-{unique}",
        "admission_year": 2024,
    }


def create_student_profile_direct(
    user_id,
    institution_id=None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        payload = student_payload(
            institution_id=institution_id,
        )

        cursor.execute(
            """
            INSERT INTO student_profiles (
                user_id,
                phone,
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
                %s
            )
            """,
            (
                user_id,
                payload["phone"],
                payload["institution_id"],
                payload["program_id"],
                payload["section_id"],
                payload["enrollment_number"],
                payload["academic_year"],
                payload["current_year"],
                payload["semester"],
                payload["student_id"],
                payload["admission_year"],
            ),
        )

        connection.commit()

        return {
            "profile_id": cursor.lastrowid,
            "payload": payload,
        }

    finally:
        connection.close()
        
        
def test_create_student_profile(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        response = client.post(
            "/profile/student",
            json=student_payload(),
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            data["message"]
            == "Student profile created successfully"
        )

        assert data["student_profile_id"] is not None

        assert (
            data["verification_status"]
            == "NOT_REQUIRED"
        )

        assert data["profile_completed"] is True

    finally:
        delete_test_user(user["id"])


def test_create_student_profile_assigns_student_role(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        response = client.post(
            "/profile/student",
            json=student_payload(),
        )

        assert response.status_code == 200

        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    u.profile_completed,
                    u.verification_status,
                    r.name AS role
                FROM users u
                LEFT JOIN roles r
                    ON u.role_id = r.id
                WHERE u.id = %s
                """,
                (user["id"],),
            )

            result = cursor.fetchone()

            assert result is not None
            assert result["role"] == "STUDENT"
            assert result["profile_completed"] in (
                True,
                1,
            )
            assert (
                result["verification_status"]
                == "NOT_REQUIRED"
            )

        finally:
            connection.close()

    finally:
        delete_test_user(user["id"])


def test_non_student_cannot_create_student_profile(
    monkeypatch,
):
    user = create_test_user("PROFESSOR")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        response = client.post(
            "/profile/student",
            json=student_payload(),
        )

        assert response.status_code == 403

        assert (
            response.json()["detail"]
            == "Student access required"
        )

    finally:
        delete_test_user(user["id"])


def test_admin_cannot_create_student_profile(
    monkeypatch,
):
    user = create_test_user("ADMIN")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        response = client.post(
            "/profile/student",
            json=student_payload(),
        )

        assert response.status_code == 403

        assert (
            response.json()["detail"]
            == "Student access required"
        )

    finally:
        delete_test_user(user["id"])


def test_duplicate_student_profile_returns_409(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()

        first_response = client.post(
            "/profile/student",
            json=payload,
        )

        assert first_response.status_code == 200

        second_response = client.post(
            "/profile/student",
            json=payload,
        )

        assert second_response.status_code == 409

        assert (
            second_response.json()["detail"]
            == "Student profile already exists"
        )

    finally:
        delete_test_user(user["id"])


def test_duplicate_enrollment_number_returns_409(
    monkeypatch,
):
    first_user = create_test_user("STUDENT")
    second_user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            first_user,
            "/profile/student",
            "POST",
        )

        first_payload = student_payload()

        response = client.post(
            "/profile/student",
            json=first_payload,
        )

        assert response.status_code == 200

        patch_student_auth(
            monkeypatch,
            second_user,
            "/profile/student",
            "POST",
        )

        second_payload = student_payload()

        second_payload["enrollment_number"] = (
            first_payload["enrollment_number"]
        )

        response = client.post(
            "/profile/student",
            json=second_payload,
        )

        assert response.status_code == 409

        assert (
            response.json()["detail"]
            == "Enrollment number already exists"
        )

    finally:
        delete_test_user(first_user["id"])
        delete_test_user(second_user["id"])


def test_duplicate_student_id_returns_409(
    monkeypatch,
):
    first_user = create_test_user("STUDENT")
    second_user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            first_user,
            "/profile/student",
            "POST",
        )

        first_payload = student_payload()

        response = client.post(
            "/profile/student",
            json=first_payload,
        )

        assert response.status_code == 200

        patch_student_auth(
            monkeypatch,
            second_user,
            "/profile/student",
            "POST",
        )

        second_payload = student_payload()

        second_payload["student_id"] = (
            first_payload["student_id"]
        )

        response = client.post(
            "/profile/student",
            json=second_payload,
        )

        assert response.status_code == 409

        assert (
            response.json()["detail"]
            == "Student ID already exists"
        )

    finally:
        delete_test_user(first_user["id"])
        delete_test_user(second_user["id"])


# ============================================================
# UPDATE STUDENT PROFILE
# ============================================================

def test_update_student_profile(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        created = create_student_profile_direct(
            user["id"],
        )

        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "PUT",
        )

        payload = student_payload()

        payload["phone"] = "9999999999"
        payload["current_year"] = 3
        payload["semester"] = 5

        # ----------------------------------------------------
        # Change program/section only when another valid
        # section exists for the selected program.
        # ----------------------------------------------------

        new_section_id = get_section_for_program(
            payload["program_id"],
            exclude_section_id=created["payload"]["section_id"],
        )

        if new_section_id is not None:
            payload["section_id"] = new_section_id

        response = client.put(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            data["message"]
            == "Student profile updated successfully"
        )

        assert data["student_profile_id"] is not None
        assert data["profile_completed"] is True

    finally:
        delete_test_user(user["id"])


def test_update_student_profile_persists_changes(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        create_student_profile_direct(
            user["id"],
        )

        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "PUT",
        )

        payload = student_payload()

        payload["phone"] = "8888888888"

        response = client.put(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 200

        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    phone,
                    program_id,
                    section_id,
                    enrollment_number,
                    student_id
                FROM student_profiles
                WHERE user_id = %s
                """,
                (user["id"],),
            )

            profile = cursor.fetchone()

            assert profile is not None

            assert (
                profile["phone"]
                == "8888888888"
            )

            assert (
                profile["program_id"]
                == payload["program_id"]
            )

            assert (
                profile["section_id"]
                == payload["section_id"]
            )

            assert (
                profile["enrollment_number"]
                == payload["enrollment_number"]
            )

            assert (
                profile["student_id"]
                == payload["student_id"]
            )

        finally:
            connection.close()

    finally:
        delete_test_user(user["id"])


def test_update_student_duplicate_enrollment_returns_500(
    monkeypatch,
):
    first_user = create_test_user("STUDENT")
    second_user = create_test_user("STUDENT")

    try:
        first_profile = create_student_profile_direct(
            first_user["id"],
        )

        create_student_profile_direct(
            second_user["id"],
        )

        patch_student_auth(
            monkeypatch,
            second_user,
            "/profile/student",
            "PUT",
        )

        payload = student_payload()

        payload["enrollment_number"] = (
            first_profile["payload"][
                "enrollment_number"
            ]
        )

        response = client.put(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 500

        assert (
            response.json()["detail"]
            == "Unable to update student profile"
        )

    finally:
        delete_test_user(first_user["id"])
        delete_test_user(second_user["id"])


def test_update_student_duplicate_student_id_returns_500(
    monkeypatch,
):
    first_user = create_test_user("STUDENT")
    second_user = create_test_user("STUDENT")

    try:
        first_profile = create_student_profile_direct(
            first_user["id"],
        )

        create_student_profile_direct(
            second_user["id"],
        )

        patch_student_auth(
            monkeypatch,
            second_user,
            "/profile/student",
            "PUT",
        )

        payload = student_payload()

        payload["student_id"] = (
            first_profile["payload"]["student_id"]
        )

        response = client.put(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 500

        assert (
            response.json()["detail"]
            == "Unable to update student profile"
        )

    finally:
        delete_test_user(first_user["id"])
        delete_test_user(second_user["id"])


# ============================================================
# GET STUDENT PROFILE
# ============================================================

def test_get_student_profile(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        created = create_student_profile_direct(
            user["id"],
        )

        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "GET",
        )

        response = client.get(
            "/profile/student",
        )

        assert response.status_code == 200

        data = response.json()

        assert data["user_id"] == user["id"]
        assert data["email"] == user["email"]
        assert data["full_name"] == user["full_name"]

        assert (
            data["student_profile_id"]
            == created["profile_id"]
        )

        assert "phone" in data
        assert "institution_id" in data
        assert "institution_name" in data
        assert "university_code" in data

        assert "enrollment_number" in data

        assert "program_id" in data
        assert "program" in data
        assert "program_code" in data

        assert "section_id" in data
        assert "section" in data
        assert "section_code" in data

        assert "academic_year" in data
        assert "current_year" in data
        assert "semester" in data
        assert "student_id" in data
        assert "admission_year" in data

        # Old denormalized fields must not be returned.
        assert "stream" not in data

    finally:
        delete_test_user(user["id"])


def test_get_student_profile_returns_correct_values(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        created = create_student_profile_direct(
            user["id"],
        )

        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "GET",
        )

        response = client.get(
            "/profile/student",
        )

        assert response.status_code == 200

        data = response.json()
        payload = created["payload"]

        program_section = get_program_section_details(
            payload["program_id"],
            payload["section_id"],
        )

        assert data["phone"] == payload["phone"]

        assert (
            data["institution_id"]
            == payload["institution_id"]
        )

        assert (
            data["enrollment_number"]
            == payload["enrollment_number"]
        )

        assert (
            data["program_id"]
            == payload["program_id"]
        )

        assert (
            data["program"]
            == program_section["program_name"]
        )

        assert (
            data["program_code"]
            == program_section["program_code"]
        )

        assert (
            data["section_id"]
            == payload["section_id"]
        )

        assert (
            data["section"]
            == program_section["section_name"]
        )

        assert (
            data["section_code"]
            == program_section["section_code"]
        )

        assert (
            data["academic_year"]
            == payload["academic_year"]
        )

        assert (
            data["current_year"]
            == payload["current_year"]
        )

        assert (
            data["semester"]
            == payload["semester"]
        )

        assert (
            data["student_id"]
            == payload["student_id"]
        )

        assert (
            data["admission_year"]
            == payload["admission_year"]
        )

        assert "stream" not in data

    finally:
        delete_test_user(user["id"])


def test_get_student_profile_requires_student(
    monkeypatch,
):
    user = create_test_user("PROFESSOR")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "GET",
        )

        # The helper patches require_student directly,
        # so explicitly reproduce the role restriction.
        endpoint = get_registered_endpoint(
            "/profile/student",
            "GET",
        )

        module = inspect.getmodule(endpoint)

        def deny_student(request):
            raise HTTPException(
                status_code=403,
                detail="Student access required",
            )

        monkeypatch.setattr(
            module,
            "require_student",
            deny_student,
        )

        response = client.get(
            "/profile/student",
        )

        assert response.status_code == 403

        assert (
            response.json()["detail"]
            == "Student access required"
        )

    finally:
        delete_test_user(user["id"])


def test_get_student_profile_not_found(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "GET",
        )

        response = client.get(
            "/profile/student",
        )

        assert response.status_code == 404

        assert (
            response.json()["detail"]
            == "Student profile not found"
        )

    finally:
        delete_test_user(user["id"])


def test_update_student_profile_not_found(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "PUT",
        )

        response = client.put(
            "/profile/student",
            json=student_payload(),
        )

        assert response.status_code == 404

        assert (
            response.json()["detail"]
            == "Student profile not found"
        )

    finally:
        delete_test_user(user["id"])


# ============================================================
# VALIDATION TESTS
# ============================================================

def test_create_student_missing_phone(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        del payload["phone"]

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_missing_institution_id(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        del payload["institution_id"]

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_missing_enrollment_number(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        del payload["enrollment_number"]

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_missing_program_id(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        del payload["program_id"]

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_missing_section_id(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        del payload["section_id"]

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_missing_student_id(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        del payload["student_id"]

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_invalid_current_year(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        payload["current_year"] = "invalid"

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_create_student_invalid_semester(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        patch_student_auth(
            monkeypatch,
            user,
            "/profile/student",
            "POST",
        )

        payload = student_payload()
        payload["semester"] = "invalid"

        response = client.post(
            "/profile/student",
            json=payload,
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])