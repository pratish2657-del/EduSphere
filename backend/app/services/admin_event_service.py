"""
Institution-scoped Admin Events service.

This service intentionally keeps the existing /events API contract but provides
admin-only institution checks for management operations.
"""

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.database import get_connection


def _admin_institution_id(cursor, user_id: int) -> int:
    cursor.execute(
        """
        SELECT institution_id
        FROM admin_profiles
        WHERE user_id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    profile = cursor.fetchone()
    if not profile:
        raise NotFoundError("Admin profile not found")
    return profile["institution_id"]


def _event_belongs_to_admin_institution(cursor, event_id: int, institution_id: int):
    # Current events schema in the supplied backend does not expose institution_id.
    # If events are still global, this helper cannot safely infer ownership.
    # Use created_by ownership as the safe fallback for admin management.
    cursor.execute(
        """
        SELECT *
        FROM events
        WHERE id = %s
        LIMIT 1
        """,
        (event_id,),
    )
    event = cursor.fetchone()
    if not event:
        raise NotFoundError("Event not found")

    cursor.execute(
        """
        SELECT institution_id
        FROM admin_profiles
        WHERE user_id = (
            SELECT created_by FROM events WHERE id = %s
        )
        LIMIT 1
        """,
        (event_id,),
    )
    creator_admin = cursor.fetchone()

    if creator_admin and creator_admin["institution_id"] == institution_id:
        return event

    # Events created by professors do not have institution_id in the current
    # table. They should be migrated to store institution_id before allowing
    # unrestricted institution-wide admin management.
    raise ForbiddenError(
        "Event institution ownership is not available in the current events schema"
    )


def list_admin_events(user_id: int):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution_id(cursor, user_id)

        # Safe current-schema query: return events created by admins belonging
        # to this institution. A schema migration should add events.institution_id
        # for complete institution-wide management.
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
            INNER JOIN admin_profiles ap
                ON ap.user_id = e.created_by
            WHERE ap.institution_id = %s
            ORDER BY e.start_datetime ASC
            """,
            (institution_id,),
        )

        events = cursor.fetchall()
        return {
            "institution_id": institution_id,
            "count": len(events),
            "events": events,
        }
    finally:
        connection.close()


def update_admin_event(user_id: int, event_id: int, data):
    connection = get_connection()
    try:
        cursor = connection.cursor()

        if data.start_datetime >= data.end_datetime:
            raise BadRequestError("Event start time must be before end time")

        if (
            data.registration_deadline is not None
            and data.registration_deadline > data.start_datetime
        ):
            raise BadRequestError(
                "Registration deadline cannot be after the event start time"
            )

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
        return {"message": "Event updated successfully", "event_id": event_id}
    finally:
        connection.close()


def delete_admin_event(user_id: int, event_id: int):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution_id(cursor, user_id)
        _event_belongs_to_admin_institution(cursor, event_id, institution_id)

        cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
        connection.commit()
        return {"message": "Event deleted successfully", "event_id": event_id}
    finally:
        connection.close()


def set_admin_event_published(user_id: int, event_id: int, is_published: bool):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _admin_institution_id(cursor, user_id)
        _event_belongs_to_admin_institution(cursor, event_id, institution_id)

        cursor.execute(
            """
            UPDATE events
            SET is_published = %s
            WHERE id = %s
            """,
            (is_published, event_id),
        )
        connection.commit()
        return {
            "message": "Event publication status updated",
            "event_id": event_id,
            "is_published": is_published,
        }
    finally:
        connection.close()
