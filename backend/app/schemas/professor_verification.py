from pydantic import BaseModel, Field


class ProfessorVerificationDecision(BaseModel):
    remarks: str | None = Field(
        default=None,
        max_length=5000,
    )