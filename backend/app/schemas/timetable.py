from datetime import time

from pydantic import BaseModel, Field

# ============================================================
# CREATE TIMETABLE
# ============================================================


class TimetableCreate(BaseModel):
    institution_id: int
    program_id: int
    section_id: int
    course_id: int

    academic_year: str = Field(
        min_length=1,
        max_length=50,
    )

    current_year: int = Field(
        ge=1,
        le=10,
    )

    day: str = Field(
        min_length=1,
        max_length=20,
    )

    start_time: time
    end_time: time

    room: str = Field(
        min_length=1,
        max_length=100,
    )


# ============================================================
# UPDATE TIMETABLE
# ============================================================


class TimetableUpdate(BaseModel):
    program_id: int
    section_id: int
    course_id: int

    academic_year: str = Field(
        min_length=1,
        max_length=50,
    )

    current_year: int = Field(
        ge=1,
        le=10,
    )

    day: str = Field(
        min_length=1,
        max_length=20,
    )

    start_time: time
    end_time: time

    room: str = Field(
        min_length=1,
        max_length=100,
    )


# ============================================================
# PROFESSOR ASSIGNMENT
# ============================================================


class ProfessorAssignment(BaseModel):
    professor_id: int | None = None