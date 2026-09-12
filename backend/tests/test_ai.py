import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import app
from app.routes import ai as ai_route
from app.services import ai_service

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


def create_test_user(
    role_name="STUDENT",
    profile_completed=True,
    is_active=True,
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        unique_id = uuid.uuid4().hex

        email = (
            f"pytest-ai-{role_name.lower()}-"
            f"{unique_id}@edusphere.local"
        )

        google_id = (
            f"pytest-ai-{role_name.lower()}-{unique_id}"
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
                'NOT_REQUIRED',
                %s,
                FALSE
            )
            """,
            (
                google_id,
                email,
                f"Pytest AI {role_name}",
                get_role_id(role_name),
                profile_completed,
                is_active,
            ),
        )

        connection.commit()

        return {
            "id": cursor.lastrowid,
            "email": email,
            "full_name": f"Pytest AI {role_name}",
            "role": role_name,
            "role_id": get_role_id(role_name),
            "profile_completed": profile_completed,
            "verification_status": "NOT_REQUIRED",
            "is_active": int(is_active),
            "is_super_admin": 0,
        }

    finally:
        connection.close()


def delete_test_user(user_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        # Remove AI context owned by the test user.
        cursor.execute(
            """
            DELETE FROM ai_context
            WHERE user_id = %s
            """,
            (user_id,),
        )

        # Remove course enrollments owned by the test user.
        cursor.execute(
            """
            DELETE FROM course_enrollments
            WHERE student_id = %s
            """,
            (user_id,),
        )

        # Remove course-teacher assignments owned by the test user.
        cursor.execute(
            """
            DELETE FROM course_teachers
            WHERE professor_id = %s
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


def user_data(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role_id": user["role_id"],
        "role": user["role"],
        "profile_completed": bool(user["profile_completed"]),
        "verification_status": user["verification_status"],
        "is_active": user["is_active"],
        "is_super_admin": user.get("is_super_admin", 0),
    }


def create_ai_context(
    user_id,
    course_id=None,
    context_type="GENERAL",
    content="AI test context",
):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO ai_context (
                user_id,
                course_id,
                context_type,
                content
            )
            VALUES (
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                user_id,
                course_id,
                context_type,
                content,
            ),
        )

        connection.commit()

        return cursor.lastrowid

    finally:
        connection.close()


def create_test_course():
    """
    Create a minimal course only when the actual courses schema
    permits it.

    The helper first inspects the columns so the test does not
    guess a schema that was not provided.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DESCRIBE courses
            """
        )

        columns = cursor.fetchall()

        column_names = {
            row["Field"]
            for row in columns
        }

        required = {
            "name",
        }

        if not required.issubset(column_names):
            pytest.skip(
                "courses table does not expose the expected name column"
            )

        unique_name = (
            f"Pytest AI Course {uuid.uuid4().hex[:8]}"
        )

        insert_columns = ["name"]
        insert_values = [unique_name]

        # Add common optional fields only if they exist.
        if "description" in column_names:
            insert_columns.append("description")
            insert_values.append("AI test course")

        if "code" in column_names:
            insert_columns.append("code")
            insert_values.append(
                f"AITEST-{uuid.uuid4().hex[:6].upper()}"
            )

        placeholders = ", ".join(
            ["%s"] * len(insert_columns)
        )

        columns_sql = ", ".join(insert_columns)

        cursor.execute(
            f"""
            INSERT INTO courses (
                {columns_sql}
            )
            VALUES (
                {placeholders}
            )
            """,
            tuple(insert_values),
        )

        connection.commit()

        return cursor.lastrowid

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def delete_test_course(course_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM ai_context
            WHERE course_id = %s
            """,
            (course_id,),
        )

        cursor.execute(
            """
            DELETE FROM course_enrollments
            WHERE course_id = %s
            """,
            (course_id,),
        )

        cursor.execute(
            """
            DELETE FROM course_teachers
            WHERE course_id = %s
            """,
            (course_id,),
        )

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
# AI HOME TESTS
# ============================================================


def test_ai_home(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.get("/ai/")

        assert response.status_code == 200

        data = response.json()

        assert data["message"] == "EduSphere AI is available"
        assert data["user_id"] == user["id"]
        assert data["role"] == "STUDENT"

    finally:
        delete_test_user(user["id"])


def test_ai_home_requires_completed_profile(monkeypatch):
    def raise_profile_error(request):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="Complete your EduSphere profile to continue",
        )

    monkeypatch.setattr(
        ai_route,
        "require_completed_profile",
        raise_profile_error,
    )

    response = client.get("/ai/")

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Complete your EduSphere profile to continue"
    )


# ============================================================
# AI ASK - VALIDATION
# ============================================================


def test_ai_ask_missing_message(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.post(
            "/ai/ask",
            json={},
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_ai_ask_empty_message(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "",
            },
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_ai_ask_message_too_long(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "x" * 5001,
            },
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


def test_ai_ask_context_too_long(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain this",
                "context": "x" * 10001,
            },
        )

        assert response.status_code == 422

    finally:
        delete_test_user(user["id"])


# ============================================================
# AI ASK - OPENAI UNAVAILABLE
# ============================================================


def test_ai_ask_when_openai_is_unavailable(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        monkeypatch.setattr(
            ai_service,
            "client",
            None,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain object oriented programming",
            },
        )

        assert response.status_code == 503

        data = response.json()

        assert data["detail"]["ai_available"] is False
        assert data["detail"]["course_id"] is None
        assert data["detail"]["context_used"] is False
        assert "unavailable" in data["detail"]["answer"].lower()

    finally:
        delete_test_user(user["id"])


def test_ai_ask_unavailable_with_user_context(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        create_ai_context(
            user_id=user["id"],
            context_type="STUDY",
            content="Python classes and objects",
        )

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        monkeypatch.setattr(
            ai_service,
            "client",
            None,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain the topic",
            },
        )

        assert response.status_code == 503

        data = response.json()

        assert data["detail"]["ai_available"] is False
        assert data["detail"]["context_used"] is True

    finally:
        delete_test_user(user["id"])


def test_ai_ask_unavailable_with_additional_context(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        monkeypatch.setattr(
            ai_service,
            "client",
            None,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain this",
                "context": "This is user provided context",
            },
        )

        assert response.status_code == 503

        data = response.json()

        assert data["detail"]["ai_available"] is False
        assert data["detail"]["context_used"] is True

    finally:
        delete_test_user(user["id"])


# ============================================================
# AI ASK - MOCKED SUCCESSFUL RESPONSE
# ============================================================


def test_ai_ask_success(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        def fake_ask_ai(
            user_id,
            role,
            message,
            course_id=None,
            additional_context=None,
        ):
            assert user_id == user["id"]
            assert role == "STUDENT"
            assert message == "What is inheritance?"

            return {
                "answer": "Inheritance allows a class to derive from another class.",
                "course_id": course_id,
                "context_used": False,
                "ai_available": True,
            }

        monkeypatch.setattr(
            ai_route,
            "ask_ai",
            fake_ask_ai,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "What is inheritance?",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert (
            data["answer"]
            == "Inheritance allows a class to derive from another class."
        )
        assert data["course_id"] is None
        assert data["context_used"] is False
        assert data["ai_available"] is True

    finally:
        delete_test_user(user["id"])


def test_ai_ask_success_with_additional_context(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        def fake_ask_ai(
            user_id,
            role,
            message,
            course_id=None,
            additional_context=None,
        ):
            assert additional_context == "Focus on Java examples."

            return {
                "answer": "Java supports inheritance through classes.",
                "course_id": course_id,
                "context_used": True,
                "ai_available": True,
            }

        monkeypatch.setattr(
            ai_route,
            "ask_ai",
            fake_ask_ai,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain inheritance.",
                "context": "Focus on Java examples.",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["answer"]
        assert data["context_used"] is True
        assert data["ai_available"] is True

    finally:
        delete_test_user(user["id"])


# ============================================================
# AI SERVICE - CONTEXT
# ============================================================


def test_ai_context_is_loaded_for_user(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        create_ai_context(
            user_id=user["id"],
            context_type="PROFILE",
            content="Student studies Computer Science",
        )

        contexts = ai_service.get_ai_context(
            user_id=user["id"],
        )

        assert len(contexts) >= 1

        matching = [
            item
            for item in contexts
            if item["content"]
            == "Student studies Computer Science"
        ]

        assert matching

    finally:
        delete_test_user(user["id"])


def test_ai_context_is_not_shared_between_users():
    user_one = create_test_user("STUDENT")
    user_two = create_test_user("STUDENT")

    try:
        create_ai_context(
            user_id=user_one["id"],
            context_type="PRIVATE",
            content="PRIVATE USER ONE CONTEXT",
        )

        contexts = ai_service.get_ai_context(
            user_id=user_two["id"],
        )

        contents = [
            item["content"]
            for item in contexts
        ]

        assert "PRIVATE USER ONE CONTEXT" not in contents

    finally:
        delete_test_user(user_one["id"])
        delete_test_user(user_two["id"])


def test_build_context_empty():
    result = ai_service.build_context([])

    assert result == ""


def test_build_context_ignores_empty_content():
    contexts = [
        {
            "context_type": "GENERAL",
            "content": "",
        },
        {
            "context_type": "GENERAL",
            "content": "Useful context",
        },
    ]

    result = ai_service.build_context(contexts)

    assert "Useful context" in result
    assert "GENERAL" in result


# ============================================================
# AI SERVICE - COURSE ACCESS
# ============================================================


def test_admin_can_access_existing_course():
    user = create_test_user("ADMIN")

    course_id = None

    try:
        course_id = create_test_course()

        result = ai_service.check_course_access(
            user_id=user["id"],
            role="ADMIN",
            course_id=course_id,
        )

        assert result is True

    finally:
        if course_id is not None:
            delete_test_course(course_id)

        delete_test_user(user["id"])


def test_nonexistent_course_returns_not_found():
    user = create_test_user("STUDENT")

    try:
        with pytest.raises(Exception) as error:
            ai_service.check_course_access(
                user_id=user["id"],
                role="STUDENT",
                course_id=999999,
            )

        assert "course not found" in str(error.value).lower()

    finally:
        delete_test_user(user["id"])


def test_student_cannot_access_unenrolled_course():
    user = create_test_user("STUDENT")

    course_id = None

    try:
        course_id = create_test_course()

        with pytest.raises(Exception) as error:
            ai_service.check_course_access(
                user_id=user["id"],
                role="STUDENT",
                course_id=course_id,
            )

        assert "not enrolled" in str(error.value).lower()

    finally:
        if course_id is not None:
            delete_test_course(course_id)

        delete_test_user(user["id"])


# ============================================================
# AI SERVICE - COURSE ACCESS VIA ROUTE
# ============================================================


def test_ai_course_access_forbidden(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        def fake_ask_ai(
            user_id,
            role,
            message,
            course_id=None,
            additional_context=None,
        ):
            from app.core.exceptions import ForbiddenError

            raise ForbiddenError(
                "You are not enrolled in this course"
            )

        monkeypatch.setattr(
            ai_route,
            "ask_ai",
            fake_ask_ai,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain this course",
                "course_id": 999999,
            },
        )

        assert response.status_code == 403
        assert (
            response.json()["detail"]
            == "You are not enrolled in this course"
        )

    finally:
        delete_test_user(user["id"])


def test_ai_course_not_found(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        test_user = user_data(user)

        monkeypatch.setattr(
            ai_route,
            "require_completed_profile",
            lambda request: test_user,
        )

        def fake_ask_ai(
            user_id,
            role,
            message,
            course_id=None,
            additional_context=None,
        ):
            from app.core.exceptions import NotFoundError

            raise NotFoundError("Course not found")

        monkeypatch.setattr(
            ai_route,
            "ask_ai",
            fake_ask_ai,
        )

        response = client.post(
            "/ai/ask",
            json={
                "message": "Explain this course",
                "course_id": 999999,
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Course not found"

    finally:
        delete_test_user(user["id"])


# ============================================================
# AI SERVICE - USER/COURSE CONTEXT
# ============================================================


def test_course_context_only_returns_course_and_user_context():
    user_one = create_test_user("STUDENT")
    user_two = create_test_user("STUDENT")

    course_id = None

    try:
        course_id = create_test_course()

        create_ai_context(
            user_id=None,
            course_id=course_id,
            context_type="COURSE",
            content="COURSE PUBLIC CONTEXT",
        )

        create_ai_context(
            user_id=user_one["id"],
            course_id=course_id,
            context_type="USER",
            content="USER ONE COURSE CONTEXT",
        )

        create_ai_context(
            user_id=user_two["id"],
            course_id=course_id,
            context_type="USER",
            content="USER TWO COURSE CONTEXT",
        )

        contexts = ai_service.get_ai_context(
            user_id=user_one["id"],
            course_id=course_id,
        )

        contents = [
            item["content"]
            for item in contexts
        ]

        assert "COURSE PUBLIC CONTEXT" in contents
        assert "USER ONE COURSE CONTEXT" in contents
        assert "USER TWO COURSE CONTEXT" not in contents

    finally:
        if course_id is not None:
            delete_test_course(course_id)

        delete_test_user(user_one["id"])
        delete_test_user(user_two["id"])


# ============================================================
# AI SERVICE - MOCKED GEMINI
# ============================================================


class FakeResponse:
    def __init__(self, text="Mocked AI answer"):
        self.text = text


class FakeModels:
    def __init__(self):
        self.kwargs = None

    def generate_content(
        self,
        model,
        contents,
        config=None,
    ):
        self.kwargs = {
            "model": model,
            "contents": contents,
            "config": config,
        }

        return FakeResponse()


class FakeClient:
    def __init__(self):
        self.models = FakeModels()


def test_ask_ai_with_mocked_gemini(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        fake_client = FakeClient()

        monkeypatch.setattr(
            ai_service,
            "client",
            fake_client,
        )

        result = ai_service.ask_ai(
            user_id=user["id"],
            role="STUDENT",
            message="What is Python?",
        )

        assert result["answer"] == "Mocked AI answer"
        assert result["course_id"] is None
        assert result["ai_available"] is True
        assert result["context_used"] is False

        kwargs = fake_client.models.kwargs

        assert kwargs["model"]
        assert kwargs["contents"]
        assert kwargs["config"]

        assert (
            kwargs["contents"]
            == "What is Python?"
        )

    finally:
        delete_test_user(user["id"])


def test_ask_ai_uses_database_context(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        create_ai_context(
            user_id=user["id"],
            context_type="COURSE",
            content="Python is used for programming.",
        )

        fake_client = FakeClient()

        monkeypatch.setattr(
            ai_service,
            "client",
            fake_client,
        )

        result = ai_service.ask_ai(
            user_id=user["id"],
            role="STUDENT",
            message="Explain Python.",
        )

        assert result["answer"] == "Mocked AI answer"
        assert result["context_used"] is True
        assert result["ai_available"] is True

        kwargs = fake_client.models.kwargs

        assert kwargs["model"]
        assert kwargs["contents"]
        assert kwargs["config"]

        system_instruction = (
            kwargs["config"]["system_instruction"]
        )

        assert (
            "Python is used for programming."
            in system_instruction
        )

    finally:
        delete_test_user(user["id"])


def test_ask_ai_uses_additional_context(monkeypatch):
    user = create_test_user("STUDENT")

    try:
        fake_client = FakeClient()

        monkeypatch.setattr(
            ai_service,
            "client",
            fake_client,
        )

        result = ai_service.ask_ai(
            user_id=user["id"],
            role="STUDENT",
            message="Explain this.",
            additional_context="Additional test information",
        )

        assert result["context_used"] is True
        assert result["ai_available"] is True

        kwargs = fake_client.models.kwargs

        assert kwargs["model"]
        assert kwargs["contents"]
        assert kwargs["config"]

        system_instruction = (
            kwargs["config"]["system_instruction"]
        )

        assert (
            "Additional test information"
            in system_instruction
        )

    finally:
        delete_test_user(user["id"])