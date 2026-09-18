import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import section as section_route

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


def get_program_id():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        institution_id = get_institution_id()

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
            "No active program exists for testing"
        )

        return program["id"]

    finally:
        connection.close()


def create_test_program():
    institution_id = get_institution_id()

    unique = uuid.uuid4().hex[:8].upper()

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
                f"Pytest Section Program {unique}",
                f"SEC-PROG-{unique}",
                "B.Tech",
                4,
            ),
        )

        connection.commit()

        return cursor.lastrowid

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


def create_test_section(program_id):
    unique = uuid.uuid4().hex[:8].upper()

    connection = get_connection()

    try:
        cursor = connection.cursor()

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
                TRUE
            )
            """,
            (
                program_id,
                f"Pytest Section {unique}",
                f"SEC-{unique}",
                2026,
                2030,
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "program_id": program_id,
            "code": f"SEC-{unique}",
        }

    finally:
        connection.close()


def delete_test_section(section_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM sections
            WHERE id = %s
            """,
            (section_id,),
        )

        connection.commit()

    finally:
        connection.close()


# ============================================================
# LIST
# ============================================================


def test_admin_can_list_sections(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.get("/sections/")

    assert response.status_code == 200

    data = response.json()

    assert "count" in data
    assert "sections" in data

    assert isinstance(
        data["sections"],
        list,
    )

    assert isinstance(
        data["count"],
        int,
    )


# ============================================================
# CREATE
# ============================================================


def test_admin_can_create_section(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    program_id = get_program_id()

    # IMPORTANT:
    # UUID hex is converted to uppercase because the API
    # normalizes section codes to uppercase.
    unique = uuid.uuid4().hex[:8].upper()

    expected_code = f"PY-{unique}"

    response = client.post(
        "/sections/",
        json={
            "program_id": program_id,
            "name": f"Pytest Section {unique}",
            "code": expected_code,
            "batch_start_year": 2026,
            "batch_end_year": 2030,
            "is_active": True,
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["message"] == (
        "Section created successfully"
    )

    assert data["section_id"] is not None

    assert data["program_id"] == program_id

    assert data["code"] == expected_code

    section_id = data["section_id"]

    try:
        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    id,
                    program_id,
                    name,
                    code,
                    batch_start_year,
                    batch_end_year,
                    is_active
                FROM sections
                WHERE id = %s
                """,
                (section_id,),
            )

            section = cursor.fetchone()

        finally:
            connection.close()

        assert section is not None

        assert section["program_id"] == program_id

        assert section["code"] == expected_code

        assert section["batch_start_year"] == 2026

        assert section["batch_end_year"] == 2030

        assert section["is_active"] in (
            True,
            1,
        )

    finally:
        delete_test_section(section_id)


# ============================================================
# INVALID PROGRAM
# ============================================================


def test_create_section_invalid_program(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    unique = uuid.uuid4().hex[:8].upper()

    response = client.post(
        "/sections/",
        json={
            "program_id": 999999999,
            "name": "Invalid Section",
            "code": f"INVALID-{unique}",
            "batch_start_year": 2026,
            "batch_end_year": 2030,
            "is_active": True,
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Program not found"
    )


# ============================================================
# INVALID BATCH YEARS
# ============================================================


def test_create_section_invalid_batch_years(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.post(
        "/sections/",
        json={
            "program_id": get_program_id(),
            "name": "Invalid Batch Section",
            "code": (
                f"INVALID-{uuid.uuid4().hex[:8].upper()}"
            ),
            "batch_start_year": 2030,
            "batch_end_year": 2026,
            "is_active": True,
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Batch start year must be before or "
        "equal to batch end year"
    )


# ============================================================
# DUPLICATE CODE
# ============================================================


def test_duplicate_section_code_is_rejected(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    program_id = get_program_id()

    unique = uuid.uuid4().hex[:8].upper()

    code = f"DUP-{unique}"

    first_response = client.post(
        "/sections/",
        json={
            "program_id": program_id,
            "name": "First Section",
            "code": code,
            "batch_start_year": 2026,
            "batch_end_year": 2030,
            "is_active": True,
        },
    )

    assert first_response.status_code == 200, (
        first_response.text
    )

    section_id = first_response.json()["section_id"]

    try:
        second_response = client.post(
            "/sections/",
            json={
                "program_id": program_id,
                "name": "Second Section",
                "code": code,
                "batch_start_year": 2026,
                "batch_end_year": 2030,
                "is_active": True,
            },
        )

        assert second_response.status_code == 409

        assert "already exists" in (
            second_response.json()["detail"]
        )

    finally:
        delete_test_section(section_id)


# ============================================================
# UPDATE
# ============================================================


def test_admin_can_update_section(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    section = create_test_section(
        get_program_id()
    )

    try:
        # IMPORTANT:
        # Keep the generated value uppercase because the API
        # returns normalized uppercase section codes.
        new_code = (
            f"UPDATED-{uuid.uuid4().hex[:8].upper()}"
        )

        response = client.put(
            f"/sections/{section['id']}",
            json={
                "name": "Updated Pytest Section",
                "code": new_code,
                "batch_start_year": 2027,
                "batch_end_year": 2031,
                "is_active": True,
            },
        )

        assert response.status_code == 200, response.text

        data = response.json()

        assert data["message"] == (
            "Section updated successfully"
        )

        assert data["section_id"] == section["id"]

        assert data["name"] == (
            "Updated Pytest Section"
        )

        assert data["code"] == new_code

        assert data["batch_start_year"] == 2027

        assert data["batch_end_year"] == 2031

    finally:
        delete_test_section(section["id"])


# ============================================================
# UPDATE NONEXISTENT
# ============================================================


def test_update_nonexistent_section(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.put(
        "/sections/999999999",
        json={
            "name": "Does Not Exist",
            "code": "NO-SECTION",
            "batch_start_year": 2026,
            "batch_end_year": 2030,
            "is_active": True,
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Section not found"
    )


# ============================================================
# DELETE
# ============================================================


def test_admin_can_delete_section(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    section = create_test_section(
        get_program_id()
    )

    response = client.delete(
        f"/sections/{section['id']}"
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["message"] == (
        "Section deleted successfully"
    )

    assert data["section_id"] == section["id"]

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM sections
            WHERE id = %s
            """,
            (section["id"],),
        )

        deleted_section = cursor.fetchone()

    finally:
        connection.close()

    assert deleted_section is None


# ============================================================
# DELETE NONEXISTENT
# ============================================================


def test_delete_nonexistent_section(monkeypatch):
    monkeypatch.setattr(
        section_route,
        "require_admin",
        lambda request: ADMIN_USER,
    )

    response = client.delete(
        "/sections/999999999"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Section not found"
    )