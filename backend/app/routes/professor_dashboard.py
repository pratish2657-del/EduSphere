from fastapi import APIRouter, HTTPException, Request

from app.database import get_connection
from app.middleware.auth_guard import require_professor

router = APIRouter(
    prefix="/professor/dashboard",
    tags=["Professor Dashboard"],
)


# ============================================================
# PROFESSOR DASHBOARD
#
# PROFESSOR ONLY
#
# Returns:
#   - Professor profile
#   - Assigned courses
#   - Assigned timetable
# ============================================================


@router.get("/")
async def professor_dashboard(request: Request):

    professor = require_professor(request)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # GET PROFESSOR PROFILE
        # ====================================================

        cursor.execute(
            """
            SELECT
                pp.id AS professor_id,

                pp.phone,
                pp.institution_id,
                i.name AS institution_name,
                i.university_code,
                pp.employee_id,
                pp.department,
                pp.designation,
                pp.specialization,
                pp.subjects,
                pp.academic_experience,
                pp.office_information,
                pp.verification_details,

                u.id AS user_id,
                u.email,
                u.full_name,
                u.profile_completed,
                u.verification_status

            FROM professor_profiles pp

            INNER JOIN users u
                ON pp.user_id = u.id

            INNER JOIN institutions i
                ON pp.institution_id = i.id

            WHERE pp.user_id = %s
              AND u.is_active = TRUE

            LIMIT 1
            """,
            (professor["id"],),
        )

        profile = cursor.fetchone()

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Professor profile not found",
            )

        # ====================================================
        # GET ASSIGNED COURSES
        # ====================================================

        cursor.execute(
            """
            SELECT DISTINCT
                c.id AS course_id,
                c.name AS course_name,
                c.code AS course_code,
                c.semester AS semester

            FROM timetables t

            INNER JOIN courses c
                ON t.course_id = c.id

            WHERE t.professor_id = %s

            ORDER BY c.name
            """,
            (profile["professor_id"],),
        )

        courses = cursor.fetchall()

        # ====================================================
        # GET ASSIGNED TIMETABLE
        #
        # Normalized schema:
        #
        # timetables.program_id
        #     -> programs.id
        #
        # timetables.section_id
        #     -> sections.id
        #
        # sections.program_id
        #     -> programs.id
        # ====================================================

        cursor.execute(
            """
            SELECT
                t.id AS timetable_id,

                t.day,
                t.start_time,
                t.end_time,
                t.room,

                t.program_id,
                p.name AS program_name,
                p.code AS program_code,

                t.section_id,
                s.name AS section_name,
                s.code AS section_code,

                t.academic_year,
                t.current_year,

                c.id AS course_id,
                c.name AS course_name,
                c.code AS course_code

            FROM timetables t

            INNER JOIN courses c
                ON t.course_id = c.id

            LEFT JOIN programs p
                ON t.program_id = p.id

            LEFT JOIN sections s
                ON t.section_id = s.id
               AND s.program_id = t.program_id

            WHERE t.professor_id = %s

            ORDER BY
                FIELD(
                    LOWER(t.day),
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday'
                ),
                t.start_time
            """,
            (profile["professor_id"],),
        )

        timetable = cursor.fetchall()

        # ====================================================
        # RESPONSE
        # ====================================================

        return {
            "message": "Welcome to EduSphere Professor Dashboard",

            "professor": {
                "id": profile["professor_id"],
                "user_id": profile["user_id"],
                "email": profile["email"],
                "full_name": profile["full_name"],
                "phone": profile["phone"],
                "institution_id": profile["institution_id"],
                "institution_name": profile["institution_name"],
                "institution_code": profile["university_code"],
                "university_code": profile["university_code"],
                "employee_id": profile["employee_id"],
                "department": profile["department"],
                "designation": profile["designation"],
                "specialization": profile["specialization"],
                "subjects": profile["subjects"],
                "academic_experience": profile[
                    "academic_experience"
                ],
                "office_information": profile[
                    "office_information"
                ],
                "verification_details": profile[
                    "verification_details"
                ],
                "profile_completed": bool(
                    profile["profile_completed"]
                ),
                "verification_status": profile[
                    "verification_status"
                ],
            },

            "courses": {
                "count": len(courses),
                "items": courses,
            },

            "timetable": {
                "count": len(timetable),
                "items": timetable,
            },
        }

    finally:
        connection.close()