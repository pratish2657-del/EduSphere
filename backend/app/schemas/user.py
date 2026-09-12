from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role: str | None = None
    is_active: bool | None = None