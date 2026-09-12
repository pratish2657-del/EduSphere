from fastapi import APIRouter, HTTPException, Request

from app.database import get_connection
from app.middleware.auth_guard import require_super_admin
from app.schemas.institution import (
    InstitutionCreate,
    InstitutionUpdate,
)

router = APIRouter(prefix="/institutions", tags=["Institutions"])


@router.get("/")
async def list_institutions(request: Request):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                id,
                name,
                university_code,
                created_at
            FROM institutions
            ORDER BY name ASC, id ASC
        """)
        rows = cursor.fetchall()

        return {
            "count": len(rows),
            "institutions": rows,
        }
    finally:
        connection.close()


@router.post("/")
async def create_institution(
    request: Request,
    data: InstitutionCreate,
):
    require_super_admin(request)

    connection = get_connection()
    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id
            FROM institutions
            WHERE university_code = %s
            LIMIT 1
        """, (data.university_code.strip(),))

        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="An institution with this university code already exists",
            )

        cursor.execute("""
            INSERT INTO institutions (
                name,
                university_code
            )
            VALUES (%s, %s)
        """, (
            data.name.strip(),
            data.university_code.strip(),
        ))

        institution_id = cursor.lastrowid
        connection.commit()

        cursor.execute("""
            SELECT id, name, university_code, created_at
            FROM institutions
            WHERE id = %s
            LIMIT 1
        """, (institution_id,))

        return cursor.fetchone()
    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create institution",
        ) from error
    finally:
        connection.close()


@router.put("/{institution_id}")
async def update_institution(
    institution_id: int,
    request: Request,
    data: InstitutionUpdate,
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
        """, (institution_id,))

        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Institution not found",
            )

        cursor.execute("""
            SELECT id
            FROM institutions
            WHERE university_code = %s
              AND id <> %s
            LIMIT 1
        """, (
            data.university_code.strip(),
            institution_id,
        ))

        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="An institution with this university code already exists",
            )

        cursor.execute("""
            UPDATE institutions
            SET
                name = %s,
                university_code = %s
            WHERE id = %s
        """, (
            data.name.strip(),
            data.university_code.strip(),
            institution_id,
        ))

        connection.commit()

        cursor.execute("""
            SELECT id, name, university_code, created_at
            FROM institutions
            WHERE id = %s
            LIMIT 1
        """, (institution_id,))

        return cursor.fetchone()
    except HTTPException:
        connection.rollback()
        raise
    except Exception as error:
        connection.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update institution",
        ) from error
    finally:
        connection.close()
