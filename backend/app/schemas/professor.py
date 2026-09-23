from pydantic import BaseModel


class ProfessorProfileCreate(BaseModel):
    phone: str
    institution_id: int | None = None
    institution_code: str | None = None
    upi_id: str | None = None
    employee_id: str
    department: str
    designation: str
    specialization: str
    subjects: str
    academic_experience: str
    office_information: str
    verification_details: str