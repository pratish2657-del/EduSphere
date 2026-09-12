from fastapi import APIRouter, HTTPException, Query, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin
from app.schemas.super_admin_course import (
    SuperAdminCourseCreate,
    SuperAdminCourseUpdate,
)

router = APIRouter(
    prefix="/super-admin/courses",
    tags=["Super Admin Courses"],
)


@router.get("/")
async def list_courses(
    request: Request,
    search: str | None = Query(default=None),
    institution_id: int | None = Query(default=None),
    program_id: int | None = Query(default=None),
):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()

        conditions = []
        params = []

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append("""
                (
                    c.name LIKE %s
                    OR c.code LIKE %s
                    OR i.name LIKE %s
                    OR i.university_code LIKE %s
                    OR p.name LIKE %s
                    OR p.code LIKE %s
                )
            """)
            params.extend([term] * 6)

        if institution_id is not None:
            conditions.append("c.institution_id = %s")
            params.append(institution_id)

        if program_id is not None:
            conditions.append("c.program_id = %s")
            params.append(program_id)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cursor.execute(
            f"""
            SELECT
                c.id,
                c.institution_id,
                i.name AS institution_name,
                i.university_code,
                c.program_id,
                p.name AS program_name,
                p.code AS program_code,
                c.name,
                c.code,
                c.semester,
                c.created_at
            FROM courses c
            LEFT JOIN institutions i ON c.institution_id = i.id
            LEFT JOIN programs p ON c.program_id = p.id
            {where}
            ORDER BY i.name, p.name, c.semester, c.name
            """,
            tuple(params),
        )

        courses = cursor.fetchall()

        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                COUNT(DISTINCT institution_id) AS institutions,
                COUNT(DISTINCT program_id) AS programs
            FROM courses
        """)
        stats = cursor.fetchone()

        return {
            "count": len(courses),
            "courses": courses,
            "stats": stats,
        }
    finally:
        connection.close()


@router.post("/")
async def create_course(
    request: Request,
    data: SuperAdminCourseCreate,
):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id
            FROM institutions
            WHERE id = %s
            LIMIT 1
        """, (data.institution_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Institution not found")

        cursor.execute("""
            SELECT id
            FROM programs
            WHERE id = %s
              AND institution_id = %s
              AND is_active = TRUE
            LIMIT 1
        """, (data.program_id, data.institution_id))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Program does not belong to the selected institution",
            )

        cursor.execute("""
            SELECT id
            FROM courses
            WHERE program_id = %s
              AND code = %s
            LIMIT 1
        """, (data.program_id, data.code.strip()))
        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="A course with this code already exists in this program",
            )

        cursor.execute("""
            INSERT INTO courses (
                institution_id,
                program_id,
                name,
                code,
                semester
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            data.institution_id,
            data.program_id,
            data.name.strip(),
            data.code.strip(),
            data.semester,
        ))

        course_id = cursor.lastrowid
        connection.commit()

        return {
            "message": "Course created successfully",
            "course_id": course_id,
        }
    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create course",
        ) from error
    finally:
        connection.close()


@router.put("/{course_id}")
async def update_course(
    course_id: int,
    request: Request,
    data: SuperAdminCourseUpdate,
):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id
            FROM courses
            WHERE id = %s
            LIMIT 1
        """, (course_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Course not found")

        cursor.execute("""
            SELECT id
            FROM programs
            WHERE id = %s
              AND institution_id = %s
              AND is_active = TRUE
            LIMIT 1
        """, (data.program_id, data.institution_id))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Program does not belong to the selected institution",
            )

        cursor.execute("""
            SELECT id
            FROM courses
            WHERE program_id = %s
              AND code = %s
              AND id <> %s
            LIMIT 1
        """, (data.program_id, data.code.strip(), course_id))
        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="A course with this code already exists in this program",
            )

        cursor.execute("""
            UPDATE courses
            SET
                institution_id = %s,
                program_id = %s,
                name = %s,
                code = %s,
                semester = %s
            WHERE id = %s
        """, (
            data.institution_id,
            data.program_id,
            data.name.strip(),
            data.code.strip(),
            data.semester,
            course_id,
        ))

        connection.commit()

        return {
            "message": "Course updated successfully",
            "course_id": course_id,
        }
    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update course",
        ) from error
    finally:
        connection.close()


@router.delete("/{course_id}")
async def delete_course(
    course_id: int,
    request: Request,
):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id
            FROM courses
            WHERE id = %s
            LIMIT 1
        """, (course_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Course not found")

        cursor.execute("""
            DELETE FROM courses
            WHERE id = %s
        """, (course_id,))

        connection.commit()

        return {
            "message": "Course deleted successfully",
            "course_id": course_id,
        }
    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to delete course",
        ) from error
    finally:
        connection.close()
