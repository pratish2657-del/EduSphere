from datetime import date
from unittest.mock import MagicMock

import pytest

from app.schemas.attendance import AttendanceCreate, AttendanceUpdate
from app.services import attendance_service

# ============================================================
# TEST HELPERS
# ============================================================

def make_connection(fetchone_values=None, fetchall_value=None):
    """Create a fake DB connection/cursor for service-level tests."""
    connection = MagicMock()
    cursor = MagicMock()

    values = list(fetchone_values or [])
    cursor.fetchone.side_effect = values
    cursor.fetchall.return_value = fetchall_value or []

    connection.cursor.return_value = cursor
    cursor.lastrowid = 101

    return connection, cursor


def patch_connection(monkeypatch, connection):
    monkeypatch.setattr(
        attendance_service,
        "get_connection",
        lambda: connection,
    )


# ============================================================
# CREATE ATTENDANCE
# ============================================================

def test_create_attendance_success(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            {"id": 30},       # course_teachers
            {"id": 40},       # course_enrollments
            None,             # duplicate attendance
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status=" present ",
    )

    result = attendance_service.create_attendance(
        user_id=10,
        data=data,
    )

    assert result["message"] == "Attendance marked successfully"
    assert result["attendance_id"] == 101
    assert result["student_id"] == 20
    assert result["course_id"] == 30
    assert result["attendance_date"] == date(2026, 8, 29)
    assert result["status"] == "PRESENT"

    connection.commit.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("status", ["PRESENT", "ABSENT", "LATE", "EXCUSED"])
def test_create_attendance_accepts_all_valid_statuses(monkeypatch, status):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            {"id": 30},
            {"id": 40},
            None,
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status=status,
    )

    result = attendance_service.create_attendance(10, data)

    assert result["status"] == status
    connection.commit.assert_called_once()


def test_create_attendance_rejects_invalid_status(monkeypatch):
    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status="HOLIDAY",
    )

    with pytest.raises(Exception, match="Invalid attendance status"):
        attendance_service.create_attendance(10, data)


def test_create_attendance_rejects_student_user(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "STUDENT"},
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status="PRESENT",
    )

    with pytest.raises(Exception, match="Only professors or admins"):
        attendance_service.create_attendance(10, data)

    connection.rollback.assert_called_once()


def test_create_attendance_rejects_unassigned_professor(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            None,
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status="PRESENT",
    )

    with pytest.raises(Exception, match="not assigned to this course"):
        attendance_service.create_attendance(10, data)


def test_create_attendance_rejects_unenrolled_student(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            {"id": 30},
            None,
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status="PRESENT",
    )

    with pytest.raises(Exception, match="not enrolled in this course"):
        attendance_service.create_attendance(10, data)


def test_create_attendance_rejects_duplicate(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            {"id": 30},
            {"id": 40},
            {"id": 99},
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceCreate(
        student_id=20,
        course_id=30,
        attendance_date=date(2026, 8, 29),
        status="PRESENT",
    )

    with pytest.raises(Exception, match="Attendance already exists"):
        attendance_service.create_attendance(10, data)

    connection.rollback.assert_called_once()


# ============================================================
# GET ATTENDANCE
# ============================================================

def test_get_attendance_admin_can_view_record(monkeypatch):
    attendance = {
        "id": 101,
        "student_id": 20,
        "student_name": "Test Student",
        "course_id": 30,
        "course_name": "Algorithms",
        "course_code": "CS301",
        "attendance_date": date(2026, 8, 29),
        "status": "PRESENT",
    }

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 1, "is_active": True, "role": "ADMIN"},
            attendance,
        ]
    )
    patch_connection(monkeypatch, connection)

    result = attendance_service.get_attendance(
        attendance_id=101,
        user_id=1,
    )

    assert result == attendance


def test_get_attendance_student_can_view_own_record(monkeypatch):
    attendance = {
        "id": 101,
        "student_id": 20,
        "student_name": "Test Student",
        "course_id": 30,
        "course_name": "Algorithms",
        "course_code": "CS301",
        "attendance_date": date(2026, 8, 29),
        "status": "PRESENT",
    }

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            attendance,
            {"id": 40},  # enrollment
        ]
    )
    patch_connection(monkeypatch, connection)

    result = attendance_service.get_attendance(
        attendance_id=101,
        user_id=20,
    )

    assert result["id"] == 101
    assert result["status"] == "PRESENT"


def test_get_attendance_rejects_other_student(monkeypatch):
    attendance = {
        "id": 101,
        "student_id": 99,
        "student_name": "Other Student",
        "course_id": 30,
        "course_name": "Algorithms",
        "course_code": "CS301",
        "attendance_date": date(2026, 8, 29),
        "status": "PRESENT",
    }

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            attendance,
        ]
    )
    patch_connection(monkeypatch, connection)

    with pytest.raises(Exception, match="only view your own attendance"):
        attendance_service.get_attendance(
            attendance_id=101,
            user_id=20,
        )


def test_get_attendance_not_found(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            None,
        ]
    )
    patch_connection(monkeypatch, connection)

    with pytest.raises(Exception, match="Attendance record not found"):
        attendance_service.get_attendance(
            attendance_id=9999,
            user_id=20,
        )


# ============================================================
# UPDATE ATTENDANCE
# ============================================================

def test_update_attendance_success(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {
                "id": 101,
                "student_id": 20,
                "course_id": 30,
                "attendance_date": date(2026, 8, 29),
                "status": "ABSENT",
            },
            {"id": 30},  # professor course access
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceUpdate(status=" late ")

    result = attendance_service.update_attendance(
        attendance_id=101,
        user_id=10,
        data=data,
    )

    assert result == {
        "message": "Attendance updated successfully",
        "attendance_id": 101,
        "status": "LATE",
    }

    connection.commit.assert_called_once()


def test_update_attendance_rejects_invalid_status(monkeypatch):
    data = AttendanceUpdate(status="UNKNOWN")

    with pytest.raises(Exception, match="Invalid attendance status"):
        attendance_service.update_attendance(
            attendance_id=101,
            user_id=10,
            data=data,
        )


def test_update_attendance_not_found(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "ADMIN"},
            None,
        ]
    )
    patch_connection(monkeypatch, connection)

    data = AttendanceUpdate(status="PRESENT")

    with pytest.raises(Exception, match="Attendance record not found"):
        attendance_service.update_attendance(
            attendance_id=9999,
            user_id=10,
            data=data,
        )


# ============================================================
# STUDENT ATTENDANCE
# ============================================================

def test_get_student_attendance_student_sees_own_records(monkeypatch):
    rows = [
        {
            "id": 101,
            "student_id": 20,
            "course_id": 30,
            "course_name": "Algorithms",
            "course_code": "CS301",
            "attendance_date": date(2026, 8, 29),
            "status": "PRESENT",
        },
        {
            "id": 102,
            "student_id": 20,
            "course_id": 30,
            "course_name": "Algorithms",
            "course_code": "CS301",
            "attendance_date": date(2026, 8, 28),
            "status": "ABSENT",
        },
    ]

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            {"id": 20, "role": "STUDENT", "is_active": True},
        ],
        fetchall_value=rows,
    )
    patch_connection(monkeypatch, connection)

    result = attendance_service.get_student_attendance(
        student_id=20,
        user_id=20,
    )

    assert result["count"] == 2
    assert result["attendance"] == rows


def test_get_student_attendance_student_cannot_view_other_student(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            {"id": 99, "role": "STUDENT", "is_active": True},
        ]
    )
    patch_connection(monkeypatch, connection)

    with pytest.raises(Exception, match="only view your own attendance"):
        attendance_service.get_student_attendance(
            student_id=99,
            user_id=20,
        )


def test_get_student_attendance_professor_requires_course(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 20, "role": "STUDENT", "is_active": True},
        ]
    )
    patch_connection(monkeypatch, connection)

    with pytest.raises(Exception, match="Professor must specify a course"):
        attendance_service.get_student_attendance(
            student_id=20,
            user_id=10,
        )


# ============================================================
# COURSE ATTENDANCE
# ============================================================

def test_get_course_attendance_professor_success(monkeypatch):
    rows = [
        {
            "id": 101,
            "student_id": 20,
            "student_name": "A Student",
            "course_id": 30,
            "course_name": "Algorithms",
            "course_code": "CS301",
            "attendance_date": date(2026, 8, 29),
            "status": "PRESENT",
        }
    ]

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 10, "is_active": True, "role": "PROFESSOR"},
            {"id": 30},
        ],
        fetchall_value=rows,
    )
    patch_connection(monkeypatch, connection)

    result = attendance_service.get_course_attendance(
        course_id=30,
        user_id=10,
    )

    assert result["count"] == 1
    assert result["attendance"] == rows


def test_get_course_attendance_student_is_forbidden(monkeypatch):
    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
        ]
    )
    patch_connection(monkeypatch, connection)

    with pytest.raises(Exception, match="Only professors or admins"):
        attendance_service.get_course_attendance(
            course_id=30,
            user_id=20,
        )


# ============================================================
# ATTENDANCE SUMMARY
# ============================================================

def test_get_attendance_summary_calculates_percentage(monkeypatch):
    summary = {
        "course_id": 30,
        "course_name": "Algorithms",
        "course_code": "CS301",
        "total_classes": 8,
        "present_count": 5,
        "absent_count": 1,
        "late_count": 1,
        "excused_count": 1,
    }

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            {"id": 40},  # enrollment
            summary,
        ]
    )
    patch_connection(monkeypatch, connection)

    result = attendance_service.get_attendance_summary(
        student_id=20,
        user_id=20,
        course_id=30,
    )

    assert result["total_classes"] == 8
    assert result["present_count"] == 5
    assert result["absent_count"] == 1
    assert result["late_count"] == 1
    assert result["excused_count"] == 1
    assert result["attendance_percentage"] == 62.5


def test_get_attendance_summary_zero_classes_returns_zero_percentage(
    monkeypatch,
):
    summary = {
        "course_id": 30,
        "course_name": "Algorithms",
        "course_code": "CS301",
        "total_classes": 0,
        "present_count": 0,
        "absent_count": 0,
        "late_count": 0,
        "excused_count": 0,
    }

    connection, _ = make_connection(
        fetchone_values=[
            {"id": 20, "is_active": True, "role": "STUDENT"},
            {"id": 20, "role": "STUDENT", "is_active": True},
            {"id": 40},
            summary,
        ]
    )
    patch_connection(monkeypatch, connection)

    result = attendance_service.get_attendance_summary(
        student_id=20,
        user_id=20,
        course_id=30,
    )

    assert result["attendance_percentage"] == 0.0
