from pydantic import BaseModel, Field

# ============================================================
# STUDENT PROFILE
# ============================================================


class StudentProfileCreate(BaseModel):
    phone: str = Field(
        min_length=10,
        max_length=20,
    )

    institution_id: int
    upi_id: str | None = None

    enrollment_number: str = Field(
        min_length=1,
        max_length=100,
    )

    program_id: int

    academic_year: str = Field(
        min_length=1,
        max_length=50,
    )

    current_year: int = Field(
        ge=1,
        le=4,
    )

    semester: int = Field(
        ge=1,
        le=12,
    )

    section_id: int

    student_id: str = Field(
        min_length=1,
        max_length=100,
    )

    admission_year: int = Field(
        ge=1900,
        le=2100,
    )


# ============================================================
# PROFESSOR PROFILE
# ============================================================


class ProfessorProfileCreate(BaseModel):
    phone: str = Field(
        min_length=10,
        max_length=20,
    )

    institution_id: int

    employee_id: str = Field(
        min_length=1,
        max_length=100,
    )

    department: str = Field(
        min_length=1,
        max_length=150,
    )

    designation: str = Field(
        min_length=1,
        max_length=150,
    )

    specialization: str = Field(
        min_length=1,
        max_length=255,
    )

    subjects: str = Field(
        min_length=1,
    )

    academic_experience: str = Field(
        min_length=1,
    )

    office_information: str = Field(
        min_length=1,
    )

    verification_details: str = Field(
        min_length=1,
    )