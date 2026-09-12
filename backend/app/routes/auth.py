import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from starlette.responses import RedirectResponse

from app.auth.google import oauth
from app.database import get_connection
from app.middleware.auth_guard import get_current_user

load_dotenv()


router = APIRouter(prefix="/auth", tags=["Authentication"])

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173",
)


# ============================================================
# GOOGLE LOGIN
# ============================================================


@router.get("/google")
async def google_login(request: Request):
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/auth/google/callback",
    )

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
    )


# ============================================================
# GOOGLE CALLBACK
# ============================================================


@router.get("/google/callback")
async def google_callback(request: Request):

    # ========================================================
    # GET GOOGLE OAUTH TOKEN
    # ========================================================

    try:
        token = await oauth.google.authorize_access_token(request)

    except Exception as error:
        print("GOOGLE OAUTH ERROR:", repr(error))

        raise HTTPException(
            status_code=401,
            detail="Unable to authenticate with Google",
        ) from error

    # ========================================================
    # GET GOOGLE USER INFORMATION
    # ========================================================

    user_info = token.get("userinfo")

    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="Unable to retrieve Google user information",
        )

    google_id = user_info.get("sub")
    email = user_info.get("email")
    full_name = user_info.get("name")
    email_verified = user_info.get("email_verified", False)

    # ========================================================
    # GOOGLE EMAIL MUST BE VERIFIED
    # ========================================================

    if not email_verified:
        raise HTTPException(
            status_code=403,
            detail="Google email must be verified",
        )

    # ========================================================
    # VALIDATE GOOGLE ACCOUNT INFORMATION
    # ========================================================

    if not google_id or not email:
        raise HTTPException(
            status_code=400,
            detail="Google account information is incomplete",
        )

    # ========================================================
    # NORMALIZE EMAIL
    # ========================================================

    email = email.lower().strip()

    # ========================================================
    # SUPER ADMIN CONFIGURATION
    # ========================================================

    super_admin_email = os.getenv("SUPER_ADMIN_EMAIL")

    if not super_admin_email:
        raise HTTPException(
            status_code=500,
            detail="SUPER_ADMIN_EMAIL is not configured",
        )

    super_admin_email = super_admin_email.lower().strip()

    is_super_admin_account = email == super_admin_email

    # ========================================================
    # DATABASE CONNECTION
    # ========================================================

    connection = get_connection()

    try:
        cursor = connection.cursor()

        # ====================================================
        # FIND EXISTING USER
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.google_id,
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

            WHERE u.google_id = %s

            LIMIT 1
            """,
            (google_id,),
        )

        user = cursor.fetchone()

        # ====================================================
        # NEW USER
        # ====================================================

        if not user:

            # ------------------------------------------------
            # Determine role
            # ------------------------------------------------

            if is_super_admin_account:

                cursor.execute(
                    """
                    SELECT
                        id

                    FROM roles

                    WHERE name = %s

                    LIMIT 1
                    """,
                    ("SUPER_ADMIN",),
                )

                super_admin_role = cursor.fetchone()

                if not super_admin_role:
                    raise HTTPException(
                        status_code=500,
                        detail="SUPER_ADMIN role does not exist",
                    )

                role_id = super_admin_role["id"]

            else:

                # New normal Google users have no role until
                # they complete the mandatory profile.
                role_id = None

            # ------------------------------------------------
            # Create user
            # ------------------------------------------------

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
                    %s,
                    'NOT_REQUIRED',
                    TRUE,
                    %s
                )
                """,
                (
                    google_id,
                    email,
                    full_name,
                    role_id,
                    is_super_admin_account,
                    is_super_admin_account
                ),
            )

            user_id = cursor.lastrowid

            connection.commit()

        # ====================================================
        # EXISTING USER
        # ====================================================

        else:

            user_id = user["id"]

            # ------------------------------------------------
            # SUPER ADMIN ACCOUNT
            # ------------------------------------------------

            if is_super_admin_account:

                # --------------------------------------------
                # Find SUPER_ADMIN role
                # --------------------------------------------

                cursor.execute(
                    """
                    SELECT
                        id

                    FROM roles

                    WHERE name = %s

                    LIMIT 1
                    """,
                    ("SUPER_ADMIN",),
                )

                super_admin_role = cursor.fetchone()

                if not super_admin_role:
                    raise HTTPException(
                        status_code=500,
                        detail="SUPER_ADMIN role does not exist",
                    )

                # --------------------------------------------
                # Enforce Super Admin privileges
                #
                # Do NOT check cursor.rowcount here.
                #
                # MySQL may return rowcount = 0 when the
                # account already contains these values.
                # --------------------------------------------

                cursor.execute(
                    """
                    UPDATE users

                    SET
                        role_id = %s,
                        verification_status = 'NOT_REQUIRED',
                        is_super_admin = TRUE

                    WHERE id = %s
                    """,
                    (
                        super_admin_role["id"],
                        user_id,
                    ),
                )

                connection.commit()

            # ------------------------------------------------
            # NORMAL ACCOUNT
            # ------------------------------------------------

            else:

                # Ordinary accounts must never remain marked
                # as Super Admin.

                cursor.execute(
                    """
                    UPDATE users

                    SET
                        is_super_admin = FALSE

                    WHERE id = %s

                      AND email <> %s
                    """,
                    (
                        user_id,
                        super_admin_email,
                    ),
                )

                connection.commit()

        # ====================================================
        # GET FINAL USER INFORMATION
        # ====================================================

        cursor.execute(
            """
            SELECT
                u.id,
                u.google_id,
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
                status_code=500,
                detail="Unable to retrieve authenticated user",
            )

        # ====================================================
        # ACCOUNT STATUS
        # ====================================================

        if not user["is_active"]:

            raise HTTPException(
                status_code=403,
                detail="Your EduSphere account is inactive",
            )

        # ====================================================
        # VERIFY SUPER ADMIN STATE
        # ====================================================

        if is_super_admin_account:

            if user["role"] != "SUPER_ADMIN":
                raise HTTPException(
                    status_code=500,
                    detail="Super Admin role could not be assigned",
                )

            if not bool(user["is_super_admin"]):
                raise HTTPException(
                    status_code=500,
                    detail="Super Admin privileges could not be assigned",
                )

        # ====================================================
        # STORE AUTHENTICATED USER IN SESSION
        # ====================================================

        request.session["user_id"] = user["id"]

        request.session["role"] = user["role"]

        request.session["is_super_admin"] = bool(
            user["is_super_admin"]
        )

        # ====================================================
        # MANDATORY PROFILE
        # ====================================================

        # ========================================================
        # REDIRECT BACK TO REACT APPLICATION
        # ========================================================

        next_step = (
              "DASHBOARD"
               if bool(user["profile_completed"])
               else "MANDATORY_PROFILE"
       )

        return RedirectResponse(
                 url=(
                 f"{FRONTEND_URL}/auth/callback"
                 f"?next={next_step}"
            ),
            status_code=302,
     )

    # ========================================================
    # EXPECTED HTTP ERRORS
    # ========================================================

    except HTTPException:

        connection.rollback()

        raise

    # ========================================================
    # UNEXPECTED DATABASE ERROR
    # ========================================================

    except Exception as error:

        connection.rollback()

        print(
            "AUTHENTICATION DATABASE ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail="Authentication service encountered an internal error",
        ) from error

    # ========================================================
    # CLOSE DATABASE CONNECTION
    # ========================================================

    finally:

        connection.close()
        
# ============================================================
# CURRENT AUTHENTICATED USER
# ============================================================


@router.get("/me")
async def current_user(request: Request):

    user = get_current_user(request)
    next_step = (
        "DASHBOARD"
        if bool(user["profile_completed"])
        else "MANDATORY_PROFILE"
    )

    return {
        "user_id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "profile_completed": bool(
            user["profile_completed"]
        ),
        "verification_status": user[
            "verification_status"
        ],
        "is_active": bool(
            user["is_active"]
        ),
        "is_super_admin": bool(
            user["is_super_admin"]
        ),
        "next_step": next_step,
    }
    
# ============================================================
# LOGOUT
# ============================================================


@router.post("/logout")
async def logout(request: Request):

    request.session.clear()

    return {
        "message": "Logged out successfully"
    }
    