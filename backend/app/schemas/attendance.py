from datetime import date

from pydantic import BaseModel, Field

# ============================================================
# CREATE ATTENDANCE
# PROFESSOR
# ============================================================


class AttendanceCreate(BaseModel):
    student_id: int = Field(..., gt=0)

    course_id: int = Field(..., gt=0)

    attendance_date: date

    status: str


# ============================================================
# UPDATE ATTENDANCE
# PROFESSOR
# ============================================================


class AttendanceUpdate(BaseModel):
    status: str


# ============================================================
# ATTENDANCE RESPONSE
# ============================================================


class AttendanceResponse(BaseModel):
    id: int

    student_id: int

    course_id: int

    attendance_date: date

    status: str
