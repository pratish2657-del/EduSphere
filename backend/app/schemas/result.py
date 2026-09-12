from pydantic import BaseModel, Field


class ResultCreate(BaseModel):
    # Preferred human-facing identifiers.
    enrollment_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    subject_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    # Backward-compatible internal identifiers.
    student_profile_id: int | None = Field(default=None, ge=1)
    course_id: int | None = Field(default=None, ge=1)

    exam_type: str = Field(min_length=1, max_length=100)
    academic_year: str = Field(min_length=1, max_length=50)
    semester: int = Field(ge=1, le=12)

    # Optional because the Statement of Grades can be grade-only.
    marks_obtained: float | None = Field(default=None, ge=0)
    maximum_marks: float | None = Field(default=None, gt=0)

    grade: str | None = Field(default=None, max_length=20)
    grade_point: float | None = Field(default=None, ge=0)

    credits: float | None = Field(default=None, ge=0)
    credit_points: float | None = Field(default=None, ge=0)

    result_status: str = Field(
        default="PASS",
        pattern="^(PASS|FAIL|ABSENT|WITHHELD)$",
    )


class ResultUpdate(BaseModel):
    enrollment_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    subject_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    # Backward-compatible internal course id.
    course_id: int | None = Field(default=None, ge=1)

    exam_type: str = Field(min_length=1, max_length=100)
    academic_year: str = Field(min_length=1, max_length=50)
    semester: int = Field(ge=1, le=12)

    marks_obtained: float | None = Field(default=None, ge=0)
    maximum_marks: float | None = Field(default=None, gt=0)

    grade: str | None = Field(default=None, max_length=20)
    grade_point: float | None = Field(default=None, ge=0)

    credits: float | None = Field(default=None, ge=0)
    credit_points: float | None = Field(default=None, ge=0)

    result_status: str = Field(
        default="PASS",
        pattern="^(PASS|FAIL|ABSENT|WITHHELD)$",
    )
