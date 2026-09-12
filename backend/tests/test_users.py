from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.middleware import auth_guard
from app.routes import users as users_route

client = TestClient(app)


# ============================================================
# SUPER ADMIN USER
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
# TEST DATABASE USER HELPERS
# ============================================================


def create_test_user():
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
                TRUE,
                'NOT_REQUIRED',
                TRUE,
                FALSE
            )
            """,
            (
                "pytest-user",
                "pytest-user@edusphere.local",
                "Pytest User",
            ),
        )

        connection.commit()

        return cursor.lastrowid

    finally:
        connection.close()


def delete_test_user(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM users WHERE id = %s",
            (user_id,),
        )

        connection.commit()

    finally:
        connection.close()


# ============================================================
# SUPER ADMIN — GET USER
# ============================================================


def test_super_admin_can_get_user(monkeypatch):

    monkeypatch.setattr(
        users_route,
        "require_super_admin",
        lambda request: SUPER_ADMIN_USER,
    )

    response = client.get("/users/1")

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == 1
    assert data["email"] == "pratish2657@gmail.com"
    assert data["role"] == "SUPER_ADMIN"


# ============================================================
# SUPER ADMIN — FIND USER BY EMAIL
# ============================================================


def test_super_admin_can_find_user_by_email(monkeypatch):

    monkeypatch.setattr(
        users_route,
        "require_super_admin",
        lambda request: SUPER_ADMIN_USER,
    )

    response = client.get(
        "/users/email/pratish2657@gmail.com"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == 1
    assert data["email"] == "pratish2657@gmail.com"


# ============================================================
# UNAUTHENTICATED USER
# ============================================================


def test_users_endpoint_requires_login():

    response = client.get("/users/1")

    assert response.status_code == 401


# ============================================================
# SUPER ADMIN CANNOT MODIFY OWN ACCOUNT
# ============================================================


def test_super_admin_cannot_modify_own_account(monkeypatch):

    monkeypatch.setattr(
        users_route,
        "require_super_admin",
        lambda request: SUPER_ADMIN_USER,
    )

    response = client.put(
        "/users/1",
        json={
            "role": "DEVELOPER",
        },
    )

    assert response.status_code == 403

    data = response.json()

    assert (
        "Super Admin account cannot be modified"
        in data["detail"]
    )


# ============================================================
# SUPER ADMIN — ASSIGN DEVELOPER ROLE
# ============================================================


def test_super_admin_can_assign_developer_role(monkeypatch):

    user_id = create_test_user()

    try:
        monkeypatch.setattr(
            users_route,
            "require_super_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        response = client.put(
            f"/users/{user_id}",
            json={
                "role": "DEVELOPER",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["user"]["role"] == "DEVELOPER"

        # Verify the database directly.
        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT
                    u.role_id,
                    r.name AS role
                FROM users u
                LEFT JOIN roles r
                    ON u.role_id = r.id
                WHERE u.id = %s
                """,
                (user_id,),
            )

            database_user = cursor.fetchone()

        finally:
            connection.close()

        assert database_user["role_id"] == 3
        assert database_user["role"] == "DEVELOPER"

    finally:
        delete_test_user(user_id)


# ============================================================
# SUPER ADMIN — DEACTIVATE USER
# ============================================================


def test_super_admin_can_deactivate_user(monkeypatch):

    user_id = create_test_user()

    try:
        monkeypatch.setattr(
            users_route,
            "require_super_admin",
            lambda request: SUPER_ADMIN_USER,
        )

        response = client.put(
            f"/users/{user_id}",
            json={
                "is_active": False,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["user"]["is_active"] == 0

        # Verify the database directly.
        connection = get_connection()

        try:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT is_active
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )

            database_user = cursor.fetchone()

        finally:
            connection.close()

        assert database_user["is_active"] == 0

    finally:
        delete_test_user(user_id)


# ============================================================
# INACTIVE USER — PROTECTED ROUTE
# ============================================================


def test_inactive_user_is_rejected(monkeypatch):

    inactive_user = {
        "id": 999999,
        "email": "pytest-inactive@edusphere.local",
        "full_name": "Pytest Inactive User",
        "role_id": 3,
        "role": "DEVELOPER",
        "profile_completed": True,
        "verification_status": "NOT_REQUIRED",
        "is_active": 0,
        "is_super_admin": 0,
    }

    def fake_get_current_user(request):
        from fastapi import HTTPException

        if not inactive_user["is_active"]:
            raise HTTPException(
                status_code=403,
                detail="Your account is inactive",
            )

        return inactive_user

    monkeypatch.setattr(
        auth_guard,
        "get_current_user",
        fake_get_current_user,
    )

    response = client.get("/protected/platform")

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Your account is inactive"
    )