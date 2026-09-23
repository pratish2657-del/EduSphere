from pydantic import BaseModel, Field


class AdminProfileCreate(BaseModel):
    phone: str = Field(min_length=7, max_length=30)
    institution_code: str = Field(min_length=4, max_length=100)
    admin_id: str = Field(min_length=2, max_length=100)
    upi_id: str | None = None
    department: str = Field(min_length=2, max_length=150)
    designation: str = Field(min_length=2, max_length=150)
    office_information: str = ""
    responsibilities: str = ""
    profile_photo_url: str | None = None
