from fastapi import APIRouter, HTTPException, Request

from app.database import get_connection
from app.middleware.auth_guard import get_current_user

router = APIRouter(
    prefix="/profile/student",
    tags=["Student Profile Options"],
)


@router.get("/options")
async def student_profile_options(request: Request):
    """
    Reference data used by the student profile setup form.

    Available to authenticated users who are setting up
    their student profile.

    Returns:
        institutions
        programs
        sections
    """

    user = get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # --------------------------------------------------------
        # INSTITUTIONS
        # --------------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name,
                university_code
            FROM institutions
            ORDER BY name ASC
            """
        )

        institutions = cursor.fetchall()

        # --------------------------------------------------------
        # PROGRAMS
        # --------------------------------------------------------

        cursor.execute(
            """
            SELECT
                p.id,
                p.institution_id,
                p.name,
                p.code,
                p.degree,
                p.duration_years
            FROM programs p
            WHERE p.is_active = TRUE
            ORDER BY
                p.institution_id ASC,
                p.name ASC
            """
        )

        programs = cursor.fetchall()

        # --------------------------------------------------------
        # SECTIONS
        # --------------------------------------------------------

        cursor.execute(
            """
            SELECT
                s.id,
                s.program_id,
                s.name,
                s.code,
                s.batch_start_year,
                s.batch_end_year
            FROM sections s
            WHERE s.is_active = TRUE
            ORDER BY
                s.program_id ASC,
                s.name ASC
            """
        )

        sections = cursor.fetchall()

        return {
            "institutions": institutions,
            "programs": programs,
            "sections": sections,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve student profile options",
        ) from error

    finally:
        connection.close()