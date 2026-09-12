from fastapi import HTTPException, Request

from app.database import get_connection

# ============================================================
# GET CURRENT AUTHENTICATED USER
# ============================================================


def get_current_user(request: Request):

    user_id = request.session.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="You must login with Google first",
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                u.id,
                u.email,
                u.full_name,
                u.role_id,
                r.name AS role,
                u.profile_completed,
                u.verification_status,
                u.is_active,
                u.is_super_admin

            FROM users u

            LEFT JOIN roles r
                ON u.role_id = r.id

            WHERE u.id = %s

            LIMIT 1
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User account not found",
            )

        # ----------------------------------------------------
        # Always check account status from database
        # ----------------------------------------------------

        if not bool(user["is_active"]):
            raise HTTPException(
                status_code=403,
                detail="Your account is inactive",
            )

        return user

    finally:
        connection.close()


# ============================================================
# REQUIRE COMPLETED PROFILE
# ============================================================


def require_completed_profile(request: Request):

    user = get_current_user(request)

    if not bool(user["profile_completed"]):
        raise HTTPException(
            status_code=403,
            detail="Complete your EduSphere profile to continue",
        )

    return user


# ============================================================
# REQUIRE SUPER ADMIN
# ============================================================


def require_super_admin(request: Request):

    user = get_current_user(request)

    # --------------------------------------------------------
    # MySQL BOOLEAN / TINYINT(1) values can be returned by
    # PyMySQL as integers:
    #
    #     1
    #     0
    #
    # Therefore use bool() instead of:
    #
    #     is True
    #
    # --------------------------------------------------------

    is_super_admin = bool(user["is_super_admin"])

    if user["role"] != "SUPER_ADMIN" or not is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="SUPER_ADMIN access required",
        )

    return user


# ============================================================
# REQUIRE ADMIN
# ============================================================


def require_admin(request: Request):

    user = get_current_user(request)

    is_super_admin = bool(user["is_super_admin"])

    # --------------------------------------------------------
    # SUPER_ADMIN has ADMIN privileges
    # --------------------------------------------------------

    if user["role"] == "SUPER_ADMIN" and is_super_admin:
        return user

    # --------------------------------------------------------
    # Normal ADMIN
    # --------------------------------------------------------

    if user["role"] == "ADMIN":
        return user

    raise HTTPException(
        status_code=403,
        detail="Admin access required",
    )


# ============================================================
# REQUIRE PROFESSOR
# ============================================================


def require_professor(request: Request):

    user = require_completed_profile(request)

    if user["role"] != "PROFESSOR":
        raise HTTPException(
            status_code=403,
            detail="Professor access required",
        )

    return user


# ============================================================
# REQUIRE STUDENT
# ============================================================


def require_student(request: Request):

    user = require_completed_profile(request)

    if user["role"] != "STUDENT":
        raise HTTPException(
            status_code=403,
            detail="Student access required",
        )

    return user