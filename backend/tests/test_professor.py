import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import professor as professor_route

client = TestClient(app)


# ============================================================
# HELPERS
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


def create_test_professor_user():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = f"pytest-professor-{unique_id}@edusphere.local"
        google_id = f"pytest-professor-{unique_id}"

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
                'NOT_REQUIRED',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                "Pytest Professor User",
                get_professor_role_id(),
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "email": email,
            "full_name": "Pytest Professor User",
            "google_id": google_id,
        }

    finally:
        connection.close()


def delete_test_professor_user(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # Delete verification records first.
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

        # Delete professor profile.
        cursor.execute(
            """
            DELETE FROM professor_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        # Delete user.
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


def professor_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": get_professor_role_id(),
        "role": "PROFESSOR",
        "profile_completed": True,
        "verification_status": "PENDING",
        "is_active": 1,
        "is_super_admin": 0,
    }


def professor_payload():
    unique_id = uuid.uuid4().hex[:8]

    return {
        "phone": "9876543210",
        "institution_id": get_institution_id(),
        "employee_id": f"EMP-{unique_id}",
        "department": "Computer Science",
        "designation": "Assistant Professor",
        "specialization": "Artificial Intelligence",
        "subjects": "Python, Machine Learning",
        "academic_experience": "5 years",
        "office_information": "Room 204",
        "verification_details": "Faculty verification documents submitted",
    }


# ============================================================
# CREATE PROFESSOR PROFILE
# ============================================================


def test_create_professor_profile(monkeypatch):

    user = create_test_professor_user()

    try:
        test_user = professor_user(user)

        monkeypatch.setattr(
            professor_route,
            "require_professor",
            lambda request: test_user,
        )

        payload = professor_payload()

        response = client.post(
            "/profile/professor",
            json=payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Professor profile submitted successfully"
        )

        assert data["verification_status"] == "PENDING"
        assert data["profile_completed"] is True
        assert data["professor_id"] is not None

        professor_id = data["professor_id"]

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
                    u.profile_completed,
                    u.verification_status
                FROM users u
                LEFT JOIN roles r
                    ON u.role_id = r.id
                WHERE u.id = %s
                """,
                (user["id"],),
            )

            database_user = cursor.fetchone()

            assert database_user is not None
            assert database_user["role_id"] == get_professor_role_id()
            assert database_user["role"] == "PROFESSOR"
            assert database_user["profile_completed"] == 1
            assert database_user["verification_status"] == "PENDING"

            # ------------------------------------------------
            # Verify professor profile
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT
                    id,
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
                FROM professor_profiles
                WHERE id = %s
                """,
                (professor_id,),
            )

            profile = cursor.fetchone()

            assert profile is not None
            assert profile["user_id"] == user["id"]
            assert profile["phone"] == payload["phone"]
            assert profile["institution_id"] == payload["institution_id"]
            assert profile["employee_id"] == payload["employee_id"]
            assert profile["department"] == payload["department"]
            assert profile["designation"] == payload["designation"]
            assert profile["specialization"] == payload["specialization"]
            assert profile["subjects"] == payload["subjects"]

            # ------------------------------------------------
            # Verify verification record
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT
                    professor_id,
                    status
                FROM professor_verifications
                WHERE professor_id = %s
                """,
                (professor_id,),
            )

            verification = cursor.fetchone()

        finally:
            connection.close()

        assert verification is not None
        assert verification["professor_id"] == professor_id
        assert verification["status"] == "PENDING"

    finally:
        delete_test_professor_user(user["id"])


# ============================================================
# DUPLICATE PROFESSOR PROFILE
# ============================================================


def test_duplicate_professor_profile_is_rejected(monkeypatch):

    user = create_test_professor_user()

    try:
        test_user = professor_user(user)

        monkeypatch.setattr(
            professor_route,
            "require_professor",
            lambda request: test_user,
        )

        payload = professor_payload()

        first_response = client.post(
            "/profile/professor",
            json=payload,
        )

        assert first_response.status_code == 200

        second_response = client.post(
            "/profile/professor",
            json=payload,
        )

        assert second_response.status_code == 409

        assert "already exists" in (
            second_response.json()["detail"].lower()
        )

    finally:
        delete_test_professor_user(user["id"])


# ============================================================
# UPDATE PROFESSOR PROFILE
# ============================================================


def test_update_professor_profile(monkeypatch):

    user = create_test_professor_user()

    try:
        test_user = professor_user(user)

        monkeypatch.setattr(
            professor_route,
            "require_professor",
            lambda request: test_user,
        )

        # ----------------------------------------------------
        # Create initial profile
        # ----------------------------------------------------

        create_response = client.post(
            "/profile/professor",
            json=professor_payload(),
        )

        assert create_response.status_code == 200

        professor_id = create_response.json()["professor_id"]

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        updated_payload = professor_payload()

        updated_payload["phone"] = "9123456789"
        updated_payload["department"] = "Information Technology"
        updated_payload["designation"] = "Associate Professor"
        updated_payload["specialization"] = "Data Science"
        updated_payload["subjects"] = "Python, Data Science"
        updated_payload["academic_experience"] = "8 years"
        updated_payload["office_information"] = "Room 305"
        updated_payload["verification_details"] = (
            "Updated verification documents"
        )

        response = client.put(
            "/profile/professor",
            json=updated_payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Professor profile updated and submitted for review"
        )

        assert data["professor_id"] == professor_id
        assert data["verification_status"] == "PENDING"
        assert data["profile_completed"] is True

        # ----------------------------------------------------
        # Verify database
        # ----------------------------------------------------

        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    phone,
                    department,
                    designation,
                    specialization,
                    subjects,
                    academic_experience,
                    office_information,
                    verification_details
                FROM professor_profiles
                WHERE id = %s
                """,
                (professor_id,),
            )

            profile = cursor.fetchone()

            assert profile is not None

            assert profile["phone"] == "9123456789"
            assert profile["department"] == (
                "Information Technology"
            )
            assert profile["designation"] == (
                "Associate Professor"
            )
            assert profile["specialization"] == (
                "Data Science"
            )
            assert profile["subjects"] == (
                "Python, Data Science"
            )
            assert profile["academic_experience"] == (
                "8 years"
            )
            assert profile["office_information"] == (
                "Room 305"
            )
            assert profile["verification_details"] == (
                "Updated verification documents"
            )

            # ------------------------------------------------
            # Verify verification status
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT status
                FROM professor_verifications
                WHERE professor_id = %s
                """,
                (professor_id,),
            )

            verification = cursor.fetchone()

            assert verification is not None
            assert verification["status"] == "PENDING"

        finally:
            connection.close()

    finally:
        delete_test_professor_user(user["id"])


# ============================================================
# UPDATE NONEXISTENT PROFESSOR PROFILE
# ============================================================


def test_update_professor_profile_when_profile_does_not_exist(
    monkeypatch,
):

    user = create_test_professor_user()

    try:
        test_user = professor_user(user)

        monkeypatch.setattr(
            professor_route,
            "require_professor",
            lambda request: test_user,
        )

        response = client.put(
            "/profile/professor",
            json=professor_payload(),
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Professor profile does not exist"
        )

    finally:
        delete_test_professor_user(user["id"])


# ============================================================
# INACTIVE PROFESSOR
# ============================================================


def test_inactive_professor_is_rejected(monkeypatch):

    user = create_test_professor_user()

    try:
        def reject_inactive(request):
            from fastapi import HTTPException

            raise HTTPException(
                status_code=403,
                detail="Your account is inactive",
            )

        monkeypatch.setattr(
            professor_route,
            "require_professor",
            reject_inactive,
        )

        response = client.post(
            "/profile/professor",
            json=professor_payload(),
        )

        assert response.status_code == 403

        assert response.json()["detail"] == (
            "Your account is inactive"
        )

    finally:
        delete_test_professor_user(user["id"])


# ============================================================
# SUPER ADMIN CANNOT CREATE PROFESSOR PROFILE
# ============================================================


def test_super_admin_cannot_create_professor_profile(
    monkeypatch,
):
    def reject_super_admin(request):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="Super Admin account cannot create a professor profile",
        )

    monkeypatch.setattr(
        professor_route,
        "require_professor",
        reject_super_admin,
    )

    response = client.post(
        "/profile/professor",
        json=professor_payload(),
    )

    assert response.status_code == 403


# ============================================================
# NON-PROFESSOR ACCESS
# ============================================================


def test_non_professor_cannot_create_professor_profile(
    monkeypatch,
):

    def reject_non_professor(request):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="Professor access required",
        )

    monkeypatch.setattr(
        professor_route,
        "require_professor",
        reject_non_professor,
    )

    response = client.post(
        "/profile/professor",
        json=professor_payload(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Professor access required"
    )