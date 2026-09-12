from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

VALID_DAYS = {
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
}

# ============================================================
# PROFESSOR MANAGEMENT
# ============================================================


def get_pending_professors():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                pp.id AS professor_id,
                u.id AS user_id,
                u.email,
                u.full_name,
                u.profile_completed,
                u.verification_status AS user_verification_status,

                pp.phone,
                pp.employee_id,
                pp.department,
                pp.designation,
                pp.specialization,
                pp.subjects,
                pp.academic_experience,
                pp.office_information,
                pp.verification_details,

                i.id AS institution_id,
                i.name AS institution_name,
                i.university_code,

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

            WHERE pv.status = 'PENDING'

            ORDER BY pv.submitted_at ASC
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()


def verify_professor(
    professor_id,
    admin_user_id,
    status,
    remarks,
):

    status = status.upper()

    if status not in ["VERIFIED", "REJECTED"]:
        raise BadRequestError(
            "Status must be VERIFIED or REJECTED"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # VERIFY REQUESTING ADMIN
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.is_active,
                u.is_super_admin,
                r.name AS role

            FROM users u

            LEFT JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s
            """,
            (admin_user_id,),
        )

        admin = cursor.fetchone()

        if not admin:
            raise NotFoundError(
                "Admin account not found"
            )

        if not bool(admin["is_active"]):
            raise ForbiddenError(
                "Admin account is inactive"
            )

        # IMPORTANT:
        # MySQL TINYINT(1) can return 1/0, not Python True/False.
        is_super_admin = bool(
            admin["is_super_admin"]
        )

        if not (
            admin["role"] == "ADMIN"
            or (
                admin["role"] == "SUPER_ADMIN"
                and is_super_admin
            )
        ):
            raise ForbiddenError(
                "Only ADMIN or SUPER_ADMIN can verify professors"
            )

        # ====================================================
        # GET PROFESSOR
        # ====================================================

        cursor.execute(
            """
            SELECT
                pp.id AS professor_id,
                pp.user_id,
                u.email,
                u.is_active,
                pv.status AS current_status

            FROM professor_profiles pp

            INNER JOIN users u
                ON pp.user_id = u.id

            INNER JOIN professor_verifications pv
                ON pp.id = pv.professor_id

            WHERE pp.id = %s
            """,
            (professor_id,),
        )

        professor = cursor.fetchone()

        if not professor:
            raise NotFoundError(
                "Professor profile not found"
            )

        if not bool(professor["is_active"]):
            raise ForbiddenError(
                "Professor account is inactive"
            )

        current_status = professor["current_status"]

        # ====================================================
        # VERIFICATION LIFECYCLE
        # ====================================================

        if current_status == "VERIFIED":
            raise ConflictError(
                "Professor is already VERIFIED. "
                "The professor must update their profile "
                "and go through the PENDING review cycle again."
            )

        if current_status == "REJECTED":
            raise ConflictError(
                "Rejected professor must update and "
                "resubmit their profile before verification."
            )

        if current_status != "PENDING":
            raise ConflictError(
                "Professor is not currently pending verification."
            )

        # ====================================================
        # UPDATE VERIFICATION
        # ====================================================

        cursor.execute(
            """
            UPDATE professor_verifications

            SET
                status = %s,
                remarks = %s,
                verified_by = %s,
                verified_at = CURRENT_TIMESTAMP

            WHERE professor_id = %s
              AND status = 'PENDING'
            """,
            (
                status,
                remarks,
                admin_user_id,
                professor_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Professor verification was already processed."
            )

        # ====================================================
        # UPDATE USER VERIFICATION STATUS
        # ====================================================

        cursor.execute(
            """
            UPDATE users

            SET
                verification_status = %s

            WHERE id = %s
            """,
            (
                status,
                professor["user_id"],
            ),
        )

        connection.commit()

        if status == "VERIFIED":
            message = "Professor verified successfully"
        else:
            message = "Professor rejected successfully"

        return {
            "message": message,
            "professor_id": professor_id,
            "status": status,
            "remarks": remarks,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# ADMIN MANAGEMENT
# SUPER_ADMIN ONLY
# ============================================================


def create_admin(
    super_admin_id,
    google_id,
    email,
    full_name,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # VERIFY REQUESTING SUPER ADMIN
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.is_active,
                u.is_super_admin,
                r.name AS role

            FROM users u

            LEFT JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s
            """,
            (super_admin_id,),
        )

        requester = cursor.fetchone()

        if not requester:
            raise NotFoundError(
                "Requesting user not found"
            )

        if not bool(requester["is_active"]):
            raise ForbiddenError(
                "SUPER_ADMIN account is inactive"
            )

        # IMPORTANT:
        # MySQL TINYINT(1) => 1/0.
        is_super_admin = bool(
            requester["is_super_admin"]
        )

        if (
            requester["role"] != "SUPER_ADMIN"
            or not is_super_admin
        ):
            raise ForbiddenError(
                "Only SUPER_ADMIN can create ADMIN accounts"
            )

        # ====================================================
        # CHECK GOOGLE ID
        # ====================================================

        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE google_id = %s
            """,
            (google_id,),
        )

        existing_google = cursor.fetchone()

        if existing_google:
            raise ConflictError(
                "A user with this Google ID already exists"
            )

        # ====================================================
        # CHECK EMAIL
        # ====================================================

        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = %s
            """,
            (email,),
        )

        existing_email = cursor.fetchone()

        if existing_email:
            raise ConflictError(
                "A user with this email already exists"
            )

        # ====================================================
        # GET ADMIN ROLE
        # ====================================================

        cursor.execute(
            """
            SELECT id
            FROM roles
            WHERE name = 'ADMIN'
            LIMIT 1
            """
        )

        admin_role = cursor.fetchone()

        if not admin_role:
            raise NotFoundError(
                "ADMIN role does not exist"
            )

        # ====================================================
        # CREATE ADMIN
        # ====================================================

        cursor.execute(
            """
            INSERT INTO users (
                google_id,
                email,
                full_name,
                role_id,
                profile_completed,
                verification_status,
                is_active,
                is_super_admin
            )

            VALUES (
                %s,
                %s,
                %s,
                %s,
                TRUE,
                'NOT_REQUIRED',
                TRUE,
                FALSE
            )
            """,
            (
                google_id,
                email,
                full_name,
                admin_role["id"],
            ),
        )

        admin_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Admin created successfully",
            "admin_id": admin_id,
            "email": email,
            "role": "ADMIN",
            "is_active": True,
            "is_super_admin": False,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def get_admins():

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                u.id,
                u.google_id,
                u.email,
                u.full_name,
                r.name AS role,
                u.is_active,
                u.is_super_admin,
                u.created_at,
                u.updated_at

            FROM users u

            INNER JOIN roles r
                ON u.role_id = r.id

            WHERE r.name = 'ADMIN'

            ORDER BY u.created_at DESC
            """
        )

        return cursor.fetchall()

    finally:
        connection.close()


def update_admin_status(
    super_admin_id,
    admin_id,
    is_active,
):

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # VERIFY REQUESTING SUPER ADMIN
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.is_active,
                u.is_super_admin,
                r.name AS role

            FROM users u

            INNER JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s
            """,
            (super_admin_id,),
        )

        requester = cursor.fetchone()

        if not requester:
            raise NotFoundError(
                "Requesting user not found"
            )

        if not bool(requester["is_active"]):
            raise ForbiddenError(
                "SUPER_ADMIN account is inactive"
            )

        # IMPORTANT:
        # MySQL TINYINT(1) => 1/0.
        is_super_admin = bool(
            requester["is_super_admin"]
        )

        if (
            requester["role"] != "SUPER_ADMIN"
            or not is_super_admin
        ):
            raise ForbiddenError(
                "Only SUPER_ADMIN can manage admins"
            )

        # ====================================================
        # FIND TARGET ADMIN
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.email,
                u.is_active,
                u.is_super_admin,
                r.name AS role

            FROM users u

            INNER JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s
            """,
            (admin_id,),
        )

        admin = cursor.fetchone()

        if not admin:
            raise NotFoundError(
                "Admin not found"
            )

        # ====================================================
        # TARGET MUST BE ADMIN
        # ====================================================

        if admin["role"] != "ADMIN":
            raise BadRequestError(
                "Selected user is not an ADMIN"
            )

        # ====================================================
        # NEVER MODIFY SUPER ADMIN
        # ====================================================

        if bool(admin["is_super_admin"]):
            raise ForbiddenError(
                "SUPER_ADMIN cannot be deactivated"
            )

        # ====================================================
        # UPDATE STATUS
        # ====================================================

        cursor.execute(
            """
            UPDATE users

            SET
                is_active = %s

            WHERE id = %s
              AND is_super_admin = FALSE
            """,
            (
                is_active,
                admin_id,
            ),
        )

        if cursor.rowcount != 1:
            raise ConflictError(
                "Admin status was not changed"
            )

        connection.commit()

        return {
            "message": (
                "Admin activated successfully"
                if is_active
                else "Admin deactivated successfully"
            ),
            "admin_id": admin_id,
            "is_active": is_active,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()
        
# APPEND these functions to app/services/admin_service.py



def get_pending_admin_requests():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT av.id AS verification_id, av.user_id, av.admin_profile_id,
                   av.status AS verification_status, av.remarks, av.submitted_at,
                   u.email, u.full_name, u.is_active, u.profile_completed,
                   ap.phone, ap.admin_id, ap.department, ap.designation,
                   ap.office_information, ap.responsibilities, ap.profile_photo_url,
                   i.id AS institution_id, i.name AS institution_name,
                   i.university_code AS institution_code
            FROM admin_verifications av
            INNER JOIN users u ON av.user_id = u.id
            INNER JOIN admin_profiles ap ON av.admin_profile_id = ap.id
            INNER JOIN institutions i ON ap.institution_id = i.id
            WHERE av.status = 'PENDING'
            ORDER BY av.submitted_at ASC
        """)
        return cursor.fetchall()
    finally:
        connection.close()


def verify_admin_request(super_admin_id, user_id, status, remarks):
    status = status.upper()
    if status not in ('VERIFIED', 'REJECTED'):
        raise BadRequestError('Status must be VERIFIED or REJECTED')

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT u.id, u.is_active, u.is_super_admin, r.name AS role
            FROM users u LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = %s LIMIT 1
        """, (super_admin_id,))
        requester = cursor.fetchone()
        if not requester:
            raise NotFoundError('Requesting user not found')
        if not bool(requester['is_active']):
            raise ForbiddenError('SUPER_ADMIN account is inactive')
        if requester['role'] != 'SUPER_ADMIN' or not bool(requester['is_super_admin']):
            raise ForbiddenError('Only SUPER_ADMIN can verify Admin applications')

        cursor.execute("""
            SELECT av.id, av.status, u.is_active
            FROM admin_verifications av
            INNER JOIN users u ON av.user_id = u.id
            WHERE av.user_id = %s LIMIT 1
        """, (user_id,))
        application = cursor.fetchone()
        if not application:
            raise NotFoundError('Admin application not found')
        if not bool(application['is_active']):
            raise ForbiddenError('Applicant account is inactive')
        if application['status'] != 'PENDING':
            raise ConflictError('Admin application is no longer pending')

        cursor.execute("SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1")
        admin_role = cursor.fetchone()
        if not admin_role:
            raise NotFoundError('ADMIN role does not exist')

        cursor.execute("""
            UPDATE admin_verifications
            SET status=%s, remarks=%s, verified_by=%s, verified_at=CURRENT_TIMESTAMP
            WHERE user_id=%s AND status='PENDING'
        """, (status, remarks.strip(), super_admin_id, user_id))
        if cursor.rowcount != 1:
            raise ConflictError('Admin application was already processed')

        if status == 'VERIFIED':
            cursor.execute("""
                UPDATE users SET role_id=%s, profile_completed=TRUE,
                verification_status='VERIFIED'
                WHERE id=%s AND is_super_admin=FALSE
            """, (admin_role['id'], user_id))
            if cursor.rowcount != 1:
                raise ConflictError('ADMIN role could not be assigned')
            message = 'Admin application approved successfully'
        else:
            cursor.execute("""
                UPDATE users SET role_id=NULL, profile_completed=TRUE,
                verification_status='REJECTED'
                WHERE id=%s AND is_super_admin=FALSE
            """, (user_id,))
            message = 'Admin application rejected successfully'

        connection.commit()
        return {'message': message, 'user_id': user_id, 'status': status, 'remarks': remarks.strip()}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


# ============================================================
# ADMIN USERS — INSTITUTION SCOPED
# Append this section to app/services/admin_service.py
# ============================================================

def _get_admin_institution_id(cursor, admin_user_id):
    cursor.execute(
        """
        SELECT
            ap.institution_id
        FROM admin_profiles ap
        INNER JOIN users u
            ON ap.user_id = u.id
        INNER JOIN roles r
            ON u.role_id = r.id
        WHERE ap.user_id = %s
          AND r.name = 'ADMIN'
          AND u.is_super_admin = FALSE
          AND u.is_active = TRUE
        LIMIT 1
        """,
        (admin_user_id,),
    )

    admin = cursor.fetchone()

    if not admin:
        raise ForbiddenError(
            "Admin profile or institution could not be resolved"
        )

    return admin["institution_id"]


def get_institution_users(
    admin_user_id,
    search=None,
    role=None,
    status=None,
    page=1,
    limit=20,
):
    """
    Return users belonging to the logged-in Admin's institution.

    The institution is resolved from admin_profiles rather than
    accepting an institution_id from the frontend.
    """

    page = max(int(page), 1)
    limit = min(max(int(limit), 1), 100)
    offset = (page - 1) * limit

    allowed_roles = {"STUDENT", "PROFESSOR", "ADMIN"}

    normalized_role = role.strip().upper() if role else None

    if normalized_role and normalized_role not in allowed_roles:
        raise BadRequestError(
            "Role must be STUDENT, PROFESSOR, or ADMIN"
        )

    normalized_status = status.strip().upper() if status else None

    if normalized_status and normalized_status not in {
        "ACTIVE",
        "INACTIVE",
    }:
        raise BadRequestError(
            "Status must be ACTIVE or INACTIVE"
        )

    search_value = search.strip() if search else ""

    connection = get_connection()

    try:
        cursor = connection.cursor()

        institution_id = _get_admin_institution_id(
            cursor,
            admin_user_id,
        )

        conditions = [
            """
            COALESCE(
                sp.institution_id,
                pp.institution_id,
                ap.institution_id
            ) = %s
            """
        ]

        params = [institution_id]

        if normalized_role:
            conditions.append("r.name = %s")
            params.append(normalized_role)
        else:
            # A Users page should not expose Super Admin accounts.
            conditions.append("r.name IN ('STUDENT','PROFESSOR','ADMIN')")

        if normalized_status == "ACTIVE":
            conditions.append("u.is_active = TRUE")
        elif normalized_status == "INACTIVE":
            conditions.append("u.is_active = FALSE")

        if search_value:
            like = f"%{search_value}%"
            conditions.append(
                """
                (
                    u.full_name LIKE %s
                    OR u.email LIKE %s
                    OR COALESCE(sp.student_id, '') LIKE %s
                    OR COALESCE(sp.enrollment_number, '') LIKE %s
                    OR COALESCE(pp.employee_id, '') LIKE %s
                    OR COALESCE(ap.admin_id, '') LIKE %s
                    OR COALESCE(pp.department, '') LIKE %s
                )
                """
            )
            params.extend(
                [
                    like,
                    like,
                    like,
                    like,
                    like,
                    like,
                    like,
                ]
            )

        where_clause = " AND ".join(conditions)

        cursor.execute(
            f"""
            SELECT
                COUNT(*) AS total
            FROM users u
            INNER JOIN roles r
                ON u.role_id = r.id
            LEFT JOIN student_profiles sp
                ON sp.user_id = u.id
            LEFT JOIN professor_profiles pp
                ON pp.user_id = u.id
            LEFT JOIN admin_profiles ap
                ON ap.user_id = u.id
            WHERE {where_clause}
            """,
            tuple(params),
        )

        total_row = cursor.fetchone()
        total = int(total_row["total"] or 0)

        cursor.execute(
            f"""
            SELECT
                u.id AS user_id,
                u.full_name,
                u.email,
                u.is_active,
                u.profile_completed,
                u.verification_status,
                u.created_at,

                r.name AS role,

                COALESCE(
                    sp.institution_id,
                    pp.institution_id,
                    ap.institution_id
                ) AS institution_id,

                sp.student_id,
                sp.enrollment_number,
                sp.program_id,
                sp.section_id,
                sp.current_year,
                sp.semester,

                pp.id AS professor_id,
                pp.employee_id,
                pp.department AS professor_department,
                pp.designation AS professor_designation,

                ap.id AS admin_profile_id,
                ap.admin_id,
                ap.department AS admin_department,
                ap.designation AS admin_designation

            FROM users u

            INNER JOIN roles r
                ON u.role_id = r.id

            LEFT JOIN student_profiles sp
                ON sp.user_id = u.id

            LEFT JOIN professor_profiles pp
                ON pp.user_id = u.id

            LEFT JOIN admin_profiles ap
                ON ap.user_id = u.id

            WHERE {where_clause}

            ORDER BY
                u.full_name ASC,
                u.id ASC

            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )

        users = cursor.fetchall()

        return {
            "users": users,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (
                    (total + limit - 1) // limit
                    if total
                    else 0
                ),
            },
            "institution_id": institution_id,
        }

    finally:
        connection.close()