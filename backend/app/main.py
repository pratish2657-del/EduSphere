import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

# ============================================================
# SESSION SECRET
# ============================================================

SESSION_SECRET = os.getenv("SESSION_SECRET")

if not SESSION_SECRET:
    raise RuntimeError("SESSION_SECRET is missing from backend/.env")

# ============================================================
# CREATE FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="EduSphere API",
    description="EduSphere Academic Platform",
    version="1.0.0",
)

# ============================================================
# SESSION SECURITY
# ============================================================

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=False,
    session_cookie="edusphere_session",
)

# ============================================================
# CORS
# ============================================================

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://edusphere-rho-sable.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# UPLOAD DIRECTORIES
# ============================================================

os.makedirs("uploads", exist_ok=True)

PRIVATE_MARKETPLACE_UPLOAD_DIRECTORY = os.path.join(
    "private_uploads",
    "marketplace",
)

os.makedirs(
    PRIVATE_MARKETPLACE_UPLOAD_DIRECTORY,
    exist_ok=True,
)

# ============================================================
# IMPORT ROUTERS
#
# IMPORTANT:
# Import the actual APIRouter objects.
# ============================================================

from app.routes import admin_events, admin_marketplace_management, marketplace_route
from app.routes.admin import router as admin_router
from app.routes.admin_profile import router as admin_profile_router
from app.routes.ai import router as ai_router
from app.routes.attendance import router as attendance_router
from app.routes.auth import router as auth_router
from app.routes.course import router as course_router
from app.routes.dashboard import router as dashboard_router
from app.routes.developer_library import router as developer_library_router
from app.routes.developer_profile import router as developer_profile_router
from app.routes.developer_verification import router as developer_verification_router
from app.routes.developer_workspace import router as developer_workspace_router
from app.routes.event import router as event_router
from app.routes.institution import router as institution_router
from app.routes.library import router as library_router
from app.routes.marketplace import router as marketplace_router
from app.routes.marketplace_payment import (
    router as marketplace_payment_router,
)
from app.routes.marketplace_seller import router as marketplace_seller_router
from app.routes.professor import router as professor_router
from app.routes.professor_dashboard import (
    router as professor_dashboard_router,
)
from app.routes.professor_students import (
    router as professor_students_router,
)
from app.routes.professor_verification import (
    router as professor_verification_router,
)
from app.routes.profile import router as profile_router
from app.routes.program import router as program_router
from app.routes.protected import router as protected_router
from app.routes.result import router as result_router
from app.routes.section import router as section_router
from app.routes.student import router as student_router
from app.routes.student_profile_options import router as student_profile_options_router
from app.routes.super_admin_activity import router as super_admin_activity_router
from app.routes.super_admin_courses import router as super_admin_courses_router
from app.routes.super_admin_dashboard_summary import (
    router as super_admin_dashboard_summary_router,
)
from app.routes.super_admin_library import router as super_admin_library_router
from app.routes.super_admin_marketplace import (
    router as super_admin_marketplace_router,
)
from app.routes.super_admin_marketplace_shared import (
    router as super_admin_marketplace_shared_router,
)
from app.routes.timetable import router as timetable_router
from app.routes.users import router as users_router

# ============================================================
# REGISTER ROUTERS
# ============================================================

app.include_router(auth_router)
app.include_router(users_router)

# Student profile endpoints:
#
# POST /profile/student
# PUT  /profile/student
# GET  /profile/student
#
app.include_router(profile_router)
app.include_router(admin_profile_router)
app.include_router(
    student_profile_options_router
)
app.include_router(protected_router)
app.include_router(dashboard_router)
app.include_router(ai_router)
app.include_router(timetable_router)
app.include_router(marketplace_router)
app.include_router(marketplace_payment_router)
app.include_router(marketplace_seller_router)
app.include_router(marketplace_route.router)
app.include_router(professor_router)
app.include_router(professor_dashboard_router)
app.include_router(professor_verification_router)
app.include_router(developer_profile_router)
app.include_router(developer_workspace_router)
app.include_router(developer_verification_router)
app.include_router(developer_library_router)
app.include_router(admin_router)
app.include_router(student_router)
app.include_router(course_router)
app.include_router(event_router)
app.include_router(result_router)
app.include_router(attendance_router)
app.include_router(program_router)
app.include_router(section_router)
app.include_router(
    professor_students_router
)
app.include_router(
    admin_events.router,
)
app.include_router(
    admin_marketplace_management.router,
)
app.include_router(
    institution_router,
)
app.include_router(library_router)
app.include_router(super_admin_library_router)
app.include_router(
    super_admin_courses_router,
)
app.include_router(
    super_admin_activity_router,
)
app.include_router(
    super_admin_dashboard_summary_router,
)
app.include_router(
    super_admin_marketplace_router,
)
app.include_router(
    super_admin_marketplace_shared_router,
)

# ============================================================
# PUBLIC UPLOADS
# ============================================================
Path("uploads/profile_photos").mkdir(
    parents=True,
    exist_ok=True,
)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)

# ============================================================
# ROOT
# ============================================================


@app.get("/")
def home():
    return {
        "message": "EduSphere API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# ============================================================
# DEBUG ROUTE REGISTRATION
#
# This is intentionally placed after all routers.
# ============================================================

logger.info("Registered API routes:")

for route in app.routes:
    path = getattr(route, "path", None)
    methods = getattr(route, "methods", None)

    if path:
        logger.info(
            "%s %s",
            ",".join(sorted(methods or [])),
            path,
        )