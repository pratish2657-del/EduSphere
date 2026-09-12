import os
import uuid

import anyio
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.middleware.auth_guard import require_completed_profile
from app.schemas.result import ResultCreate, ResultUpdate
from app.services.result_service import (
    add_result_attachment,
    create_result,
    delete_result,
    delete_result_attachment,
    get_result,
    get_result_attachment,
    get_result_management_results,
    get_student_results,
    update_result,
)

router = APIRouter(
    prefix="/results",
    tags=["Results"],
)


# ============================================================
# RUFF / FASTAPI
# ============================================================

# B008:
# Keep File(...) at module level instead of using it directly
# inside the function argument defaults.

UPLOAD_FILE = File(...)


# ============================================================
# STUDENT — VIEW OWN RESULTS
# ============================================================


@router.get("/")
async def list_results(request: Request):

    user = require_completed_profile(request)

    try:
        # ----------------------------------------------------
        # Student gets ONLY their own results
        # ----------------------------------------------------

        if user["role"] == "STUDENT":
            return get_student_results(
                user_id=user["id"]
            )

        # ----------------------------------------------------
        # Other roles cannot use this endpoint to access
        # arbitrary student results.
        # ----------------------------------------------------

        raise HTTPException(
            status_code=403,
            detail="Student access required",
        )

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error



# ============================================================
# PROFESSOR / ADMIN / SUPER_ADMIN — RESULT MANAGEMENT LIST
# ============================================================

@router.get("/manage")
async def manage_results(
    request: Request,
    enrollment_number: str | None = None,
    subject_code: str | None = None,
    academic_year: str | None = None,
    semester: int | None = None,
):
    user = require_professor_or_admin(request)

    try:
        return get_result_management_results(
            user_id=user["id"],
            role=user["role"],
            enrollment_number=enrollment_number,
            subject_code=subject_code,
            academic_year=academic_year,
            semester=semester,
        )
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# UPLOAD RESULT ATTACHMENT
#
# PROFESSOR / ADMIN / SUPER_ADMIN
#
# POST /results/{result_id}/attachments
# ============================================================


@router.post("/{result_id}/attachments")
async def upload_result_attachment(
    result_id: int,
    request: Request,
    file: UploadFile = UPLOAD_FILE,
):

    user = require_professor_or_admin(request)

    file_path = None

    try:
        # ----------------------------------------------------
        # Allowed file types
        # ----------------------------------------------------

        allowed_types = {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
        }

        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="File type is not allowed",
            )

        # ----------------------------------------------------
        # Validate filename
        # ----------------------------------------------------

        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Filename is required",
            )

        # ----------------------------------------------------
        # Read uploaded file
        # ----------------------------------------------------

        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="File cannot be empty",
            )

        # ----------------------------------------------------
        # Maximum 10 MB
        # ----------------------------------------------------

        max_size = 10 * 1024 * 1024

        if len(contents) > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size cannot exceed 10 MB",
            )

        # ----------------------------------------------------
        # Upload directory
        # ----------------------------------------------------

        upload_directory = os.path.join(
            "uploads",
            "results",
        )

        os.makedirs(
            upload_directory,
            exist_ok=True,
        )

        # ----------------------------------------------------
        # Preserve extension only
        # ----------------------------------------------------

        extension = ""

        if "." in file.filename:
            extension = os.path.splitext(
                file.filename
            )[1].lower()

        # ----------------------------------------------------
        # Generate random stored filename
        # ----------------------------------------------------

        stored_name = (
            f"{uuid.uuid4().hex}{extension}"
        )

        file_path = os.path.join(
            upload_directory,
            stored_name,
        )

        # ----------------------------------------------------
        # Save file without blocking the async event loop
        # ----------------------------------------------------

        def save_file():
            with open(file_path, "wb") as output_file:
                output_file.write(contents)

        await anyio.to_thread.run_sync(save_file)

        # ----------------------------------------------------
        # Save database record
        # ----------------------------------------------------

        try:
            result = add_result_attachment(
                result_id=result_id,
                user_id=user["id"],
                role=user["role"],
                file_name=file.filename,
                file_path=file_path,
                file_type=file.content_type,
                file_size=len(contents),
            )

            return result

        except Exception:
            # ------------------------------------------------
            # Database failed.
            # Remove uploaded file.
            # ------------------------------------------------

            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass

            raise

    except HTTPException:
        # ----------------------------------------------------
        # Remove file if it was already created.
        # ----------------------------------------------------

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise

    except Exception as error:
        # ----------------------------------------------------
        # Unexpected error.
        # ----------------------------------------------------

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# VIEW / DOWNLOAD RESULT ATTACHMENT
#
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
#
# GET /results/attachments/{attachment_id}
# ============================================================


@router.get("/attachments/{attachment_id}")
async def get_result_attachment_route(
    attachment_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        attachment = get_result_attachment(
            attachment_id=attachment_id,
            user_id=user["id"],
            role=user["role"],
        )

        file_path = attachment["file_path"]

        # ----------------------------------------------------
        # Check physical file
        # ----------------------------------------------------

        if not file_path or not os.path.isfile(file_path):
            raise HTTPException(
                status_code=404,
                detail="File not found on server",
            )

        # ----------------------------------------------------
        # Return file
        # ----------------------------------------------------

        return FileResponse(
            path=file_path,
            media_type=(
                attachment["file_type"]
                or "application/octet-stream"
            ),
            filename=attachment["file_name"],
        )

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


# ============================================================
# DELETE RESULT ATTACHMENT
#
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.delete("/attachments/{attachment_id}")
async def delete_result_attachment_route(
    attachment_id: int,
    request: Request,
):

    user = require_professor_or_admin(request)

    try:
        result = delete_result_attachment(
            attachment_id=attachment_id,
            user_id=user["id"],
            role=user["role"],
        )

        # ----------------------------------------------------
        # Delete physical file
        # ----------------------------------------------------

        file_path = result.get("file_path")

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                # Database deletion already succeeded.
                pass

        # ----------------------------------------------------
        # Never expose internal filesystem path
        # ----------------------------------------------------

        result.pop(
            "file_path",
            None,
        )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# VIEW SINGLE RESULT
#
# STUDENT / PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.get("/{result_id}")
async def result_details(
    result_id: int,
    request: Request,
):

    user = require_completed_profile(request)

    try:
        return get_result(
            result_id=result_id,
            user_id=user["id"],
            role=user["role"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


# ============================================================
# CREATE RESULT
#
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.post("/")
async def create_result_route(
    request: Request,
    data: ResultCreate,
):

    user = require_professor_or_admin(request)

    try:
        return create_result(
            user_id=user["id"],
            role=user["role"],
            data=data,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# UPDATE RESULT
#
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.put("/{result_id}")
async def update_result_route(
    result_id: int,
    request: Request,
    data: ResultUpdate,
):

    user = require_professor_or_admin(request)

    try:
        return update_result(
            result_id=result_id,
            user_id=user["id"],
            role=user["role"],
            data=data,
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# DELETE RESULT
#
# PROFESSOR / ADMIN / SUPER_ADMIN
# ============================================================


@router.delete("/{result_id}")
async def delete_result_route(
    result_id: int,
    request: Request,
):

    user = require_professor_or_admin(request)

    try:
        return delete_result(
            result_id=result_id,
            user_id=user["id"],
            role=user["role"],
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


# ============================================================
# PROFESSOR / ADMIN / SUPER_ADMIN HELPER
# ============================================================


def require_professor_or_admin(request: Request):

    user = require_completed_profile(request)

    # --------------------------------------------------------
    # PROFESSOR
    # --------------------------------------------------------

    if user["role"] == "PROFESSOR":
        return user

    # --------------------------------------------------------
    # ADMIN
    # --------------------------------------------------------

    if user["role"] == "ADMIN":
        return user

    # --------------------------------------------------------
    # SUPER ADMIN
    # --------------------------------------------------------

    if (
        user["role"] == "SUPER_ADMIN"
        and user["is_super_admin"] is True
    ):
        return user

    # --------------------------------------------------------
    # Deny everything else
    # --------------------------------------------------------

    raise HTTPException(
        status_code=403,
        detail="Professor or Admin access required",
    )