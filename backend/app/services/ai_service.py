import os
from datetime import date, datetime, time
from decimal import Decimal

from dotenv import load_dotenv
from google import genai

from app.core.exceptions import (
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.database import get_connection

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# ============================================================
# HELPERS
# ============================================================

def _to_json_value(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _row_to_dict(row, cursor):
    if isinstance(row, dict):
        return {key: _to_json_value(value) for key, value in row.items()}

    columns = [column[0] for column in cursor.description]
    return {
        key: _to_json_value(value)
        for key, value in zip(columns, row)
    }


def _fetch_all(cursor, query, params=()):
    cursor.execute(query, params)
    return [_row_to_dict(row, cursor) for row in cursor.fetchall()]


def _fetch_one(cursor, query, params=()):
    cursor.execute(query, params)
    row = cursor.fetchone()
    return _row_to_dict(row, cursor) if row else None


# ============================================================
# COURSE ACCESS
# ============================================================

def check_course_access(user_id, role, course_id):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        course = _fetch_one(
            cursor,
            """
            SELECT id, institution_id, program_id, name, code, semester
            FROM courses
            WHERE id = %s
            """,
            (course_id,),
        )

        if not course:
            raise NotFoundError("Course not found")

        if role in ["ADMIN", "SUPER_ADMIN"]:
            return True

        if role == "STUDENT":
            enrollment = _fetch_one(
                cursor,
                """
                SELECT id
                FROM course_enrollments
                WHERE student_id = %s
                  AND course_id = %s
                LIMIT 1
                """,
                (user_id, course_id),
            )

            if enrollment:
                return True

            raise ForbiddenError(
                "You are not enrolled in this course"
            )

        if role == "PROFESSOR":
            teaching = _fetch_one(
                cursor,
                """
                SELECT id
                FROM course_teachers
                WHERE professor_id = %s
                  AND course_id = %s
                LIMIT 1
                """,
                (user_id, course_id),
            )

            if teaching:
                return True

            raise ForbiddenError(
                "You are not assigned to this course"
            )

        if role == "DEVELOPER":
            return True

        raise ForbiddenError(
            "You do not have access to this course"
        )

    finally:
        connection.close()


# ============================================================
# AI CONTEXT TABLE
# ============================================================

def get_ai_context(user_id, course_id=None):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        if course_id is not None:
            return _fetch_all(
                cursor,
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
                LIMIT 50
                """,
                (course_id, user_id),
            )

        return _fetch_all(
            cursor,
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
            LIMIT 50
            """,
            (user_id,),
        )

    finally:
        connection.close()


# ============================================================
# STUDENT WEBSITE DATA
# ============================================================

def get_student_context(cursor, user_id):
    profile = _fetch_one(
        cursor,
        """
        SELECT
            id,
            user_id,
            phone,
            institution_id,
            program_id,
            section_id,
            enrollment_number,
            academic_year,
            current_year,
            semester,
            student_id,
            admission_year
        FROM student_profiles
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
    )

    if not profile:
        return []

    profile_id = profile["id"]

    courses = _fetch_all(
        cursor,
        """
        SELECT
            c.id,
            c.name,
            c.code,
            c.semester,
            c.program_id
        FROM course_enrollments ce
        JOIN courses c ON c.id = ce.course_id
        WHERE ce.student_id = %s
        ORDER BY c.semester, c.name
        LIMIT 100
        """,
        (user_id,),
    )

    attendance = _fetch_all(
        cursor,
        """
        SELECT
            c.id AS course_id,
            c.name AS course_name,
            c.code,
            COUNT(*) AS total_records,
            SUM(
                CASE
                    WHEN LOWER(a.status) IN
                        ('present', 'p', 'presented')
                    THEN 1
                    ELSE 0
                END
            ) AS present_records
        FROM attendance a
        JOIN courses c ON c.id = a.course_id
        JOIN course_enrollments ce
          ON ce.course_id = a.course_id
         AND ce.student_id = a.student_id
        WHERE a.student_id = %s
        GROUP BY c.id, c.name, c.code
        ORDER BY c.name
        LIMIT 100
        """,
        (user_id,),
    )

    for item in attendance:
        total = int(item.get("total_records") or 0)
        present = int(item.get("present_records") or 0)
        item["attendance_percentage"] = (
            round((present / total) * 100, 2)
            if total
            else None
        )

    results = _fetch_all(
        cursor,
        """
        SELECT
            er.id,
            er.course_id,
            c.name AS course_name,
            c.code,
            er.exam_type,
            er.academic_year,
            er.semester,
            er.marks_obtained,
            er.maximum_marks,
            er.grade,
            er.grade_point,
            er.credits,
            er.credit_points,
            er.result_status,
            er.created_at,
            er.updated_at
        FROM examination_results er
        JOIN courses c ON c.id = er.course_id
        WHERE er.student_profile_id = %s
        ORDER BY er.updated_at DESC, er.created_at DESC
        LIMIT 200
        """,
        (profile_id,),
    )

    timetable = _fetch_all(
        cursor,
        """
        SELECT
            t.id,
            t.course_id,
            c.name AS course_name,
            c.code,
            t.professor_id,
            t.academic_year,
            t.current_year,
            t.day_of_week,
            t.start_time,
            t.end_time,
            t.room
        FROM timetables t
        JOIN courses c ON c.id = t.course_id
        WHERE t.institution_id = %s
          AND t.program_id = %s
          AND t.section_id = %s
          AND t.current_year = %s
        ORDER BY
            FIELD(
                t.day_of_week,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday'
            ),
            t.start_time
        LIMIT 200
        """,
        (
            profile["institution_id"],
            profile["program_id"],
            profile["section_id"],
            profile["current_year"],
        ),
    )

    events = _fetch_all(
        cursor,
        """
        SELECT
            id,
            title,
            description,
            event_type,
            start_datetime,
            end_datetime,
            venue,
            organizer,
            registration_deadline,
            target_program_id,
            target_section_id,
            target_year,
            is_published
        FROM events
        WHERE institution_id = %s
          AND is_published = 1
          AND (
                target_program_id IS NULL
                OR target_program_id = %s
              )
          AND (
                target_section_id IS NULL
                OR target_section_id = %s
              )
          AND (
                target_year IS NULL
                OR target_year = %s
              )
        ORDER BY start_datetime
        LIMIT 100
        """,
        (
            profile["institution_id"],
            profile["program_id"],
            profile["section_id"],
            profile["current_year"],
        ),
    )

    return [
        {
            "type": "STUDENT_PROFILE",
            "data": profile,
        },
        {
            "type": "ENROLLED_COURSES",
            "data": courses,
        },
        {
            "type": "ATTENDANCE",
            "data": attendance,
        },
        {
            "type": "EXAMINATION_RESULTS",
            "data": results,
        },
        {
            "type": "TIMETABLE",
            "data": timetable,
        },
        {
            "type": "UPCOMING_EVENTS",
            "data": events,
        },
    ]


# ============================================================
# PROFESSOR WEBSITE DATA
# ============================================================

def get_professor_context(cursor, user_id):
    profile = _fetch_one(
        cursor,
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
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
    )

    if not profile:
        return []

    courses = _fetch_all(
        cursor,
        """
        SELECT DISTINCT
            c.id,
            c.name,
            c.code,
            c.semester,
            c.program_id
        FROM course_teachers ct
        JOIN courses c ON c.id = ct.course_id
        WHERE ct.professor_id = %s
        ORDER BY c.semester, c.name
        LIMIT 100
        """,
        (user_id,),
    )

    timetable = _fetch_all(
        cursor,
        """
        SELECT
            t.id,
            t.course_id,
            c.name AS course_name,
            c.code,
            t.academic_year,
            t.current_year,
            t.day_of_week,
            t.start_time,
            t.end_time,
            t.room
        FROM timetables t
        JOIN courses c ON c.id = t.course_id
        WHERE t.professor_id = %s
        ORDER BY t.day_of_week, t.start_time
        LIMIT 200
        """,
        (user_id,),
    )

    events = _fetch_all(
        cursor,
        """
        SELECT
            id,
            title,
            description,
            event_type,
            start_datetime,
            end_datetime,
            venue,
            organizer,
            registration_deadline,
            target_program_id,
            target_section_id,
            target_year,
            is_published
        FROM events
        WHERE institution_id = %s
          AND is_published = 1
        ORDER BY start_datetime
        LIMIT 100
        """,
        (profile["institution_id"],),
    )

    return [
        {
            "type": "PROFESSOR_PROFILE",
            "data": profile,
        },
        {
            "type": "TEACHING_COURSES",
            "data": courses,
        },
        {
            "type": "TEACHING_TIMETABLE",
            "data": timetable,
        },
        {
            "type": "INSTITUTION_EVENTS",
            "data": events,
        },
    ]


# ============================================================
# ADMIN WEBSITE DATA
# ============================================================

def get_admin_context(cursor, user_id):
    profile = _fetch_one(
        cursor,
        """
        SELECT
            id,
            user_id,
            institution_id,
            admin_id,
            phone,
            department,
            designation,
            office_information,
            responsibilities
        FROM admin_profiles
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
    )

    if not profile:
        return []

    institution_id = profile["institution_id"]

    course_count = _fetch_one(
        cursor,
        """
        SELECT COUNT(*) AS total_courses
        FROM courses
        WHERE institution_id = %s
        """,
        (institution_id,),
    )

    student_count = _fetch_one(
        cursor,
        """
        SELECT COUNT(*) AS total_students
        FROM student_profiles
        WHERE institution_id = %s
        """,
        (institution_id,),
    )

    professor_count = _fetch_one(
        cursor,
        """
        SELECT COUNT(*) AS total_professors
        FROM professor_profiles
        WHERE institution_id = %s
        """,
        (institution_id,),
    )

    courses = _fetch_all(
        cursor,
        """
        SELECT
            id,
            name,
            code,
            program_id,
            semester,
            created_at
        FROM courses
        WHERE institution_id = %s
        ORDER BY semester, name
        LIMIT 200
        """,
        (institution_id,),
    )

    events = _fetch_all(
        cursor,
        """
        SELECT
            id,
            title,
            description,
            event_type,
            start_datetime,
            end_datetime,
            venue,
            organizer,
            registration_deadline,
            target_program_id,
            target_section_id,
            target_year,
            is_published
        FROM events
        WHERE institution_id = %s
        ORDER BY start_datetime
        LIMIT 200
        """,
        (institution_id,),
    )

    return [
        {
            "type": "ADMIN_PROFILE",
            "data": profile,
        },
        {
            "type": "INSTITUTION_SUMMARY",
            "data": {
                "students": student_count,
                "professors": professor_count,
                "courses": course_count,
            },
        },
        {
            "type": "INSTITUTION_COURSES",
            "data": courses,
        },
        {
            "type": "INSTITUTION_EVENTS",
            "data": events,
        },
    ]


# ============================================================
# BUILD ROLE-AWARE WEBSITE CONTEXT
# ============================================================

def get_website_context(user_id, role):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        if role == "STUDENT":
            return get_student_context(cursor, user_id)

        if role == "PROFESSOR":
            return get_professor_context(cursor, user_id)

        if role == "ADMIN":
            return get_admin_context(cursor, user_id)

        # Developer/super-admin can still use explicitly stored
        # ai_context records. Do not expose arbitrary DB tables.
        return []

    finally:
        connection.close()


def serialize_context(items):
    if not items:
        return ""

    blocks = []

    for item in items:
        context_type = item.get("type", "GENERAL")
        data = item.get("data")

        blocks.append(
            f"[{context_type}]\n{data}"
        )

    return "\n\n".join(blocks)


# ============================================================
# CONVERSATION STORAGE
# ============================================================

def get_or_create_conversation(user_id, conversation_id=None):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        if conversation_id is not None:
            conversation = _fetch_one(
                cursor,
                """
                SELECT id, user_id, title, created_at, updated_at
                FROM ai_conversations
                WHERE id = %s
                  AND user_id = %s
                LIMIT 1
                """,
                (conversation_id, user_id),
            )

            if conversation:
                return conversation["id"]

        conversation = _fetch_one(
            cursor,
            """
            SELECT id, user_id, title, created_at, updated_at
            FROM ai_conversations
            WHERE user_id = %s
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """,
            (user_id,),
        )

        if conversation:
            return conversation["id"]

        cursor.execute(
            """
            INSERT INTO ai_conversations
                (user_id, title)
            VALUES
                (%s, %s)
            """,
            (user_id, "EduSphere AI"),
        )

        connection.commit()
        return cursor.lastrowid

    finally:
        connection.close()


def get_conversation_messages(user_id, conversation_id=None, limit=40):
    conversation_id = get_or_create_conversation(
        user_id,
        conversation_id,
    )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        messages = _fetch_all(
            cursor,
            """
            SELECT
                m.id,
                m.role,
                m.content,
                m.created_at
            FROM ai_messages m
            JOIN ai_conversations c
              ON c.id = m.conversation_id
            WHERE c.id = %s
              AND c.user_id = %s
            ORDER BY m.id DESC
            LIMIT %s
            """,
            (conversation_id, user_id, limit),
        )

        messages.reverse()

        return conversation_id, messages

    finally:
        connection.close()


def save_message(conversation_id, role, content):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO ai_messages
                (conversation_id, role, content)
            VALUES
                (%s, %s, %s)
            """,
            (conversation_id, role, content),
        )

        cursor.execute(
            """
            UPDATE ai_conversations
            SET
                title = CASE
                    WHEN title IS NULL
                      OR title = ''
                      OR title = 'EduSphere AI'
                    THEN LEFT(%s, 255)
                    ELSE title
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (content, conversation_id),
        )

        connection.commit()

    finally:
        connection.close()


def clear_conversation(user_id, conversation_id=None):
    connection = get_connection()

    try:
        cursor = connection.cursor()

        if conversation_id is None:
            conversation = _fetch_one(
                cursor,
                """
                SELECT id
                FROM ai_conversations
                WHERE user_id = %s
                ORDER BY updated_at DESC, id DESC
                LIMIT 1
                """,
                (user_id,),
            )
            conversation_id = (
                conversation["id"]
                if conversation
                else None
            )

        if conversation_id is None:
            return None

        cursor.execute(
            """
            DELETE FROM ai_conversations
            WHERE id = %s
              AND user_id = %s
            """,
            (conversation_id, user_id),
        )

        connection.commit()

        return conversation_id

    finally:
        connection.close()


# ============================================================
# ASK AI
# ============================================================

def ask_ai(
    user_id,
    role,
    message,
    course_id=None,
    additional_context=None,
    conversation_id=None,
):
    if course_id is not None:
        check_course_access(
            user_id=user_id,
            role=role,
            course_id=course_id,
        )

    # Always build fresh website context.
    # This means changes in attendance/results/events/etc.
    # are visible to the next AI request.
    website_context_items = get_website_context(
        user_id,
        role,
    )

    stored_contexts = get_ai_context(
        user_id=user_id,
        course_id=course_id,
    )

    website_context = serialize_context(
        website_context_items
    )

    stored_context = ""

    if stored_contexts:
        stored_context = "\n\n".join(
            f"[{item.get('context_type') or 'GENERAL'}]\n"
            f"{item.get('content') or ''}"
            for item in stored_contexts
            if (item.get("content") or "").strip()
        )

    context_parts = []

    if website_context:
        context_parts.append(
            "[LIVE EDUSPHERE DATA]\n" + website_context
        )

    if stored_context:
        context_parts.append(
            "[STORED AI CONTEXT]\n" + stored_context
        )

    if additional_context:
        context_parts.append(
            "[USER PROVIDED CONTEXT]\n"
            + additional_context
        )

    final_context = "\n\n".join(context_parts)
    context_used = bool(final_context.strip())

    conversation_id = get_or_create_conversation(
        user_id,
        conversation_id,
    )

    _, history = get_conversation_messages(
        user_id,
        conversation_id,
        limit=40,
    )

    # Save the user message before generating the answer.
    save_message(
        conversation_id,
        "user",
        message,
    )

    if client is None:
        return {
            "answer": (
                "EduSphere AI is currently unavailable "
                "because the Gemini API key is not configured."
            ),
            "course_id": course_id,
            "context_used": context_used,
            "ai_available": False,
            "conversation_id": conversation_id,
        }

    history_text = ""

    for item in history:
        history_text += (
            f"{item['role'].upper()}: "
            f"{item['content']}\n"
        )

    # Include the current message explicitly because history was
    # loaded before the current message was saved.
    history_text += f"USER: {message}\n"

    system_prompt = f"""
You are EduSphere AI.

You are the academic intelligence assistant inside the
EduSphere education platform.

The current authenticated user's role is: {role}.

You have access only to the authorized EduSphere information
provided below.

IMPORTANT RULES:

1. Use the live EduSphere data when answering questions about
   the user's profile, courses, attendance, results, timetable,
   events, or other platform information.

2. Use previous conversation messages to understand references
   such as "it", "that subject", "my previous result", or
   "make the plan shorter".

3. Do not invent EduSphere data.

4. Never reveal another user's private information.

5. Do not claim access to data that is not present in the
   supplied context.

6. If the data is insufficient, clearly say what information
   is missing.

7. When calculating percentages or comparing academic data,
   use the supplied numbers.

8. Give practical, concise, structured answers.

9. The user's current EduSphere data is more authoritative than
   old conversation statements if the two differ.

10. You are EduSphere AI. Do not identify yourself as ChatGPT.

LIVE/STORED EDUSPHERE CONTEXT:

{final_context if final_context else "No additional EduSphere data was available."}

PREVIOUS CONVERSATION:

{history_text if history_text else "No previous conversation."}
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=message,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.3,
            },
        )

        answer = (response.text or "").strip()

        if not answer:
            answer = (
                "I could not generate an answer for that request."
            )

        save_message(
            conversation_id,
            "assistant",
            answer,
        )

        return {
            "answer": answer,
            "course_id": course_id,
            "context_used": context_used,
            "ai_available": True,
            "conversation_id": conversation_id,
        }

    except Exception as error:
        error_text = str(error)

        # The user message has already been stored.
        # Do not store an AI error as an assistant answer.

        raise ServiceUnavailableError(
            "AI service error: " + error_text
        ) from error
