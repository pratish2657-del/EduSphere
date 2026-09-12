from pydantic import BaseModel, Field


class AdminVerificationUpdate(BaseModel):
    status: str = Field(min_length=7, max_length=20)
    remarks: str = Field(default="", max_length=5000)
