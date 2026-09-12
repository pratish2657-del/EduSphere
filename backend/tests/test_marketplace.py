import os
import uuid

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import marketplace as marketplace_route
from app.routes import marketplace_payment as payment_route

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

        assert role is not None

        return role["id"]

    finally:
        connection.close()


def create_test_user(role_name="STUDENT"):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-marketplace-{role_name.lower()}-"
            f"{unique_id}@edusphere.local"
        )

        google_id = (
            f"pytest-marketplace-{role_name.lower()}-"
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
                TRUE,
                'PENDING',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                f"Pytest Marketplace {role_name}",
                role_id,
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "email": email,
            "full_name": f"Pytest Marketplace {role_name}",
            "role": role_name,
            "role_id": role_id,
            "profile_completed": True,
            "verification_status": "PENDING",
            "is_active": 1,
            "is_super_admin": 0,
        }

    finally:
        connection.close()


def delete_test_user(user_id):
    """
    Remove all Marketplace data related to a test user.

    Important:
    - marketplace_orders has buyer_id only.
    - seller_id exists in marketplace_order_items.
    - marketplace_payments references order_id.
    - We do NOT assume marketplace_payment_webhook_events
      contains payment_id.
    """

    connection = get_connection()

    attachment_files = []

    try:
        cursor = connection.cursor()

        # ====================================================
        # PRODUCT IDS OWNED BY USER
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

        # ====================================================
        # SAVE PRODUCT ATTACHMENT FILE PATHS
        # ====================================================

        if product_ids:
            placeholders = ", ".join(
                ["%s"] * len(product_ids)
            )

            cursor.execute(
                f"""
                SELECT file_path
                FROM marketplace_attachments
                WHERE product_id IN ({placeholders})
                """,
                tuple(product_ids),
            )

            attachment_files = cursor.fetchall()

        # ====================================================
        # DELETE PRODUCT ATTACHMENTS
        # ====================================================

        if product_ids:
            placeholders = ", ".join(
                ["%s"] * len(product_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_attachments
                WHERE product_id IN ({placeholders})
                """,
                tuple(product_ids),
            )

        # ====================================================
        # DELETE CART ITEMS FOR USER'S CART
        # ====================================================

        cursor.execute(
            """
            DELETE FROM marketplace_cart_items
            WHERE cart_id IN (
                SELECT id
                FROM marketplace_carts
                WHERE buyer_id = %s
            )
            """,
            (user_id,),
        )

        # ====================================================
        # DELETE CART ITEMS FOR USER'S PRODUCTS
        # ====================================================

        if product_ids:
            placeholders = ", ".join(
                ["%s"] * len(product_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_cart_items
                WHERE product_id IN ({placeholders})
                """,
                tuple(product_ids),
            )

        # ====================================================
        # DELETE USER CART
        # ====================================================

        cursor.execute(
            """
            DELETE FROM marketplace_carts
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        # ====================================================
        # FIND ORDERS WHERE USER IS BUYER
        # ====================================================

        cursor.execute(
            """
            SELECT id
            FROM marketplace_orders
            WHERE buyer_id = %s
            """,
            (user_id,),
        )

        buyer_order_rows = cursor.fetchall()

        buyer_order_ids = [
            row["id"]
            for row in buyer_order_rows
        ]

        # ====================================================
        # FIND ORDERS WHERE USER IS SELLER
        #
        # seller_id is in marketplace_order_items,
        # NOT marketplace_orders.
        # ====================================================

        cursor.execute(
            """
            SELECT DISTINCT order_id
            FROM marketplace_order_items
            WHERE seller_id = %s
            """,
            (user_id,),
        )

        seller_order_rows = cursor.fetchall()

        seller_order_ids = [
            row["order_id"]
            for row in seller_order_rows
        ]

        # ====================================================
        # COMBINE ORDER IDS
        # ====================================================

        order_ids = list(
            set(
                buyer_order_ids
                + seller_order_ids
            )
        )

        # ====================================================
        # DELETE PAYMENTS
        #
        # marketplace_payments uses order_id.
        # ====================================================

        if order_ids:
            placeholders = ", ".join(
                ["%s"] * len(order_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_payments
                WHERE order_id IN ({placeholders})
                """,
                tuple(order_ids),
            )

        # ====================================================
        # DELETE ORDER ITEMS
        # ====================================================

        if order_ids:
            placeholders = ", ".join(
                ["%s"] * len(order_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_order_items
                WHERE order_id IN ({placeholders})
                """,
                tuple(order_ids),
            )

        # ====================================================
        # DELETE ORDERS
        # ====================================================

        if order_ids:
            placeholders = ", ".join(
                ["%s"] * len(order_ids)
            )

            cursor.execute(
                f"""
                DELETE FROM marketplace_orders
                WHERE id IN ({placeholders})
                """,
                tuple(order_ids),
            )

        # ====================================================
        # DELETE PRODUCTS
        # ====================================================

        cursor.execute(
            """
            DELETE FROM marketplace_products
            WHERE seller_id = %s
            """,
            (user_id,),
        )

        # ====================================================
        # DELETE USER
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

    # ========================================================
    # DELETE PHYSICAL ATTACHMENT FILES
    # ========================================================

    for row in attachment_files:
        path = row.get("file_path")

        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


def user_data(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": user["role"],
        "profile_completed": True,
        "verification_status": "PENDING",
        "is_active": 1,
        "is_super_admin": user.get(
            "is_super_admin",
            0,
        ),
    }


def product_payload(institution_id, name=None):
    return {
        "institution_id": institution_id,
        "name": (
            name
            or f"Pytest Marketplace Product "
            f"{uuid.uuid4().hex[:8]}"
        ),
        "description": "Marketplace test product",
        "category": "BOOKS",
        "product_type": "PHYSICAL",
        "condition_type": "NEW",
        "price": 100.00,
        "quantity": 10,
    }


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


def create_product_direct(
    seller_id,
    institution_id,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        payload = product_payload(
            institution_id
        )

        cursor.execute(
            """
            INSERT INTO marketplace_products (
                seller_id,
                institution_id,
                name,
                description,
                category,
                product_type,
                condition_type,
                price,
                quantity,
                is_active
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
                TRUE
            )
            """,
            (
                seller_id,
                payload["institution_id"],
                payload["name"],
                payload["description"],
                payload["category"],
                payload["product_type"],
                payload["condition_type"],
                payload["price"],
                payload["quantity"],
            ),
        )

        connection.commit()

        return cursor.lastrowid

    finally:
        connection.close()


# ============================================================
# PRODUCT TESTS
# ============================================================


def test_list_products(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.get(
            "/marketplace/"
        )

        assert response.status_code == 200

        data = response.json()

        assert "count" in data
        assert "products" in data

    finally:
        delete_test_user(
            user["id"]
        )


def test_create_product(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.post(
            "/marketplace/",
            json=product_payload(
                get_institution_id()
            ),
        )

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == (
            "Marketplace product created successfully"
        )

        assert data["seller_id"] == user["id"]

        assert data["product_id"] is not None

    finally:
        delete_test_user(
            user["id"]
        )


def test_create_digital_product_requires_digital_condition(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        payload = product_payload(
            get_institution_id()
        )

        payload["product_type"] = "DIGITAL"
        payload["condition_type"] = "NEW"

        response = client.post(
            "/marketplace/",
            json=payload,
        )

        assert response.status_code == 400

        assert (
            "Digital products must use DIGITAL condition"
            in response.json()["detail"]
        )

    finally:
        delete_test_user(
            user["id"]
        )


def test_get_product(monkeypatch):
    seller = create_test_user("STUDENT")

    try:
        test_user = user_data(seller)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        product_id = create_product_direct(
            seller["id"],
            get_institution_id(),
        )

        response = client.get(
            f"/marketplace/{product_id}"
        )

        assert response.status_code == 200

        data = response.json()

        assert "product" in data
        assert "attachments" in data

        assert (
            data["product"]["product_id"]
            == product_id
        )

    finally:
        delete_test_user(
            seller["id"]
        )


def test_get_nonexistent_product(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.get(
            "/marketplace/999999"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Marketplace product not found"
        )

    finally:
        delete_test_user(
            user["id"]
        )


def test_update_own_product(monkeypatch):
    seller = create_test_user("STUDENT")

    try:
        test_user = user_data(seller)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        product_id = create_product_direct(
            seller["id"],
            get_institution_id(),
        )

        payload = product_payload(
            get_institution_id(),
            "Updated Marketplace Product",
        )

        response = client.put(
            f"/marketplace/{product_id}",
            json=payload,
        )

        assert response.status_code == 200

        data = response.json()

        assert data["product_id"] == product_id

    finally:
        delete_test_user(
            seller["id"]
        )


def test_user_cannot_update_other_users_product(
    monkeypatch,
):
    owner = create_test_user("STUDENT")
    other = create_test_user("STUDENT")

    try:
        owner_data = user_data(owner)
        other_data = user_data(other)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: owner_data,
        )

        product_id = create_product_direct(
            owner["id"],
            get_institution_id(),
        )

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: other_data,
        )

        response = client.put(
            f"/marketplace/{product_id}",
            json=product_payload(
                get_institution_id()
            ),
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "You can only update your own products"
        )

    finally:
        delete_test_user(
            owner["id"]
        )

        delete_test_user(
            other["id"]
        )


def test_delete_own_product(monkeypatch):
    seller = create_test_user("STUDENT")

    try:
        test_user = user_data(seller)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        product_id = create_product_direct(
            seller["id"],
            get_institution_id(),
        )

        response = client.delete(
            f"/marketplace/{product_id}"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["product_id"] == product_id

    finally:
        delete_test_user(
            seller["id"]
        )


# ============================================================
# CART TESTS
# ============================================================


def test_add_to_cart(monkeypatch):
    seller = create_test_user("STUDENT")
    buyer = create_test_user("STUDENT")

    try:
        seller_data = user_data(seller)
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: seller_data,
        )

        product_id = create_product_direct(
            seller["id"],
            get_institution_id(),
        )

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        response = client.post(
            f"/marketplace/cart"
            f"?product_id={product_id}"
            f"&quantity=2"
        )

        assert response.status_code == 200

        data = response.json()

        assert data["product_id"] == product_id
        assert data["quantity_added"] == 2

    finally:
        delete_test_user(
            seller["id"]
        )

        delete_test_user(
            buyer["id"]
        )


def test_cannot_add_own_product_to_cart(
    monkeypatch,
):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        product_id = create_product_direct(
            user["id"],
            get_institution_id(),
        )

        response = client.post(
            f"/marketplace/cart"
            f"?product_id={product_id}"
            f"&quantity=1"
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "You cannot purchase your own product"
        )

    finally:
        delete_test_user(
            user["id"]
        )


def test_get_cart(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.get(
            "/marketplace/cart"
        )

        assert response.status_code == 200

        data = response.json()

        assert "cart_id" in data
        assert "items" in data
        assert "total" in data

    finally:
        delete_test_user(
            user["id"]
        )


def test_update_cart_item(monkeypatch):
    seller = create_test_user("STUDENT")
    buyer = create_test_user("STUDENT")

    try:
        seller_data = user_data(seller)
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: seller_data,
        )

        product_id = create_product_direct(
            seller["id"],
            get_institution_id(),
        )

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        client.post(
            f"/marketplace/cart"
            f"?product_id={product_id}"
            f"&quantity=1"
        )

        response = client.put(
            f"/marketplace/cart/items/{product_id}"
            f"?quantity=3"
        )

        assert response.status_code == 200

        assert response.json()["quantity"] == 3

    finally:
        delete_test_user(
            seller["id"]
        )

        delete_test_user(
            buyer["id"]
        )


def test_remove_from_cart(monkeypatch):
    seller = create_test_user("STUDENT")
    buyer = create_test_user("STUDENT")

    try:
        seller_data = user_data(seller)
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: seller_data,
        )

        product_id = create_product_direct(
            seller["id"],
            get_institution_id(),
        )

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        client.post(
            f"/marketplace/cart"
            f"?product_id={product_id}"
            f"&quantity=1"
        )

        response = client.delete(
            f"/marketplace/cart/items/{product_id}"
        )

        assert response.status_code == 200

        assert response.json()["product_id"] == product_id

    finally:
        delete_test_user(
            seller["id"]
        )

        delete_test_user(
            buyer["id"]
        )


# ============================================================
# CHECKOUT / ORDER TESTS
# ============================================================


def test_checkout_empty_cart(monkeypatch):
    buyer = create_test_user("STUDENT")

    try:
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        response = client.post(
            "/marketplace/checkout"
            f"?institution_id={get_institution_id()}"
        )

        assert response.status_code == 400

        assert response.json()["detail"] == (
            "Your cart is empty"
        )

    finally:
        delete_test_user(
            buyer["id"]
        )


def test_buyer_orders(monkeypatch):
    buyer = create_test_user("STUDENT")

    try:
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        response = client.get(
            "/marketplace/orders"
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            "orders" in data
            or "count" in data
        )

    finally:
        delete_test_user(
            buyer["id"]
        )


def test_seller_orders(monkeypatch):
    seller = create_test_user("STUDENT")

    try:
        seller_data = user_data(seller)

        monkeypatch.setattr(
            marketplace_route,
            "require_completed_profile",
            lambda request: seller_data,
        )

        response = client.get(
            "/marketplace/seller/orders"
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            "orders" in data
            or "count" in data
        )

    finally:
        delete_test_user(
            seller["id"]
        )


# ============================================================
# PAYMENT ROUTE TESTS
# ============================================================


def test_create_payment_requires_existing_order(
    monkeypatch,
):
    buyer = create_test_user("STUDENT")

    try:
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            payment_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        response = client.post(
            "/marketplace/payments/",
            json={
                "order_id": 999999
            },
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Order not found"
        )

    finally:
        delete_test_user(
            buyer["id"]
        )


def test_get_nonexistent_payment(monkeypatch):
    buyer = create_test_user("STUDENT")

    try:
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            payment_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        response = client.get(
            "/marketplace/payments/999999"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Payment not found"
        )

    finally:
        delete_test_user(
            buyer["id"]
        )


def test_get_nonexistent_order_payment(
    monkeypatch,
):
    buyer = create_test_user("STUDENT")

    try:
        buyer_data = user_data(buyer)

        monkeypatch.setattr(
            payment_route,
            "require_completed_profile",
            lambda request: buyer_data,
        )

        response = client.get(
            "/marketplace/payments/order/999999"
        )

        assert response.status_code == 404

        assert response.json()["detail"] == (
            "Payment not found"
        )

    finally:
        delete_test_user(
            buyer["id"]
        )


# ============================================================
# WEBHOOK TESTS
# ============================================================


def test_webhook_missing_signature():
    response = client.post(
        "/marketplace/payments/webhook",
        content=b"{}",
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Missing Cashfree webhook signature"
    )


def test_webhook_missing_event_id(monkeypatch):
    monkeypatch.setenv(
        "PAYMENT_GATEWAY_WEBHOOK_SECRET",
        "pytest-webhook-secret",
    )

    response = client.post(
        "/marketplace/payments/webhook",
        content=b"{}",
        headers={
            "x-webhook-signature": "invalid",
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Missing Cashfree webhook timestamp"
    )