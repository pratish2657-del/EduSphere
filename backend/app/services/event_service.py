from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

from zoneinfo import ZoneInfo

# EduSphere institution-event timezone.
# Naive datetimes from the frontend are treated as IST exactly as entered.
EVENT_TIMEZONE = ZoneInfo("Asia/Kolkata")


def _normalize_event_datetime(value):
    """Normalize an event datetime to a naive IST datetime.

    - Naive values are already treated as IST and are preserved exactly.
    - Timezone-aware values are converted to IST and then made naive.
    - This prevents UTC/IST conversion from changing a time such as 12:00 PM.
    """
    if value is None:
        return None

    if value.tzinfo is None:
        return value

    return value.astimezone(EVENT_TIMEZONE).replace(tzinfo=None)


def _normalize_event_datetimes(data):
    """Return the event datetimes using EduSphere's IST convention."""
    data.start_datetime = _normalize_event_datetime(data.start_datetime)
    data.end_datetime = _normalize_event_datetime(data.end_datetime)
    data.registration_deadline = _normalize_event_datetime(
        data.registration_deadline
    )
    return data

# ============================================================
# STUDENT ACADEMIC GROUP
# ============================================================


def _get_student_academic_group(cursor, user_id):
    """
    Resolve the student's normalized academic information.

    student_profiles:
        program_id -> programs.id
        section_id -> sections.id
    """

    cursor.execute(
        """
        SELECT
            sp.program_id,
            p.name AS program_name,
            p.code AS program_code,

            sp.section_id,
            s.name AS section_name,
            s.code AS section_code,

            sp.current_year

        FROM student_profiles sp

        INNER JOIN programs p
            ON sp.program_id = p.id

        INNER JOIN sections s
            ON sp.section_id = s.id
           AND s.program_id = p.id

        WHERE sp.user_id = %s

        LIMIT 1
        """,
        (user_id,),
    )

    student = cursor.fetchone()

    if not student:
        raise NotFoundError(
            "Student profile not found"
        )

    return student


# ============================================================
# VALIDATE EVENT TARGET
# ============================================================


def _validate_event_target(
    cursor,
    target_program_id,
    target_section_id,
):
    """
    Validate event targeting.

    Rules:

        target_program_id may be NULL
        target_section_id may be NULL

        If target_section_id is provided,
        target_program_id must also be provided.

        The selected section must belong to
        the selected program.
    """

    # --------------------------------------------------------
    # Section requires program
    # --------------------------------------------------------

    if (
        target_section_id is not None
        and target_program_id is None
    ):
        raise BadRequestError(
            "Target program is required when target section is provided"
        )

    # --------------------------------------------------------
    # Validate program
    # --------------------------------------------------------

    if target_program_id is not None:

        cursor.execute(
            """
            SELECT
                id
            FROM programs
            WHERE id = %s
            LIMIT 1
            """,
            (target_program_id,),
        )

        program = cursor.fetchone()

        if not program:
            raise NotFoundError(
                "Target program not found"
            )

    # --------------------------------------------------------
    # Validate section
    # --------------------------------------------------------

    if target_section_id is not None:

        cursor.execute(
            """
            SELECT
                id
            FROM sections
            WHERE id = %s
              AND program_id = %s
            LIMIT 1
            """,
            (
                target_section_id,
                target_program_id,
            ),
        )

        section = cursor.fetchone()

        if not section:
            raise NotFoundError(
                "Target section does not belong to target program"
            )


# ============================================================
# EVENT VISIBILITY
# ============================================================


def _student_can_access_event(
    event,
    student,
):
    """
    Determine whether a student can access an event.

    Event targeting:

        target_program_id
        target_section_id
        target_year

    Student academic information:

        program_id
        section_id
        current_year

    NULL target values mean no restriction.
    """

    # --------------------------------------------------------
    # Program
    # --------------------------------------------------------

    if (
        event["target_program_id"] is not None
        and event["target_program_id"]
        != student["program_id"]
    ):
        return False

    # --------------------------------------------------------
    # Academic year
    # --------------------------------------------------------

    if (
        event["target_year"] is not None
        and event["target_year"]
        != student["current_year"]
    ):
        return False

    # --------------------------------------------------------
    # Section
    # --------------------------------------------------------

    return not (
    event["target_section_id"] is not None
    and event["target_section_id"]
    != student["section_id"]
)


# ============================================================
# GET EVENTS
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def get_events(user_id, role):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # STUDENT
        # ----------------------------------------------------

        if role == "STUDENT":

            student = _get_student_academic_group(
                cursor,
                user_id,
            )

            cursor.execute(
                """
                SELECT
                    e.id,
                    e.title,
                    e.description,
                    e.event_type,
                    e.start_datetime,
                    e.end_datetime,
                    e.venue,
                    e.organizer,
                    e.registration_deadline,
                    e.registration_link,

                    e.target_program_id,
                    e.target_section_id,
                    e.target_year,

                    e.is_published,
                    e.created_by,
                    e.created_at,
                    e.updated_at

                FROM events e

                WHERE e.is_published = TRUE

                ORDER BY e.start_datetime ASC
                """
            )

            all_events = cursor.fetchall()

            events = [
                event
                for event in all_events
                if _student_can_access_event(
                    event,
                    student,
                )
            ]

        # ----------------------------------------------------
        # PROFESSOR / ADMIN / SUPER_ADMIN
        # ----------------------------------------------------

        else:

            cursor.execute(
                """
                SELECT
                    e.id,
                    e.title,
                    e.description,
                    e.event_type,
                    e.start_datetime,
                    e.end_datetime,
                    e.venue,
                    e.organizer,
                    e.registration_deadline,
                    e.registration_link,

                    e.target_program_id,
                    e.target_section_id,
                    e.target_year,

                    e.is_published,
                    e.created_by,
                    e.created_at,
                    e.updated_at

                FROM events e

                ORDER BY e.start_datetime ASC
                """
            )

            events = cursor.fetchall()

        return {
            "count": len(events),
            "events": events,
        }

    finally:
        connection.close()


# ============================================================
# GET SINGLE EVENT
# ============================================================


def get_event(
    event_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                e.id,
                e.title,
                e.description,
                e.event_type,
                e.start_datetime,
                e.end_datetime,
                e.venue,
                e.organizer,
                e.registration_deadline,
                e.registration_link,

                e.target_program_id,
                e.target_section_id,
                e.target_year,

                e.is_published,
                e.created_by,
                e.created_at,
                e.updated_at

            FROM events e

            WHERE e.id = %s

            LIMIT 1
            """,
            (event_id,),
        )

        event = cursor.fetchone()

        if not event:
            raise NotFoundError(
                "Event not found"
            )

        # ----------------------------------------------------
        # STUDENT VISIBILITY
        # ----------------------------------------------------

        if role == "STUDENT":

            if not event["is_published"]:
                raise NotFoundError(
                    "Event not found"
                )

            student = _get_student_academic_group(
                cursor,
                user_id,
            )

            if not _student_can_access_event(
                event,
                student,
            ):
                raise NotFoundError(
                    "Event not found"
                )

        # ----------------------------------------------------
        # Attachments
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                file_name,
                file_path,
                file_type,
                file_size,
                uploaded_by,
                uploaded_at

            FROM event_attachments

            WHERE event_id = %s

            ORDER BY uploaded_at ASC
            """,
            (event_id,),
        )

        attachments = cursor.fetchall()

        return {
            "event": event,
            "attachments": attachments,
        }

    finally:
        connection.close()


# ============================================================
# CREATE EVENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def create_event(
    user_id,
    data,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Validate datetime
        # ----------------------------------------------------

        if data.start_datetime >= data.end_datetime:
            raise BadRequestError(
                "Event start time must be before end time"
            )

        if (
            data.registration_deadline is not None
            and data.registration_deadline
            > data.start_datetime
        ):
            raise BadRequestError(
                "Registration deadline cannot be after "
                "the event start time"
            )

        # ----------------------------------------------------
        # Verify user
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                is_active

            FROM users

            WHERE id = %s

            LIMIT 1
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise NotFoundError(
                "User not found"
            )

        if not user["is_active"]:
            raise ForbiddenError(
                "User account is inactive"
            )

        # ----------------------------------------------------
        # Validate target
        # ----------------------------------------------------

        _validate_event_target(
            cursor=cursor,
            target_program_id=data.target_program_id,
            target_section_id=data.target_section_id,
        )

        # ----------------------------------------------------
        # Insert event
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO events (
                title,
                description,
                event_type,
                start_datetime,
                end_datetime,
                venue,
                organizer,
                registration_deadline,
                registration_link,

                target_program_id,
                target_section_id,
                target_year,

                is_published,
                created_by
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
                %s,
                %s,

                FALSE,
                %s
            )
            """,
            (
                data.title,
                data.description,
                data.event_type,
                data.start_datetime,
                data.end_datetime,
                data.venue,
                data.organizer,
                data.registration_deadline,
                data.registration_link,

                data.target_program_id,
                data.target_section_id,
                data.target_year,

                user_id,
            ),
        )

        event_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Event created successfully",
            "event_id": event_id,
            "is_published": False,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# UPDATE EVENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def update_event(
    event_id,
    user_id,
    role,
    data,
):

    # Normalize all incoming timestamps to the institution timezone
    # before validation and database storage.
    data = _normalize_event_datetimes(data)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find event
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                created_by

            FROM events

            WHERE id = %s

            LIMIT 1
            """,
            (event_id,),
        )

        event = cursor.fetchone()

        if not event:
            raise NotFoundError(
                "Event not found"
            )

        # ----------------------------------------------------
        # Professor ownership
        # ----------------------------------------------------

        if (
            role == "PROFESSOR"
            and event["created_by"] != user_id
        ):
            raise ForbiddenError(
                "You can only edit events created by you"
            )

        # ----------------------------------------------------
        # Validate datetime
        # ----------------------------------------------------

        if data.start_datetime >= data.end_datetime:
            raise BadRequestError(
                "Event start time must be before end time"
            )

        if (
            data.registration_deadline is not None
            and data.registration_deadline
            > data.start_datetime
        ):
            raise BadRequestError(
                "Registration deadline cannot be after "
                "the event start time"
            )

        # ----------------------------------------------------
        # Validate target
        # ----------------------------------------------------

        _validate_event_target(
            cursor=cursor,
            target_program_id=data.target_program_id,
            target_section_id=data.target_section_id,
        )

        # ----------------------------------------------------
        # Update
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE events

            SET
                title = %s,
                description = %s,
                event_type = %s,
                start_datetime = %s,
                end_datetime = %s,
                venue = %s,
                organizer = %s,
                registration_deadline = %s,
                registration_link = %s,

                target_program_id = %s,
                target_section_id = %s,
                target_year = %s

            WHERE id = %s
            """,
            (
                data.title,
                data.description,
                data.event_type,
                data.start_datetime,
                data.end_datetime,
                data.venue,
                data.organizer,
                data.registration_deadline,
                data.registration_link,

                data.target_program_id,
                data.target_section_id,
                data.target_year,

                event_id,
            ),
        )

        connection.commit()

        return {
            "message": "Event updated successfully",
            "event_id": event_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE EVENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def delete_event(
    event_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                created_by

            FROM events

            WHERE id = %s

            LIMIT 1
            """,
            (event_id,),
        )

        event = cursor.fetchone()

        if not event:
            raise NotFoundError(
                "Event not found"
            )

        if (
            role == "PROFESSOR"
            and event["created_by"] != user_id
        ):
            raise ForbiddenError(
                "You can only delete events created by you"
            )

        cursor.execute(
            """
            DELETE FROM events
            WHERE id = %s
            """,
            (event_id,),
        )

        connection.commit()

        return {
            "message": "Event deleted successfully",
            "event_id": event_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# PUBLISH / UNPUBLISH EVENT
# ADMIN / SUPER_ADMIN
# ============================================================


def set_event_published(
    event_id,
    is_published,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id
            FROM events
            WHERE id = %s
            LIMIT 1
            """,
            (event_id,),
        )

        event = cursor.fetchone()

        if not event:
            raise NotFoundError(
                "Event not found"
            )

        cursor.execute(
            """
            UPDATE events
            SET
                is_published = %s
            WHERE id = %s
            """,
            (
                is_published,
                event_id,
            ),
        )

        connection.commit()

        return {
            "message": (
                "Event published successfully"
                if is_published
                else "Event unpublished successfully"
            ),
            "event_id": event_id,
            "is_published": is_published,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADD ATTACHMENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def add_event_attachment(
    event_id,
    user_id,
    role,
    file_name,
    file_path,
    file_type,
    file_size,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                created_by
            FROM events
            WHERE id = %s
            LIMIT 1
            """,
            (event_id,),
        )

        event = cursor.fetchone()

        if not event:
            raise NotFoundError(
                "Event not found"
            )

        if (
            role == "PROFESSOR"
            and event["created_by"] != user_id
        ):
            raise ForbiddenError(
                "You can only upload attachments "
                "to events created by you"
            )

        cursor.execute(
            """
            INSERT INTO event_attachments (
                event_id,
                file_name,
                file_path,
                file_type,
                file_size,
                uploaded_by
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                event_id,
                file_name,
                file_path,
                file_type,
                file_size,
                user_id,
            ),
        )

        attachment_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Attachment uploaded successfully",
            "attachment_id": attachment_id,
            "event_id": event_id,
            "file_name": file_name,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# DELETE ATTACHMENT
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def delete_event_attachment(
    attachment_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                event_id,
                file_path,
                uploaded_by
            FROM event_attachments
            WHERE id = %s
            LIMIT 1
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Attachment not found"
            )

        if (
            role == "PROFESSOR"
            and attachment["uploaded_by"] != user_id
        ):
            raise ForbiddenError(
                "You can only delete attachments "
                "uploaded by you"
            )

        cursor.execute(
            """
            DELETE FROM event_attachments
            WHERE id = %s
            """,
            (attachment_id,),
        )

        connection.commit()

        return {
            "message": "Attachment deleted successfully",
            "attachment_id": attachment_id,
            "file_path": attachment["file_path"],
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# GET ATTACHMENT
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


def get_event_attachment(
    attachment_id,
    user_id,
    role,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                ea.id,
                ea.event_id,
                ea.file_name,
                ea.file_path,
                ea.file_type,
                ea.file_size,

                e.is_published,
                e.created_by,

                e.target_program_id,
                e.target_section_id,
                e.target_year

            FROM event_attachments ea

            INNER JOIN events e
                ON ea.event_id = e.id

            WHERE ea.id = %s

            LIMIT 1
            """,
            (attachment_id,),
        )

        attachment = cursor.fetchone()

        if not attachment:
            raise NotFoundError(
                "Attachment not found"
            )

        # ----------------------------------------------------
        # STUDENT ACCESS
        # ----------------------------------------------------

        if role == "STUDENT":

            if not attachment["is_published"]:
                raise NotFoundError(
                    "Attachment not found"
                )

            student = _get_student_academic_group(
                cursor,
                user_id,
            )

            if not _student_can_access_event(
                attachment,
                student,
            ):
                raise NotFoundError(
                    "Attachment not found"
                )

        return attachment

    finally:
        connection.close()