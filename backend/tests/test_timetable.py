import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import timetable as timetable_route

client = TestClient(app)


# ============================================================
# HELPERS
# ============================================================


def get_admin_user():

    return {
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


def get_institution_id():

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


def get_program_id():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM programs
            WHERE institution_id = %s
            ORDER BY id
            LIMIT 1
            """,
            (get_institution_id(),),
        )

        program = cursor.fetchone()

        assert program is not None

        return program["id"]

    finally:
        connection.close()


def get_section_id():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM sections
            WHERE program_id = %s
            ORDER BY id
            LIMIT 1
            """,
            (get_program_id(),),
        )

        section = cursor.fetchone()

        assert section is not None

        return section["id"]

    finally:
        connection.close()


def get_course_id():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM courses
            WHERE institution_id = %s
              AND program_id = %s
            ORDER BY id
            LIMIT 1
            """,
            (
                get_institution_id(),
                get_program_id(),
            ),
        )

        course = cursor.fetchone()

        assert course is not None

        return course["id"]

    finally:
        connection.close()


def get_professor_role_id():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM roles
            WHERE name = 'PROFESSOR'
            LIMIT 1
            """
        )

        role = cursor.fetchone()

        assert role is not None

        return role["id"]

    finally:
        connection.close()


def create_test_professor():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-timetable-professor-{unique_id}"
            "@edusphere.local"
        )

        google_id = (
            f"pytest-timetable-professor-{unique_id}"
        )

        institution_id = get_institution_id()

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
                TRUE,
                'PENDING',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                "Pytest Timetable Professor",
                get_professor_role_id(),
            ),
        )

        user_id = cursor.lastrowid

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
                "Python",
                "5 years",
                "Room 204",
                "Pytest verification",
            ),
        )

        professor_id = cursor.lastrowid

        connection.commit()

        return {
            "user_id": user_id,
            "professor_id": professor_id,
            "email": email,
        }

    finally:
        connection.close()


def delete_test_professor(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

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

        cursor.execute(
            """
            DELETE FROM professor_profiles
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


def delete_timetable(timetable_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM timetables
            WHERE id = %s
            """,
            (timetable_id,),
        )

        connection.commit()

    finally:
        connection.close()


def timetable_payload():

    return {
        "institution_id": get_institution_id(),
        "program_id": get_program_id(),
        "section_id": get_section_id(),
        "course_id": get_course_id(),
        "academic_year": "2025-2029",
        "current_year": 1,
        "day": "Monday",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "room": "Room 101",
    }


# ============================================================
# CREATE
# ============================================================


def test_admin_can_create_timetable(monkeypatch):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    response = client.post(
        "/timetable/",
        json=timetable_payload(),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == (
        "Timetable created successfully"
    )

    assert data["timetable_id"] is not None

    delete_timetable(data["timetable_id"])


# ============================================================
# INVALID INSTITUTION
# ============================================================


def test_create_timetable_with_invalid_institution(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    payload = timetable_payload()

    payload["institution_id"] = 999999

    response = client.post(
        "/timetable/",
        json=payload,
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Institution not found"
    )


# ============================================================
# INVALID PROGRAM
# ============================================================


def test_create_timetable_with_invalid_program(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    payload = timetable_payload()

    payload["program_id"] = 999999

    response = client.post(
        "/timetable/",
        json=payload,
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Program not found"
    )


# ============================================================
# INVALID SECTION
# ============================================================


def test_create_timetable_with_invalid_section(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    payload = timetable_payload()

    payload["section_id"] = 999999

    response = client.post(
        "/timetable/",
        json=payload,
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Section not found"
    )


# ============================================================
# INVALID TIME
# ============================================================


def test_admin_cannot_create_invalid_time(monkeypatch):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    payload = timetable_payload()

    payload["start_time"] = "11:00:00"
    payload["end_time"] = "10:00:00"

    response = client.post(
        "/timetable/",
        json=payload,
    )

    assert response.status_code == 400

    assert (
        "Start time must be before end time"
        in response.json()["detail"]
    )


# ============================================================
# OVERLAPPING TIMETABLE
# ============================================================


def test_overlapping_timetable_is_rejected(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    payload = timetable_payload()

    first_response = client.post(
        "/timetable/",
        json=payload,
    )

    assert first_response.status_code == 200

    timetable_id = first_response.json()[
        "timetable_id"
    ]

    try:

        second_payload = {
            **payload,
            "start_time": "09:30:00",
            "end_time": "10:30:00",
        }

        second_response = client.post(
            "/timetable/",
            json=second_payload,
        )

        assert second_response.status_code == 409

        assert "Timetable conflict" in (
            second_response.json()["detail"]
        )

    finally:

        delete_timetable(timetable_id)


# ============================================================
# UPDATE
# ============================================================


def test_admin_can_update_timetable(monkeypatch):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    payload = timetable_payload()

    create_response = client.post(
        "/timetable/",
        json=payload,
    )

    assert create_response.status_code == 200

    timetable_id = create_response.json()[
        "timetable_id"
    ]

    try:

        updated_payload = {
            **payload,
            "day": "Tuesday",
            "start_time": "11:00:00",
            "end_time": "12:00:00",
            "room": "Room 202",
        }

        response = client.put(
            f"/timetable/{timetable_id}",
            json=updated_payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Timetable updated successfully"
        )

        assert data["timetable_id"] == timetable_id

    finally:

        delete_timetable(timetable_id)


# ============================================================
# UPDATE NONEXISTENT
# ============================================================


def test_update_nonexistent_timetable(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    response = client.put(
        "/timetable/999999",
        json=timetable_payload(),
    )

    assert response.status_code == 404

    assert "Timetable entry not found" in (
        response.json()["detail"]
    )


# ============================================================
# DELETE
# ============================================================


def test_admin_can_delete_timetable(monkeypatch):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    response = client.post(
        "/timetable/",
        json=timetable_payload(),
    )

    assert response.status_code == 200

    timetable_id = response.json()[
        "timetable_id"
    ]

    delete_response = client.delete(
        f"/timetable/{timetable_id}",
    )

    assert delete_response.status_code == 200

    data = delete_response.json()

    assert data["message"] == (
        "Timetable deleted successfully"
    )

    assert data["timetable_id"] == timetable_id


# ============================================================
# DELETE NONEXISTENT
# ============================================================


def test_delete_nonexistent_timetable(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    response = client.delete(
        "/timetable/999999",
    )

    assert response.status_code == 404

    assert "Timetable entry not found" in (
        response.json()["detail"]
    )


# ============================================================
# PROFESSOR ASSIGNMENT
# ============================================================


def test_admin_can_assign_professor(monkeypatch):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    professor = create_test_professor()

    response = client.post(
        "/timetable/",
        json=timetable_payload(),
    )

    assert response.status_code == 200

    timetable_id = response.json()[
        "timetable_id"
    ]

    try:

        assignment_response = client.put(
            f"/timetable/{timetable_id}/assign-professor",
            json={
                "professor_id": professor[
                    "professor_id"
                ],
            },
        )

        assert assignment_response.status_code == 200

        data = assignment_response.json()

        assert data["message"] == (
            "Professor assigned successfully"
        )

        assert data["professor_id"] == (
            professor["professor_id"]
        )

    finally:

        delete_timetable(timetable_id)

        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# REMOVE PROFESSOR
# ============================================================


def test_admin_can_remove_professor(monkeypatch):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    professor = create_test_professor()

    response = client.post(
        "/timetable/",
        json=timetable_payload(),
    )

    assert response.status_code == 200

    timetable_id = response.json()[
        "timetable_id"
    ]

    try:

        assign_response = client.put(
            f"/timetable/{timetable_id}/assign-professor",
            json={
                "professor_id": professor[
                    "professor_id"
                ],
            },
        )

        assert assign_response.status_code == 200

        remove_response = client.put(
            f"/timetable/{timetable_id}/assign-professor",
            json={
                "professor_id": None,
            },
        )

        assert remove_response.status_code == 200

        data = remove_response.json()

        assert data["message"] == (
            "Professor assignment removed"
        )

        assert data["professor_id"] is None

    finally:

        delete_timetable(timetable_id)

        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# INVALID PROFESSOR
# ============================================================


def test_assign_nonexistent_professor_is_rejected(
    monkeypatch,
):

    monkeypatch.setattr(
        timetable_route,
        "require_admin",
        lambda request: get_admin_user(),
    )

    response = client.post(
        "/timetable/",
        json=timetable_payload(),
    )

    assert response.status_code == 200

    timetable_id = response.json()[
        "timetable_id"
    ]

    try:

        assignment_response = client.put(
            f"/timetable/{timetable_id}/assign-professor",
            json={
                "professor_id": 999999,
            },
        )

        assert assignment_response.status_code == 404

        assert "Professor not found" in (
            assignment_response.json()["detail"]
        )

    finally:

        delete_timetable(timetable_id)