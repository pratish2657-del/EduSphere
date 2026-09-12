import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app

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

        assert role is not None, f"Role {role_name} does not exist"

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


def create_test_user(
    role_name="STUDENT",
    is_super_admin=False,
    is_active=True,
    profile_completed=True,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-admin-{role_name.lower()}-"
            f"{unique_id}@edusphere.local"
        )

        google_id = (
            f"pytest-admin-{role_name.lower()}-{unique_id}"
        )

        role_id = get_role_id(role_name)

        # ----------------------------------------------------
        # Professors normally enter the verification workflow
        # with PENDING status.
        # ----------------------------------------------------

        verification_status = (
            "PENDING"
            if role_name == "PROFESSOR"
            else "NOT_REQUIRED"
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
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                google_id,
                email,
                f"Pytest Admin {role_name}",
                role_id,
                profile_completed,
                verification_status,
                is_active,
                is_super_admin,
            ),
        )

        user_id = cursor.lastrowid

        connection.commit()

        return {
            "id": user_id,
            "google_id": google_id,
            "email": email,
            "full_name": f"Pytest Admin {role_name}",
            "role_id": role_id,
            "role": role_name,
            "profile_completed": profile_completed,
            "verification_status": verification_status,
            "is_active": is_active,
            "is_super_admin": is_super_admin,
        }

    finally:
        connection.close()


def create_professor_profile(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        institution_id = get_institution_id()

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
                "Computer Science",
                "Python, Database Systems",
                "5 years",
                "Room 101",
                "Pytest verification profile",
            ),
        )

        professor_id = cursor.lastrowid

        connection.commit()

        return professor_id

    finally:
        connection.close()


def create_professor_verification(professor_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO professor_verifications (
                professor_id,
                status,
                remarks
            )
            VALUES (
                %s,
                'PENDING',
                NULL
            )
            """,
            (professor_id,),
        )

        verification_id = cursor.lastrowid

        connection.commit()

        return verification_id

    finally:
        connection.close()


def create_admin_direct(
    google_id=None,
    email=None,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        google_id = google_id or (
            f"pytest-existing-admin-{unique_id}"
        )

        email = email or (
            f"pytest-existing-admin-{unique_id}"
            "@edusphere.local"
        )

        admin_role_id = get_role_id("ADMIN")

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
                'NOT_REQUIRED',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                "Pytest Existing Admin",
                admin_role_id,
            ),
        )

        admin_id = cursor.lastrowid

        connection.commit()

        return admin_id

    finally:
        connection.close()


def delete_test_user(user_id):
    """
    Delete a test user safely.

    Important:
    professor_verifications.verified_by references users.id,
    so references to the user must be cleared before deleting
    the user.

    Also remove professor verification/profile rows before the
    professor user is deleted.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # Get professor profile IDs belonging to this user
        # ====================================================

        cursor.execute(
            """
            SELECT id
            FROM professor_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        professor_rows = cursor.fetchall()

        professor_ids = [
            row["id"]
            for row in professor_rows
        ]

        # ====================================================
        # Delete professor verification rows
        # ====================================================

        if professor_ids:
            placeholders = ",".join(
                ["%s"] * len(professor_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM professor_verifications
                WHERE professor_id IN ({placeholders})
                """,
                tuple(professor_ids),
            )

        # ====================================================
        # Delete professor profile
        # ====================================================

        cursor.execute(
            """
            DELETE FROM professor_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        # ====================================================
        # Clear verification references where this user was
        # the admin who verified/rejected a professor.
        # ====================================================

        cursor.execute(
            """
            UPDATE professor_verifications
            SET verified_by = NULL
            WHERE verified_by = %s
            """,
            (user_id,),
        )

        # ====================================================
        # Delete student profile if present
        # ====================================================

        cursor.execute(
            """
            DELETE FROM student_profiles
            WHERE user_id = %s
            """,
            (user_id,),
        )

        # ====================================================
        # Marketplace cleanup
        # ====================================================

        cursor.execute(
            """
            SELECT id
            FROM marketplace_products
            WHERE seller_id = %s
            """,
            (user_id,),
        )

        product_rows = cursor.fetchall()

        product_ids = [
            row["id"]
            for row in product_rows
        ]

        # ----------------------------------------------------
        # Product attachments
        # ----------------------------------------------------

        if product_ids:
            placeholders = ",".join(
                ["%s"] * len(product_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_attachments
                WHERE product_id IN ({placeholders})
                """,
                tuple(product_ids),
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_cart_items
                WHERE product_id IN ({placeholders})
                """,
                tuple(product_ids),
            )

        # ----------------------------------------------------
        # Cart items belonging to this buyer
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM marketplace_carts
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        cart_rows = cursor.fetchall()

        cart_ids = [
            row["id"]
            for row in cart_rows
        ]

        if cart_ids:
            placeholders = ",".join(
                ["%s"] * len(cart_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_cart_items
                WHERE cart_id IN ({placeholders})
                """,
                tuple(cart_ids),
            )

        cursor.execute(
            """
            DELETE FROM marketplace_carts
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        # ----------------------------------------------------
        # Marketplace order items
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM marketplace_orders
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        order_rows = cursor.fetchall()

        order_ids = [
            row["id"]
            for row in order_rows
        ]

        if order_ids:
            placeholders = ",".join(
                ["%s"] * len(order_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_order_items
                WHERE order_id IN ({placeholders})
                """,
                tuple(order_ids),
            )

        cursor.execute(
            """
            DELETE FROM marketplace_order_items
            WHERE seller_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            DELETE FROM marketplace_orders
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            DELETE FROM marketplace_payments
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        cursor.execute(
            """
            DELETE FROM marketplace_products
            WHERE seller_id = %s
            """,
            (user_id,),
        )

        # ====================================================
        # Finally delete user
        # ====================================================

        cursor.execute(
            """
            DELETE FROM users
            WHERE id = %s
            """,
            (user_id,),
        )

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def admin_user_data(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": user["role"],
        "profile_completed": bool(
            user.get("profile_completed", True)
        ),
        "verification_status": user.get(
            "verification_status",
            "NOT_REQUIRED",
        ),
        "is_active": int(
            user.get("is_active", 1)
        ),
        "is_super_admin": int(
            user.get("is_super_admin", 0)
        ),
    }


# ============================================================
# PROFESSOR MANAGEMENT
# ============================================================


def test_get_pending_professors(monkeypatch):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    professor = create_test_user(
        role_name="PROFESSOR",
        profile_completed=True,
    )

    try:
        professor_id = create_professor_profile(
            professor["id"]
        )

        create_professor_verification(
            professor_id
        )

        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        response = client.get(
            "/admin/professors/pending"
        )

        assert response.status_code == 200

        data = response.json()

        assert "count" in data
        assert "professors" in data
        assert data["count"] >= 1

        matching = [
            item
            for item in data["professors"]
            if item["professor_id"] == professor_id
        ]

        assert matching

        assert (
            matching[0]["verification_status"]
            == "PENDING"
        )

    finally:
        delete_test_user(professor["id"])
        delete_test_user(admin["id"])


def test_verify_professor_success(monkeypatch):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    professor = create_test_user(
        role_name="PROFESSOR",
        profile_completed=True,
    )

    try:
        professor_id = create_professor_profile(
            professor["id"]
        )

        create_professor_verification(
            professor_id
        )

        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        response = client.put(
            f"/admin/professors/{professor_id}/verify",
            json={
                "status": "VERIFIED",
                "remarks": "Looks good",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            data["message"]
            == "Professor verified successfully"
        )

        assert data["professor_id"] == professor_id
        assert data["status"] == "VERIFIED"
        assert data["remarks"] == "Looks good"

    finally:
        delete_test_user(professor["id"])
        delete_test_user(admin["id"])


def test_verify_professor_accepts_lowercase_status(
    monkeypatch,
):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    professor = create_test_user(
        role_name="PROFESSOR",
        profile_completed=True,
    )

    try:
        professor_id = create_professor_profile(
            professor["id"]
        )

        create_professor_verification(
            professor_id
        )

        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        response = client.put(
            f"/admin/professors/{professor_id}/verify",
            json={
                "status": "verified",
                "remarks": "Verified by pytest",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["status"] == "VERIFIED"

    finally:
        delete_test_user(professor["id"])
        delete_test_user(admin["id"])


def test_reject_professor(monkeypatch):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    professor = create_test_user(
        role_name="PROFESSOR",
        profile_completed=True,
    )

    try:
        professor_id = create_professor_profile(
            professor["id"]
        )

        create_professor_verification(
            professor_id
        )

        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        response = client.put(
            f"/admin/professors/{professor_id}/verify",
            json={
                "status": "REJECTED",
                "remarks": "Insufficient documents",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["status"] == "REJECTED"
        assert (
            data["message"]
            == "Professor rejected successfully"
        )

    finally:
        delete_test_user(professor["id"])
        delete_test_user(admin["id"])


def test_verify_professor_twice_returns_409(
    monkeypatch,
):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    professor = create_test_user(
        role_name="PROFESSOR",
        profile_completed=True,
    )

    try:
        professor_id = create_professor_profile(
            professor["id"]
        )

        create_professor_verification(
            professor_id
        )

        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        first_response = client.put(
            f"/admin/professors/{professor_id}/verify",
            json={
                "status": "VERIFIED",
                "remarks": "First verification",
            },
        )

        assert first_response.status_code == 200

        second_response = client.put(
            f"/admin/professors/{professor_id}/verify",
            json={
                "status": "VERIFIED",
                "remarks": "Second verification",
            },
        )

        assert second_response.status_code == 409

    finally:
        delete_test_user(professor["id"])
        delete_test_user(admin["id"])


def test_verify_professor_invalid_status(
    monkeypatch,
):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    professor = create_test_user(
        role_name="PROFESSOR",
        profile_completed=True,
    )

    try:
        professor_id = create_professor_profile(
            professor["id"]
        )

        create_professor_verification(
            professor_id
        )

        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        response = client.put(
            f"/admin/professors/{professor_id}/verify",
            json={
                "status": "PENDING",
                "remarks": None,
            },
        )

        assert response.status_code == 400

        assert (
            response.json()["detail"]
            == "Status must be VERIFIED or REJECTED"
        )

    finally:
        delete_test_user(professor["id"])
        delete_test_user(admin["id"])


def test_verify_nonexistent_professor_returns_404(
    monkeypatch,
):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    try:
        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_admin",
            lambda request: admin_data,
        )

        response = client.put(
            "/admin/professors/999999/verify",
            json={
                "status": "VERIFIED",
                "remarks": "Test",
            },
        )

        assert response.status_code == 404

    finally:
        delete_test_user(admin["id"])


# ============================================================
# ADMIN MANAGEMENT
# ============================================================


def test_list_admins_as_super_admin(monkeypatch):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.get(
            "/admin/admins"
        )

        assert response.status_code == 200

        data = response.json()

        assert "count" in data
        assert "admins" in data

    finally:
        delete_test_user(super_admin["id"])


def test_create_admin_as_super_admin(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        unique_id = uuid.uuid4().hex

        payload = {
            "google_id": (
                f"pytest-new-admin-{unique_id}"
            ),
            "email": (
                f"pytest-new-admin-{unique_id}"
                "@edusphere.local"
            ),
            "full_name": "Pytest New Admin",
        }

        response = client.post(
            "/admin/admins",
            json=payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            data["message"]
            == "Admin created successfully"
        )

        assert data["email"] == payload["email"]
        assert data["role"] == "ADMIN"
        assert data["is_active"] is True
        assert data["is_super_admin"] is False

        created_admin_id = data["admin_id"]

        delete_test_user(created_admin_id)

    finally:
        delete_test_user(super_admin["id"])


def test_create_admin_duplicate_google_id_returns_409(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    existing = create_admin_direct()

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.post(
            "/admin/admins",
            json={
                "google_id": existing_user_google_id(
                    existing
                ),
                "email": (
                    f"pytest-duplicate-google-"
                    f"{uuid.uuid4().hex}"
                    "@edusphere.local"
                ),
                "full_name": "Duplicate Google ID",
            },
        )

        assert response.status_code == 409

        assert (
            response.json()["detail"]
            == "A user with this Google ID already exists"
        )

    finally:
        delete_test_user(existing)
        delete_test_user(super_admin["id"])


def existing_user_google_id(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT google_id
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )

        row = cursor.fetchone()

        assert row is not None

        return row["google_id"]

    finally:
        connection.close()


def existing_user_email(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT email
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )

        row = cursor.fetchone()

        assert row is not None

        return row["email"]

    finally:
        connection.close()


def test_create_admin_duplicate_email_returns_409(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    existing = create_admin_direct()

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.post(
            "/admin/admins",
            json={
                "google_id": (
                    f"pytest-duplicate-email-"
                    f"{uuid.uuid4().hex}"
                ),
                "email": existing_user_email(
                    existing
                ),
                "full_name": "Duplicate Email",
            },
        )

        assert response.status_code == 409

        assert (
            response.json()["detail"]
            == "A user with this email already exists"
        )

    finally:
        delete_test_user(existing)
        delete_test_user(super_admin["id"])


def test_update_admin_status_deactivates_admin(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    admin = create_admin_direct()

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.put(
            f"/admin/admins/{admin}/status",
            json={
                "is_active": False,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["admin_id"] == admin
        assert data["is_active"] is False

    finally:
        delete_test_user(admin)
        delete_test_user(super_admin["id"])


def test_update_admin_status_activates_admin(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    admin = create_admin_direct()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE users
            SET is_active = FALSE
            WHERE id = %s
            """,
            (admin,),
        )

        connection.commit()

    finally:
        connection.close()

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.put(
            f"/admin/admins/{admin}/status",
            json={
                "is_active": True,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["admin_id"] == admin
        assert data["is_active"] is True

    finally:
        delete_test_user(admin)
        delete_test_user(super_admin["id"])


def test_update_nonexistent_admin_returns_404(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.put(
            "/admin/admins/999999/status",
            json={
                "is_active": False,
            },
        )

        assert response.status_code == 404

        assert (
            response.json()["detail"]
            == "Admin not found"
        )

    finally:
        delete_test_user(super_admin["id"])


def test_update_student_as_admin_target_returns_400(
    monkeypatch,
):
    super_admin = create_test_user(
        role_name="SUPER_ADMIN",
        is_super_admin=True,
        profile_completed=True,
    )

    student = create_test_user(
        role_name="STUDENT",
        profile_completed=True,
    )

    try:
        super_admin_data = admin_user_data(
            super_admin
        )

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: super_admin_data,
        )

        response = client.put(
            f"/admin/admins/{student['id']}/status",
            json={
                "is_active": False,
            },
        )

        assert response.status_code == 400

        assert (
            response.json()["detail"]
            == "Selected user is not an ADMIN"
        )

    finally:
        delete_test_user(student["id"])
        delete_test_user(super_admin["id"])


# ============================================================
# AUTHORIZATION TESTS
# ============================================================


def test_normal_admin_cannot_list_admins(
    monkeypatch,
):
    admin = create_test_user(
        role_name="ADMIN",
        profile_completed=True,
    )

    try:
        admin_data = admin_user_data(admin)

        from app.routes import admin as admin_route

        monkeypatch.setattr(
            admin_route,
            "require_super_admin",
            lambda request: pytest.fail(
                "require_super_admin should not "
                "be bypassed"
            ),
        )

        # The route's dependency is deliberately not
        # authenticated through the session in this test.
        # We instead verify the service-level behavior below.

        from app.middleware import auth_guard

        def fake_get_current_user(request):
            return admin_data

        monkeypatch.setattr(
            auth_guard,
            "get_current_user",
            fake_get_current_user,
        )

        # Import the real dependency again after patching.
        from app.middleware.auth_guard import require_super_admin

        with pytest.raises(HTTPException) as exc_info:
            require_super_admin(None)

        assert exc_info.value.status_code == 403

    finally:
        delete_test_user(admin["id"])


def test_admin_service_can_be_imported():
    from app.services.admin_service import (
        create_admin,
        get_admins,
        get_pending_professors,
        update_admin_status,
        verify_professor,
    )

    assert callable(create_admin)
    assert callable(get_admins)
    assert callable(get_pending_professors)
    assert callable(update_admin_status)
    assert callable(verify_professor)