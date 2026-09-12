from pydantic import BaseModel, Field

# ============================================================
# CREATE SECTION
# ============================================================


class SectionCreate(BaseModel):
    program_id: int

    name: str = Field(
        min_length=1,
        max_length=100,
    )

    code: str = Field(
        min_length=1,
        max_length=100,
    )

    batch_start_year: int = Field(
        ge=2000,
        le=2100,
    )

    batch_end_year: int = Field(
        ge=2000,
        le=2100,
    )

    is_active: bool = True


# ============================================================
# UPDATE SECTION
# ============================================================


class SectionUpdate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    code: str = Field(
        min_length=1,
        max_length=100,
    )

    batch_start_year: int = Field(
        ge=2000,
        le=2100,
    )

    batch_end_year: int = Field(
        ge=2000,
        le=2100,
    )

    is_active: bool = True