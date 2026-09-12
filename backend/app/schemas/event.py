from datetime import datetime

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
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