import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import professor_verification as verification_route

client = TestClient(app)


# ============================================================
# CONSTANTS
# ============================================================


SUPER_ADMIN_USER = {
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
# DATABASE HELPERS
# ============================================================


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


def create_test_professor():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-verification-{unique_id}"
            "@edusphere.local"
        )

        google_id = (
            f"pytest-verification-{unique_id}"
        )

        employee_id = (
            f"VERIFY-EMP-{unique_id[:8]}"
        )

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
                "Pytest Verification Professor",
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
                get_institution_id(),
                employee_id,
                "Computer Science",
                "Assistant Professor",
                "Artificial Intelligence",
                "Python, Machine Learning",
                "5 years",
                "Room 204",
                "Verification documents submitted",
            ),
        )

        professor_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO professor_verifications (
                professor_id,
                status,
                submitted_at
            )
            VALUES (
                %s,
                'PENDING',
                CURRENT_TIMESTAMP
            )
            """,
            (professor_id,),
        )

        connection.commit()

        return {
            "user_id": user_id,
            "professor_id": professor_id,
            "email": email,
            "google_id": google_id,
        }

    finally:
        connection.close()


def delete_test_professor(user_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE pv
            FROM professor_verifications pv
            INNER JOIN professor_profiles pp
                ON pv.professor_id = pp.id
            WHERE pp.user_id = %s
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


# ============================================================
# GET PENDING PROFESSORS
# ============================================================


def test_admin_can_get_pending_professors(monkeypatch):

    professor = create_test_professor()

    try:

        monkeypatch.setattr(
            verification_route,
            "require_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        response = client.get(
            "/professor-verifications/pending"
        )

        assert response.status_code == 200

        data = response.json()

        assert "count" in data
        assert "professors" in data

        matching = [
            item
            for item in data["professors"]
            if item["professor_id"]
            == professor["professor_id"]
        ]

        assert len(matching) == 1

        pending = matching[0]

        assert pending["verification_status"] == "PENDING"
        assert pending["email"] == professor["email"]
        assert pending["department"] == "Computer Science"

    finally:
        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# GET PROFESSOR VERIFICATION DETAILS
# ============================================================


def test_admin_can_get_professor_verification(
    monkeypatch,
):

    professor = create_test_professor()

    try:

        monkeypatch.setattr(
            verification_route,
            "require_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        response = client.get(
            f"/professor-verifications/"
            f"{professor['professor_id']}"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["professor_id"] == (
            professor["professor_id"]
        )

        assert data["user_id"] == professor["user_id"]

        assert data["email"] == professor["email"]

        assert data["verification_status"] == "PENDING"

        assert data["user_verification_status"] == "PENDING"

        assert data["employee_id"].startswith(
            "VERIFY-EMP-"
        )

    finally:
        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# NONEXISTENT PROFESSOR
# ============================================================


def test_get_nonexistent_professor_verification_returns_404(
    monkeypatch,
):

    monkeypatch.setattr(
        verification_route,
        "require_admin",
        lambda request: SUPER_ADMIN_USER,
    )

    response = client.get(
        "/professor-verifications/999999999"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Professor verification record not found"
    )


# ============================================================
# VERIFY PROFESSOR
# ============================================================


def test_admin_can_verify_professor(monkeypatch):

    professor = create_test_professor()

    try:

        monkeypatch.setattr(
            verification_route,
            "require_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        response = client.put(
            f"/professor-verifications/"
            f"{professor['professor_id']}/verify",
            json={
                "remarks": "Documents verified successfully",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Professor verified successfully"
        )

        assert data["professor_id"] == (
            professor["professor_id"]
        )

        assert data["verification_status"] == "VERIFIED"

        assert data["remarks"] == (
            "Documents verified successfully"
        )

        assert data["verified_by"] == 1

        # ----------------------------------------------------
        # Verify database
        # ----------------------------------------------------

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    status,
                    remarks,
                    verified_by,
                    verified_at
                FROM professor_verifications
                WHERE professor_id = %s
                """,
                (professor["professor_id"],),
            )

            verification = cursor.fetchone()

            assert verification is not None

            assert verification["status"] == "VERIFIED"

            assert verification["remarks"] == (
                "Documents verified successfully"
            )

            assert verification["verified_by"] == 1

            assert verification["verified_at"] is not None

            # ------------------------------------------------
            # Verify users table
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT verification_status
                FROM users
                WHERE id = %s
                """,
                (professor["user_id"],),
            )

            user = cursor.fetchone()

            assert user is not None

            assert user["verification_status"] == (
                "VERIFIED"
            )

        finally:
            connection.close()

    finally:
        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# REJECT PROFESSOR
# ============================================================


def test_admin_can_reject_professor(monkeypatch):

    professor = create_test_professor()

    try:

        monkeypatch.setattr(
            verification_route,
            "require_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        response = client.put(
            f"/professor-verifications/"
            f"{professor['professor_id']}/reject",
            json={
                "remarks": "Please provide a valid employment document",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Professor rejected successfully"
        )

        assert data["professor_id"] == (
            professor["professor_id"]
        )

        assert data["verification_status"] == "REJECTED"

        assert data["remarks"] == (
            "Please provide a valid employment document"
        )

        assert data["verified_by"] == 1

        # ----------------------------------------------------
        # Verify database
        # ----------------------------------------------------

        connection = get_connection()

        try:

            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    status,
                    remarks,
                    verified_by,
                    verified_at
                FROM professor_verifications
                WHERE professor_id = %s
                """,
                (professor["professor_id"],),
            )

            verification = cursor.fetchone()

            assert verification is not None

            assert verification["status"] == "REJECTED"

            assert verification["remarks"] == (
                "Please provide a valid employment document"
            )

            assert verification["verified_by"] == 1

            assert verification["verified_at"] is not None

            # ------------------------------------------------
            # Verify users table
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT verification_status
                FROM users
                WHERE id = %s
                """,
                (professor["user_id"],),
            )

            user = cursor.fetchone()

            assert user is not None

            assert user["verification_status"] == (
                "REJECTED"
            )

        finally:
            connection.close()

    finally:
        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# ALREADY VERIFIED
# ============================================================


def test_verified_professor_cannot_be_verified_again(
    monkeypatch,
):

    professor = create_test_professor()

    try:

        monkeypatch.setattr(
            verification_route,
            "require_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        first_response = client.put(
            f"/professor-verifications/"
            f"{professor['professor_id']}/verify",
            json={
                "remarks": "Verified",
            },
        )

        assert first_response.status_code == 200

        second_response = client.put(
            f"/professor-verifications/"
            f"{professor['professor_id']}/verify",
            json={
                "remarks": "Trying again",
            },
        )

        assert second_response.status_code == 409

        assert second_response.json()["detail"] == (
            "Professor verification has already been processed"
        )

    finally:
        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# ALREADY REJECTED
# ============================================================


def test_rejected_professor_cannot_be_rejected_again(
    monkeypatch,
):

    professor = create_test_professor()

    try:

        monkeypatch.setattr(
            verification_route,
            "require_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        first_response = client.put(
            f"/professor-verifications/"
            f"{professor['professor_id']}/reject",
            json={
                "remarks": "Rejected",
            },
        )

        assert first_response.status_code == 200

        second_response = client.put(
            f"/professor-verifications/"
            f"{professor['professor_id']}/reject",
            json={
                "remarks": "Trying again",
            },
        )

        assert second_response.status_code == 409

        assert second_response.json()["detail"] == (
            "Professor verification has already been processed"
        )

    finally:
        delete_test_professor(
            professor["user_id"]
        )


# ============================================================
# VERIFY NONEXISTENT PROFESSOR
# ============================================================


def test_verify_nonexistent_professor_returns_404(
    monkeypatch,
):

    monkeypatch.setattr(
        verification_route,
        "require_admin",
        lambda request: SUPER_ADMIN_USER,
    )

    response = client.put(
        "/professor-verifications/"
        "999999999/verify",
        json={
            "remarks": "Verified",
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Professor verification record not found"
    )


# ============================================================
# REJECT NONEXISTENT PROFESSOR
# ============================================================


def test_reject_nonexistent_professor_returns_404(
    monkeypatch,
):

    monkeypatch.setattr(
        verification_route,
        "require_admin",
        lambda request: SUPER_ADMIN_USER,
    )

    response = client.put(
        "/professor-verifications/"
        "999999999/reject",
        json={
            "remarks": "Rejected",
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Professor verification record not found"
    )


# ============================================================
# ADMIN AUTHORIZATION
# ============================================================


def test_pending_professors_requires_admin(
    monkeypatch,
):

    def reject_non_admin(request):

        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    monkeypatch.setattr(
        verification_route,
        "require_admin",
        reject_non_admin,
    )

    response = client.get(
        "/professor-verifications/pending"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Admin access required"
    )


# ============================================================
# VERIFICATION DETAIL AUTHORIZATION
# ============================================================


def test_professor_verification_detail_requires_admin(
    monkeypatch,
):

    def reject_non_admin(request):

        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    monkeypatch.setattr(
        verification_route,
        "require_admin",
        reject_non_admin,
    )

    response = client.get(
        "/professor-verifications/1"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Admin access required"
    )