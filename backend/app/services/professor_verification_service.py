from app.core.exceptions import (
    ConflictError,
    NotFoundError,
)
from app.database import get_connection

# ============================================================
# GET PENDING PROFESSORS
# ============================================================


def get_pending_professors():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                pp.id AS professor_id,
                pp.user_id,
                u.email,
                u.full_name,
                u.verification_status,

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

                pv.id AS verification_id,
                pv.status AS verification_status,
                pv.remarks,
                pv.submitted_at,
                pv.verified_by,
                pv.verified_at

            FROM professor_verifications pv

            INNER JOIN professor_profiles pp
                ON pv.professor_id = pp.id

            INNER JOIN users u
                ON pp.user_id = u.id

            INNER JOIN institutions i
                ON pp.institution_id = i.id

            WHERE pv.status = 'PENDING'

            ORDER BY pv.submitted_at ASC
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()


# ============================================================
# GET PROFESSOR VERIFICATION
# ============================================================


def get_professor_verification(professor_id):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                pp.id AS professor_id,
                pp.user_id,

                u.email,
                u.full_name,
                u.is_active,
                u.verification_status AS user_verification_status,

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

                pv.id AS verification_id,
                pv.status AS verification_status,
                pv.remarks,
                pv.submitted_at,
                pv.verified_by,
                pv.verified_at

            FROM professor_profiles pp

            INNER JOIN users u
                ON pp.user_id = u.id

            INNER JOIN institutions i
                ON pp.institution_id = i.id

            INNER JOIN professor_verifications pv
                ON pp.id = pv.professor_id

            WHERE pp.id = %s
            """,
            (professor_id,),
        )

        professor = cursor.fetchone()

        if not professor:
            raise NotFoundError(
                "Professor verification record not found"
            )

        return professor

    finally:
        connection.close()


# ============================================================
# VERIFY PROFESSOR
# ============================================================


def verify_professor(
    professor_id,
    admin_user_id,
    remarks=None,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find verification
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                pv.id,
                pv.professor_id,
                pv.status,
                pp.user_id

            FROM professor_verifications pv

            INNER JOIN professor_profiles pp
                ON pv.professor_id = pp.id

            WHERE pv.professor_id = %s
            """,
            (professor_id,),
        )

        verification = cursor.fetchone()

        if not verification:
            raise NotFoundError(
                "Professor verification record not found"
            )

        # ----------------------------------------------------
        # Only pending records can be verified
        # ----------------------------------------------------

        if verification["status"] != "PENDING":
            raise ConflictError(
                "Professor verification has already been processed"
            )

        # ----------------------------------------------------
        # Verify professor
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE professor_verifications

            SET
                status = 'VERIFIED',
                remarks = %s,
                verified_by = %s,
                verified_at = CURRENT_TIMESTAMP

            WHERE professor_id = %s
              AND status = 'PENDING'
            """,
            (
                remarks,
                admin_user_id,
                professor_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Professor verification could not be completed"
            )

        # ----------------------------------------------------
        # Update user verification status
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users

            SET
                verification_status = 'VERIFIED'

            WHERE id = %s
            """,
            (verification["user_id"],),
        )

        connection.commit()

        return {
            "message": "Professor verified successfully",
            "professor_id": professor_id,
            "verification_status": "VERIFIED",
            "remarks": remarks,
            "verified_by": admin_user_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# REJECT PROFESSOR
# ============================================================


def reject_professor(
    professor_id,
    admin_user_id,
    remarks=None,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ----------------------------------------------------
        # Find verification
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                pv.id,
                pv.professor_id,
                pv.status,
                pp.user_id

            FROM professor_verifications pv

            INNER JOIN professor_profiles pp
                ON pv.professor_id = pp.id

            WHERE pv.professor_id = %s
            """,
            (professor_id,),
        )

        verification = cursor.fetchone()

        if not verification:
            raise NotFoundError(
                "Professor verification record not found"
            )

        # ----------------------------------------------------
        # Only pending records can be rejected
        # ----------------------------------------------------

        if verification["status"] != "PENDING":
            raise ConflictError(
                "Professor verification has already been processed"
            )

        # ----------------------------------------------------
        # Reject professor
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE professor_verifications

            SET
                status = 'REJECTED',
                remarks = %s,
                verified_by = %s,
                verified_at = CURRENT_TIMESTAMP

            WHERE professor_id = %s
              AND status = 'PENDING'
            """,
            (
                remarks,
                admin_user_id,
                professor_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Professor verification could not be rejected"
            )

        # ----------------------------------------------------
        # Update user verification status
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users

            SET
                verification_status = 'REJECTED'

            WHERE id = %s
            """,
            (verification["user_id"],),
        )

        connection.commit()

        return {
            "message": "Professor rejected successfully",
            "professor_id": professor_id,
            "verification_status": "REJECTED",
            "remarks": remarks,
            "verified_by": admin_user_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()