from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from zoneinfo import ZoneInfo

EVENT_TIMEZONE = ZoneInfo("Asia/Kolkata")


def _normalize_datetime(value):
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(EVENT_TIMEZONE).replace(tzinfo=None)


class EventCreate(BaseModel):
    @field_validator(
        "start_datetime",
        "end_datetime",
        "registration_deadline",
        mode="before",
    )
    @classmethod
    def normalize_event_datetime(cls, value):
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return _normalize_datetime(value)
        return value

    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str = Field(
        min_length=1,
    )

    event_type: str = Field(
        min_length=1,
        max_length=100,
    )

    start_datetime: datetime
    end_datetime: datetime

    venue: str = Field(
        min_length=1,
        max_length=255,
    )

    organizer: str = Field(
        min_length=1,
        max_length=255,
    )

    registration_deadline: datetime | None = None
    registration_link: str | None = None

    # --------------------------------------------------------
    # Event visibility
    # --------------------------------------------------------
    #
    # NULL = all programs / sections
    #
    # When provided:
    #   target_program_id -> programs.id
    #   target_section_id -> sections.id
    #
    # target_section_id must belong to target_program_id.
    # --------------------------------------------------------

    target_program_id: int | None = None

    target_section_id: int | None = None

    target_year: int | None = Field(
        default=None,
        ge=1,
        le=10,
    )


class EventUpdate(BaseModel):
    @field_validator(
        "start_datetime",
        "end_datetime",
        "registration_deadline",
        mode="before",
    )
    @classmethod
    def normalize_event_datetime(cls, value):
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return _normalize_datetime(value)
        return value

    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str = Field(
        min_length=1,
    )

    event_type: str = Field(
        min_length=1,
        max_length=100,
    )

    start_datetime: datetime
    end_datetime: datetime

    venue: str = Field(
        min_length=1,
        max_length=255,
    )

    organizer: str = Field(
        min_length=1,
        max_length=255,
    )

    registration_deadline: datetime | None = None
    registration_link: str | None = None

    target_program_id: int | None = None

    target_section_id: int | None = None

    target_year: int | None = Field(
        default=None,
        ge=1,
        le=10,
    )


class EventPublish(BaseModel):
    is_published: bool