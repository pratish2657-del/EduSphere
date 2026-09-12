import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import course as course_route

client = TestClient(app)


# ============================================================
# TEST ADMIN
# ============================================================

ADMIN_USER = {
    "id": 1,
    "email": "pratish2657@gmail.com",
    "full_name": "Super Admin",
    "role_id": 1,
    "role": "SUPER_ADMIN",
    "profile_completed": True,
    "verification_status": "NOT_REQUIRED",
    "is_active": 1,
    "is_super_admin": 1,
}


# ============================================================
# HELPERS
# ============================================================


def get_test_institution_id():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM institutions
            WHERE name = %s
            LIMIT 1
            """,
            (
                "University of Engineering & Management, Kolkata",
            ),
        )

        institution = cursor.fetchone()

        assert institution is not None

        return institution["id"]

    finally:
        connection.close()


def get_test_program_id():
    institution_id = get_test_institution_id()

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

        assert program is not None

        return program["id"]

    finally:
        connection.close()


def create_test_course():
    institution_id = get_test_institution_id()
    program_id = get_test_program_id()

    unique_id = uuid.uuid4().hex[:8]

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
                f"Pytest Course {unique_id}",
                f"PY-{unique_id}",
                1,
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "institution_id": institution_id,
            "program_id": program_id,
            "name": f"Pytest Course {unique_id}",
            "code": f"PY-{unique_id}",
        }

    finally:
        connection.close()


def delete_test_course(course_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM courses
            WHERE id = %s
            """,
            (course_id,),
        )

        connection.commit()

    finally:
        connection.close()


# ============================================================
# LIST COURSES
# ============================================================


def test_admin_can_list_courses(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.get("/courses/")

    assert response.status_code == 200

    data = response.json()

    assert "count" in data
    assert "courses" in data
    assert isinstance(data["courses"], list)


# ============================================================
# CREATE COURSE
# ============================================================


def test_super_admin_can_create_course(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = get_test_institution_id()
    program_id = get_test_program_id()

    unique_id = uuid.uuid4().hex[:8]

    course_id = None

    try:
        response = client.post(
            "/courses/",
            json={
                "institution_id": institution_id,
                "program_id": program_id,
                "name": f"Pytest Course {unique_id}",
                "code": f"PY-{unique_id}",
                "semester": 1,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Course created successfully"
        )

        assert data["institution_id"] == institution_id
        assert data["program_id"] == program_id
        assert data["name"] == f"Pytest Course {unique_id}"
        assert data["code"] == f"PY-{unique_id}"
        assert data["semester"] == 1

        course_id = data["course_id"]

        # ----------------------------------------------------
        # Verify database
        # ----------------------------------------------------

        connection = get_connection()

        try:
            cursor = connection.cursor()

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
                """,
                (course_id,),
            )

            course = cursor.fetchone()

        finally:
            connection.close()

        assert course is not None
        assert course["institution_id"] == institution_id
        assert course["program_id"] == program_id
        assert course["name"] == f"Pytest Course {unique_id}"
        assert course["code"] == f"PY-{unique_id}"
        assert course["semester"] == 1

    finally:
        if course_id:
            delete_test_course(course_id)


# ============================================================
# DUPLICATE COURSE CODE
# ============================================================


def test_duplicate_course_code_is_rejected(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = get_test_institution_id()
    program_id = get_test_program_id()

    unique_id = uuid.uuid4().hex[:8]
    code = f"DUP-{unique_id}"

    course_id = None

    try:
        first_response = client.post(
            "/courses/",
            json={
                "institution_id": institution_id,
                "program_id": program_id,
                "name": "First Pytest Course",
                "code": code,
                "semester": 1,
            },
        )

        assert first_response.status_code == 200

        course_id = first_response.json()["course_id"]

        second_response = client.post(
            "/courses/",
            json={
                "institution_id": institution_id,
                "program_id": program_id,
                "name": "Second Pytest Course",
                "code": code,
                "semester": 2,
            },
        )

        assert second_response.status_code == 409

        assert (
            "already exists"
            in second_response.json()["detail"]
        )

    finally:
        if course_id:
            delete_test_course(course_id)


# ============================================================
# INVALID INSTITUTION
# ============================================================


def test_create_course_with_invalid_institution(
    monkeypatch,
):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = 999999999
    program_id = get_test_program_id()

    response = client.post(
        "/courses/",
        json={
            "institution_id": institution_id,
            "program_id": program_id,
            "name": "Invalid Institution Course",
            "code": f"INVALID-{uuid.uuid4().hex[:8]}",
            "semester": 1,
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Institution not found"
    )


# ============================================================
# INVALID PROGRAM
# ============================================================


def test_create_course_with_invalid_program(
    monkeypatch,
):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = get_test_institution_id()

    response = client.post(
        "/courses/",
        json={
            "institution_id": institution_id,
            "program_id": 999999999,
            "name": "Invalid Program Course",
            "code": f"INVALID-PROGRAM-{uuid.uuid4().hex[:8]}",
            "semester": 1,
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Program not found"
    )


# ============================================================
# PROGRAM FROM DIFFERENT INSTITUTION
# ============================================================


def test_create_course_with_program_from_different_institution(
    monkeypatch,
):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = get_test_institution_id()

    connection = get_connection()

    other_institution_id = None
    program_id = None

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find another institution
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM institutions
            WHERE id != %s
            LIMIT 1
            """,
            (institution_id,),
        )

        other_institution = cursor.fetchone()

        if other_institution:
            other_institution_id = other_institution["id"]

        # ----------------------------------------------------
        # Find program belonging to another institution
        # ----------------------------------------------------

        if other_institution_id:

            cursor.execute(
                """
                SELECT id
                FROM programs
                WHERE institution_id = %s
                  AND is_active = TRUE
                LIMIT 1
                """,
                (other_institution_id,),
            )

            program = cursor.fetchone()

            if program:
                program_id = program["id"]

    finally:
        connection.close()

    # --------------------------------------------------------
    # If database only contains one institution/program,
    # there is nothing to test.
    # --------------------------------------------------------

    if other_institution_id is None or program_id is None:
        return

    response = client.post(
        "/courses/",
        json={
            "institution_id": institution_id,
            "program_id": program_id,
            "name": "Wrong Program Course",
            "code": f"WRONG-PROGRAM-{uuid.uuid4().hex[:8]}",
            "semester": 1,
        },
    )

    assert response.status_code == 409

    assert response.json()["detail"] == (
        "Program does not belong to this institution"
    )


# ============================================================
# UPDATE COURSE
# ============================================================


def test_super_admin_can_update_course(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    course = create_test_course()

    try:
        response = client.put(
            f"/courses/{course['id']}",
            json={
                "name": "Updated Pytest Course",
                "code": f"UPDATED-{uuid.uuid4().hex[:8]}",
                "semester": 3,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Course updated successfully"
        )

        assert data["course_id"] == course["id"]
        assert data["name"] == "Updated Pytest Course"
        assert data["semester"] == 3

        # ----------------------------------------------------
        # Verify database
        # ----------------------------------------------------

        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    name,
                    code,
                    semester,
                    program_id
                FROM courses
                WHERE id = %s
                """,
                (course["id"],),
            )

            updated_course = cursor.fetchone()

        finally:
            connection.close()

        assert updated_course is not None

        assert updated_course["name"] == (
            "Updated Pytest Course"
        )

        assert updated_course["semester"] == 3

        assert updated_course["program_id"] == (
            course["program_id"]
        )

    finally:
        delete_test_course(course["id"])


# ============================================================
# UPDATE NONEXISTENT COURSE
# ============================================================


def test_update_nonexistent_course(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.put(
        "/courses/999999999",
        json={
            "name": "Does Not Exist",
            "code": "NO-COURSE",
            "semester": 1,
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Course not found"
    )


# ============================================================
# DELETE COURSE
# ============================================================


def test_super_admin_can_delete_course(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    course = create_test_course()

    response = client.delete(
        f"/courses/{course['id']}"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == (
        "Course deleted successfully"
    )

    assert data["course_id"] == course["id"]

    # --------------------------------------------------------
    # Verify deletion
    # --------------------------------------------------------

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM courses
            WHERE id = %s
            """,
            (course["id"],),
        )

        deleted_course = cursor.fetchone()

    finally:
        connection.close()

    assert deleted_course is None


# ============================================================
# DELETE NONEXISTENT COURSE
# ============================================================


def test_delete_nonexistent_course(monkeypatch):

    monkeypatch.setattr(
        course_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.delete(
        "/courses/999999999"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Course not found"
    )