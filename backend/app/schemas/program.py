from pydantic import BaseModel, Field

# ============================================================
# CREATE PROGRAM
# ============================================================


class ProgramCreate(BaseModel):
    institution_id: int

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    code: str = Field(
        min_length=1,
        max_length=100,
    )

    degree: str = Field(
        min_length=1,
        max_length=100,
    )

    duration_years: int = Field(
        default=4,
        ge=1,
        le=10,
    )

    is_active: bool = True


# ============================================================
# UPDATE PROGRAM
# ============================================================


class ProgramUpdate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
    )

    code: str = Field(
        min_length=1,
        max_length=100,
    )

    degree: str = Field(
        min_length=1,
        max_length=100,
    )

    duration_years: int = Field(
        ge=1,
        le=10,
    )

    is_active: bool = True