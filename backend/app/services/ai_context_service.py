from app.database import get_connection

# ============================================================
# GET AI CONTEXT
# USER + COURSE
# ============================================================


def get_ai_context(user_id, course_id=None, limit=10):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # User-specific context
        # ----------------------------------------------------

        if course_id is None:
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

                LIMIT %s
                """,
                (user_id, limit),
            )

        else:
            # ------------------------------------------------
            # Course context + user's own context
            # ------------------------------------------------

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

                WHERE
                    user_id = %s
                    OR course_id = %s

                ORDER BY created_at DESC

                LIMIT %s
                """,
                (user_id, course_id, limit),
            )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# BUILD AI CONTEXT TEXT
# ============================================================


def build_ai_context(user_id, course_id=None):

    contexts = get_ai_context(user_id=user_id, course_id=course_id, limit=10)

    if not contexts:
        return ""

    context_parts = []

    for context in contexts:
        context_type = context["context_type"] or "GENERAL"

        content = context["content"] or ""

        if not content.strip():
            continue

        context_parts.append(
            f"""
Context type: {context_type}

{content}
"""
        )

    return "\n".join(context_parts)
