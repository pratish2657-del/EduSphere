import uuid
from pathlib import Path
from typing import Annotated

import anyio
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
)

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.middleware.auth_guard import (
    get_current_user,
    require_student,
)
from app.schemas.student import (
    StudentProfileCreate,
    StudentProfileUpdate,
)
from app.services.student_service import (
    create_student_profile,
    get_student_profile,
    update_student_profile,
)

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


# ============================================================
# PROFILE PHOTO STORAGE
# ============================================================

UPLOAD_DIR = Path("uploads/profile_photos")

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


# ============================================================
# CREATE STUDENT PROFILE
#
# POST /profile/student
# ============================================================


@router.post("/student")
async def create_student(
    request: Request,
    data: StudentProfileCreate,
):
    user = get_current_user(request)

    # --------------------------------------------------------
    # Only STUDENT / USER can create a student profile.
    # --------------------------------------------------------

    if user["role"] not in [
        "STUDENT",
        "USER",
        None,
    ]:
        raise HTTPException(
            status_code=403,
            detail="Student access required",
        )

    try:
        result = create_student_profile(
            user["id"],
            data,
        )

        return result

    except ConflictError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to create student profile",
        ) from error


# ============================================================
# UPDATE STUDENT PROFILE
#
# PUT /profile/student
# ============================================================


@router.put("/student")
async def update_student(
    request: Request,
    data: StudentProfileUpdate,
):
    user = require_student(request)

    try:
        result = update_student_profile(
            user["id"],
            data,
        )

        return result

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        ) from error

    except ConflictError as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to update student profile",
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to update student profile",
        ) from error


# ============================================================
# GET STUDENT PROFILE
#
# GET /profile/student
# ============================================================


@router.get("/student")
async def get_student(
    request: Request,
):
    user = require_student(request)

    try:
        student = get_student_profile(
            user["id"],
        )

        return student

    except NotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        ) from error

    except ForbiddenError as error:
        raise HTTPException(
            status_code=403,
            detail=str(error),
        ) from error

    except UnauthorizedError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve student profile",
        ) from error


# ============================================================
# ADMIN PROFILE PHOTO UPLOAD
#
# POST /profile/admin/photo
# ============================================================


@router.post("/admin/photo")
async def upload_admin_profile_photo(
    file: Annotated[
        UploadFile,
        File(...),
    ],
    current_user: Annotated[
        object,
        Depends(get_current_user),
    ],
):
    """
    Upload an Admin profile photo.

    Accepted:
    - JPG / JPEG
    - PNG
    - WEBP

    Maximum size:
    - 5 MB
    """

    # --------------------------------------------------------
    # CHECK FILE TYPE
    # --------------------------------------------------------

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG and WEBP "
                "images are allowed."
            ),
        )

    # --------------------------------------------------------
    # READ FILE
    # --------------------------------------------------------

    contents = await file.read()

    # --------------------------------------------------------
    # CHECK FILE SIZE
    # --------------------------------------------------------

    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                "Image size must be "
                "5 MB or less."
            ),
        )

    # --------------------------------------------------------
    # GENERATE UNIQUE FILE NAME
    # --------------------------------------------------------

    extension = ALLOWED_IMAGE_TYPES[
        file.content_type
    ]

    filename = (
        f"{uuid.uuid4().hex}"
        f"{extension}"
    )

    file_path = (
        UPLOAD_DIR / filename
    )

    # --------------------------------------------------------
    # SAVE FILE WITHOUT BLOCKING EVENT LOOP
    # --------------------------------------------------------

    await anyio.to_thread.run_sync(
        file_path.write_bytes,
        contents,
    )

    # --------------------------------------------------------
    # DATABASE / PUBLIC URL
    # --------------------------------------------------------

    image_url = (
        f"/uploads/profile_photos/{filename}"
    )

    return {
        "success": True,
        "message": (
            "Profile photo uploaded "
            "successfully."
        ),
        "profile_photo_url": image_url,
        "filename": filename,
    }