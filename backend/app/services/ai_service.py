import os

from dotenv import load_dotenv
from google import genai

from app.core.exceptions import (
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.database import get_connection

# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# OPENAI CLIENT
# ============================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = None

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)


# ============================================================
# CHECK COURSE ACCESS
#
# STUDENT
#     → must be enrolled
#
# PROFESSOR
#     → must teach the course
#
# ADMIN
#     → allowed
#
# SUPER_ADMIN
#     → allowed
#
# ============================================================


def check_course_access(user_id, role, course_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Verify course exists
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name
            FROM courses
            WHERE id = %s
            """,
            (course_id,),
        )

        course = cursor.fetchone()

        if not course:
            raise NotFoundError("Course not found")

        # ----------------------------------------------------
        # ADMIN ACCESS
        # ----------------------------------------------------

        if role in ["ADMIN", "SUPER_ADMIN"]:
            return True

        # ----------------------------------------------------
        # STUDENT ACCESS
        # ----------------------------------------------------

        if role == "STUDENT":
            cursor.execute(
                """
                SELECT
                    id
                FROM course_enrollments
                WHERE student_id = %s
                  AND course_id = %s
                LIMIT 1
                """,
                (user_id, course_id),
            )

            enrollment = cursor.fetchone()

            if enrollment:
                return True

            raise ForbiddenError(
                "You are not enrolled in this course"
            )

        # ----------------------------------------------------
        # PROFESSOR ACCESS
        # ----------------------------------------------------

        if role == "PROFESSOR":
            cursor.execute(
                """
                SELECT
                    id
                FROM course_teachers
                WHERE professor_id = %s
                  AND course_id = %s
                LIMIT 1
                """,
                (user_id, course_id),
            )

            teaching = cursor.fetchone()

            if teaching:
                return True

            raise ForbiddenError(
                "You are not assigned to this course"
            )

        # ----------------------------------------------------
        # OTHER ROLES
        # ----------------------------------------------------

        raise ForbiddenError(
            "You do not have access to this course"
        )

    finally:
        connection.close()


# ============================================================
# GET AI CONTEXT
#
# IMPORTANT:
# Course access MUST already be verified before
# this function is called.
# ============================================================


def get_ai_context(user_id, course_id=None):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # COURSE CONTEXT
        # ----------------------------------------------------

        if course_id is not None:
            cursor.execute(
                """
                SELECT
                    id,
                    user_id,
                    course_id,
                    context_type,
                    content,
                    created_at
                FROM ai_context
                WHERE course_id = %s
                  AND (
                      user_id = %s
                      OR user_id IS NULL
                  )
                ORDER BY created_at DESC
                LIMIT 20
                """,
                (course_id, user_id),
            )

        # ----------------------------------------------------
        # USER CONTEXT
        # ----------------------------------------------------

        else:
            cursor.execute(
                """
                SELECT
                    id,
                    user_id,
                    course_id,
                    context_type,
                    content,
                    created_at
                FROM ai_context
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 20
                """,
                (user_id,),
            )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# BUILD CONTEXT
# ============================================================


def build_context(contexts):

    if not contexts:
        return ""

    context_parts = []

    for item in contexts:
        context_type = item["context_type"] or "GENERAL"

        content = item["content"] or ""

        if not content.strip():
            continue

        context_parts.append(
            f"[{context_type}]\n{content}"
        )

    return "\n\n".join(context_parts)


# ============================================================
# ASK AI
# ============================================================


def ask_ai(
    user_id,
    role,
    message,
    course_id=None,
    additional_context=None,
):

    # --------------------------------------------------------
    # COURSE ACCESS CONTROL
    # --------------------------------------------------------

    if course_id is not None:
        check_course_access(
            user_id=user_id,
            role=role,
            course_id=course_id,
        )

    # --------------------------------------------------------
    # Load context AFTER access verification
    # --------------------------------------------------------

    contexts = get_ai_context(
        user_id=user_id,
        course_id=course_id,
    )

    database_context = build_context(contexts)

    # --------------------------------------------------------
    # Additional user context
    # --------------------------------------------------------

    context_parts = []

    if database_context:
        context_parts.append(database_context)

    if additional_context:
        context_parts.append(
            "[USER PROVIDED CONTEXT]\n"
            + additional_context
        )

    final_context = "\n\n".join(context_parts)

    context_used = bool(final_context.strip())

    # --------------------------------------------------------
    # OpenAI unavailable
    # --------------------------------------------------------

    if client is None:
        return {
            "answer": (
                "EduSphere AI is currently unavailable "
                "because the OpenAI API key is not configured."
            ),
            "course_id": course_id,
            "context_used": context_used,
            "ai_available": False,
        }

    # --------------------------------------------------------
    # SYSTEM PROMPT
    # --------------------------------------------------------

    system_prompt = """
You are EduSphere AI.

You are an academic assistant inside the EduSphere
education platform.

Use EduSphere context when it is provided.

Important rules:

1. Prefer EduSphere-specific context over general assumptions.
2. Do not invent course, student, professor, or institution data.
3. If the provided context does not contain the answer,
   clearly say that the available EduSphere context does
   not contain enough information.
4. Answer clearly and helpfully.
5. Keep academic answers structured and easy to understand.
"""

    if final_context:
        system_prompt += (
            """

EduSphere context:

"""
            + final_context
        )

    # --------------------------------------------------------
    # OPENAI REQUEST
    # --------------------------------------------------------

    try:
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
            contents=message,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.3,
            },
        )

        answer = response.text or ""

        return {
            "answer": answer,
            "course_id": course_id,
            "context_used": context_used,
            "ai_available": True,
        }

    except Exception as error:
        error_text = str(error)

        # ----------------------------------------------------
        # OPENAI QUOTA ERROR
        # ----------------------------------------------------

        if (
            "insufficient_quota" in error_text
            or "exceeded your current quota" in error_text
        ):
            return {
                "answer": (
                    "EduSphere AI is currently unavailable "
                    "because the OpenAI API quota is exhausted "
                    "or billing is not enabled."
                ),
                "course_id": course_id,
                "context_used": context_used,
                "ai_available": False,
            }

        # ----------------------------------------------------
        # OTHER AI ERROR
        # ----------------------------------------------------

        raise ServiceUnavailableError(
            "AI service error: " + error_text
        ) from error