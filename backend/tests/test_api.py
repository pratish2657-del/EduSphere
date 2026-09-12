from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_root():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "EduSphere API is running"


def test_protected_platform_requires_login():
    response = client.get("/protected/platform")

    assert response.status_code == 401


def test_super_admin_requires_login():
    response = client.get("/protected/super-admin")

    assert response.status_code == 401


def test_student_dashboard_requires_login():
    response = client.get("/dashboard/")

    assert response.status_code == 401


def test_users_require_super_admin():
    response = client.get("/users/1")

    assert response.status_code == 401


def test_marketplace_requires_login():
    response = client.get("/marketplace/")

    assert response.status_code == 401


def test_timetable_requires_login():
    response = client.get("/timetable/")

    assert response.status_code == 401