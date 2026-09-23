from pydantic import BaseModel, Field


class StudentProfileCreate(BaseModel):
    phone: str = Field(
        min_length=1,
        max_length=20,
    )

    institution_id: int
    upi_id: str | None = None
    enrollment_number: str = Field(
        min_length=1,
        max_length=100,
    )

    program_id: int
    section_id: int

    academic_year: str = Field(
        min_length=1,
        max_length=50,
    )

    current_year: int = Field(
        ge=1,
        le=10,
    )

    semester: int = Field(
        ge=1,
        le=20,
    )

    student_id: str = Field(
        min_length=1,
        max_length=100,
    )

    admission_year: int = Field(
        ge=1900,
        le=3000,
    )


class StudentProfileUpdate(BaseModel):
    phone: str = Field(
        min_length=1,
        max_length=20,
    )

    institution_id: int

    enrollment_number: str = Field(
        min_length=1,
        max_length=100,
    )

    program_id: int
    section_id: int

    academic_year: str = Field(
        min_length=1,
        max_length=50,
    )

    current_year: int = Field(
        ge=1,
        le=10,
    )

    semester: int = Field(
        ge=1,
        le=20,
    )

    student_id: str = Field(
        min_length=1,
        max_length=100,
    )

    admission_year: int = Field(
        ge=1900,
        le=3000,
    )