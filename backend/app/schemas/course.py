from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    institution_id: int

    program_id: int

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    code: str = Field(
        min_length=1,
        max_length=100,
    )

    semester: int = Field(
        ge=1,
        le=12,
    )


class CourseUpdate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
    )

    code: str = Field(
        min_length=1,
        max_length=100,
    )

    semester: int = Field(
        ge=1,
        le=12,
    )

