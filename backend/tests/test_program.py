import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import program as program_route

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


def create_test_program():
    institution_id = get_institution_id()

    # Use uppercase because the application stores program
    # codes in uppercase.
    unique = uuid.uuid4().hex[:8].upper()

    name = f"Pytest Program {unique}"
    code = f"PY-{unique}"

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO programs (
                institution_id,
                name,
                code,
                degree,
                duration_years,
                is_active
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                TRUE
            )
            """,
            (
                institution_id,
                name,
                code,
                "B.Tech",
                4,
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "institution_id": institution_id,
            "name": name,
            "code": code,
        }

    finally:
        connection.close()


def delete_test_program(program_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM programs
            WHERE id = %s
            """,
            (program_id,),
        )

        connection.commit()

    finally:
        connection.close()


# ============================================================
# LIST PROGRAMS
# ============================================================


def test_admin_can_list_programs(monkeypatch):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.get(
        "/programs/"
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert "count" in data
    assert "programs" in data

    assert isinstance(
        data["count"],
        int,
    )

    assert isinstance(
        data["programs"],
        list,
    )

    assert data["count"] == len(
        data["programs"]
    )


# ============================================================
# CREATE PROGRAM
# ============================================================


def test_admin_can_create_program(monkeypatch):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = get_institution_id()

    # --------------------------------------------------------
    # Generate uppercase test code because the backend stores
    # program codes in uppercase.
    # --------------------------------------------------------

    unique = uuid.uuid4().hex[:8].upper()

    expected_code = f"PY-{unique}"

    response = client.post(
        "/programs/",
        json={
            "institution_id": institution_id,
            "name": f"Pytest Program {unique}",
            "code": expected_code,
            "degree": "B.Tech",
            "duration_years": 4,
            "is_active": True,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["message"] == (
        "Program created successfully"
    )

    assert data["program_id"] is not None

    assert data["institution_id"] == institution_id

    # --------------------------------------------------------
    # IMPORTANT:
    # The backend returns/stores uppercase codes.
    # --------------------------------------------------------

    assert data["code"] == expected_code

    program_id = data["program_id"]

    try:

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    id,
                    institution_id,
                    name,
                    code,
                    degree,
                    duration_years,
                    is_active
                FROM programs
                WHERE id = %s
                """,
                (program_id,),
            )

            program = cursor.fetchone()

        finally:
            connection.close()

        assert program is not None

        assert program["id"] == program_id

        assert program["institution_id"] == (
            institution_id
        )

        assert program["code"] == expected_code

        assert program["degree"] == "B.Tech"

        assert program["duration_years"] == 4

        assert program["is_active"] in (
            True,
            1,
        )

    finally:
        delete_test_program(program_id)


# ============================================================
# CREATE PROGRAM — INVALID INSTITUTION
# ============================================================


def test_create_program_invalid_institution(
    monkeypatch,
):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    invalid_institution_id = 999999999

    response = client.post(
        "/programs/",
        json={
            "institution_id": invalid_institution_id,
            "name": "Invalid Program",
            "code": (
                f"INVALID-"
                f"{uuid.uuid4().hex[:8].upper()}"
            ),
            "degree": "B.Tech",
            "duration_years": 4,
            "is_active": True,
        },
    )

    assert response.status_code == 404, (
        response.text
    )

    assert response.json()["detail"] == (
        "Institution not found"
    )


# ============================================================
# DUPLICATE PROGRAM CODE
# ============================================================


def test_duplicate_program_code_is_rejected(
    monkeypatch,
):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    institution_id = get_institution_id()

    unique = uuid.uuid4().hex[:8].upper()

    code = f"DUP-{unique}"

    first_response = client.post(
        "/programs/",
        json={
            "institution_id": institution_id,
            "name": "First Program",
            "code": code,
            "degree": "B.Tech",
            "duration_years": 4,
            "is_active": True,
        },
    )

    assert first_response.status_code == 200, (
        first_response.text
    )

    first_data = first_response.json()

    program_id = first_data["program_id"]

    try:

        assert first_data["code"] == code

        second_response = client.post(
            "/programs/",
            json={
                "institution_id": institution_id,
                "name": "Second Program",
                "code": code,
                "degree": "B.Tech",
                "duration_years": 4,
                "is_active": True,
            },
        )

        assert second_response.status_code == 409, (
            second_response.text
        )

        assert "already exists" in (
            second_response.json()["detail"]
        )

    finally:

        delete_test_program(program_id)


# ============================================================
# UPDATE PROGRAM
# ============================================================


def test_admin_can_update_program(monkeypatch):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    program = create_test_program()

    try:

        # ----------------------------------------------------
        # Generate uppercase code because backend stores
        # program codes in uppercase.
        # ----------------------------------------------------

        unique = uuid.uuid4().hex[:8].upper()

        new_code = f"UPDATED-{unique}"

        response = client.put(
            f"/programs/{program['id']}",
            json={
                "name": "Updated Pytest Program",
                "code": new_code,
                "degree": "M.Tech",
                "duration_years": 2,
                "is_active": True,
            },
        )

        assert response.status_code == 200, (
            response.text
        )

        data = response.json()

        assert data["message"] == (
            "Program updated successfully"
        )

        assert data["program_id"] == (
            program["id"]
        )

        assert data["name"] == (
            "Updated Pytest Program"
        )

        assert data["code"] == new_code

        assert data["degree"] == "M.Tech"

        assert data["duration_years"] == 2

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
                    name,
                    code,
                    degree,
                    duration_years,
                    is_active
                FROM programs
                WHERE id = %s
                """,
                (program["id"],),
            )

            updated_program = cursor.fetchone()

        finally:
            connection.close()

        assert updated_program is not None

        assert updated_program["id"] == (
            program["id"]
        )

        assert updated_program["institution_id"] == (
            program["institution_id"]
        )

        assert updated_program["name"] == (
            "Updated Pytest Program"
        )

        assert updated_program["code"] == (
            new_code
        )

        assert updated_program["degree"] == (
            "M.Tech"
        )

        assert updated_program["duration_years"] == 2

        assert updated_program["is_active"] in (
            True,
            1,
        )

    finally:

        delete_test_program(
            program["id"]
        )


# ============================================================
# UPDATE NONEXISTENT PROGRAM
# ============================================================


def test_update_nonexistent_program(monkeypatch):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.put(
        "/programs/999999999",
        json={
            "name": "Does Not Exist",
            "code": "NO-PROGRAM",
            "degree": "B.Tech",
            "duration_years": 4,
            "is_active": True,
        },
    )

    assert response.status_code == 404, (
        response.text
    )

    assert response.json()["detail"] == (
        "Program not found"
    )


# ============================================================
# DELETE PROGRAM
# ============================================================


def test_admin_can_delete_program(monkeypatch):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    program = create_test_program()

    try:

        response = client.delete(
            f"/programs/{program['id']}"
        )

        assert response.status_code == 200, (
            response.text
        )

        data = response.json()

        assert data["message"] == (
            "Program deleted successfully"
        )

        assert data["program_id"] == (
            program["id"]
        )

        # ----------------------------------------------------
        # Verify database deletion
        # ----------------------------------------------------

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id
                FROM programs
                WHERE id = %s
                """,
                (program["id"],),
            )

            deleted_program = cursor.fetchone()

        finally:

            connection.close()

        assert deleted_program is None

    finally:

        # Safe cleanup if deletion did not happen.
        delete_test_program(
            program["id"]
        )


# ============================================================
# DELETE NONEXISTENT PROGRAM
# ============================================================


def test_delete_nonexistent_program(
    monkeypatch,
):

    monkeypatch.setattr(
        program_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.delete(
        "/programs/999999999"
    )

    assert response.status_code == 404, (
        response.text
    )

    assert response.json()["detail"] == (
        "Program not found"
    )