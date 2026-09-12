from fastapi import APIRouter

router = APIRouter(
    prefix="/student",
    tags=["Student"],
)


# ============================================================
# STUDENT-SPECIFIC ROUTES
# ============================================================
#
# Add future student-only endpoints here.
#
# IMPORTANT:
# Do NOT define:
#
#   /profile/student
#
# in this file.
#
# Those endpoints belong to app/routes/profile.py.
# ============================================================