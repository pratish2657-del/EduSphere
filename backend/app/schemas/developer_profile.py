
from pydantic import BaseModel, Field


class DeveloperProfileCreate(BaseModel):
    developer_id: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)
    designation: str = Field(min_length=1, max_length=150)
    department: str = Field(min_length=1, max_length=150)
    experience: str | None = Field(default=None, max_length=100)
    primary_role: str = Field(min_length=1, max_length=150)
    skills: str = Field(min_length=1)
    github: str | None = Field(default=None, max_length=500)
    linkedin: str | None = Field(default=None, max_length=500)
    portfolio: str | None = Field(default=None, max_length=500)
    bio: str | None = None


class DeveloperVerificationDecision(BaseModel):
    status: str
    remarks: str | None = None
