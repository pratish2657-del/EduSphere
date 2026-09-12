
from pydantic import BaseModel


class ProfessorVerificationUpdate(BaseModel):
    status: str

    remarks: str | None = None


class AdminCreate(BaseModel):
    google_id: str

    email: str

    full_name: str


class AdminStatusUpdate(BaseModel):
    is_active: bool
