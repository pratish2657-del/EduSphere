from fastapi import APIRouter, HTTPException, Request

from app.middleware.auth_guard import require_admin
from app.schemas.event import EventPublish, EventUpdate
from app.services.admin_event_service import (
    delete_admin_event,
    list_admin_events,
    set_admin_event_published,
    update_admin_event,
)

router = APIRouter(
    prefix="/admin/events",
    tags=["Admin Events"],
)


@router.get("/")
async def admin_events(request: Request):
    user = require_admin(request)
    try:
        return list_admin_events(user["id"])
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve institution events",
        ) from error


@router.put("/{event_id}")
async def admin_update_event(
    event_id: int,
    request: Request,
    data: EventUpdate,
):
    user = require_admin(request)
    try:
        return update_admin_event(user["id"], event_id, data)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.delete("/{event_id}")
async def admin_delete_event(
    event_id: int,
    request: Request,
):
    user = require_admin(request)
    try:
        return delete_admin_event(user["id"], event_id)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.put("/{event_id}/publish")
async def admin_publish_event(
    event_id: int,
    request: Request,
    data: EventPublish,
):
    user = require_admin(request)
    try:
        return set_admin_event_published(
            user["id"],
            event_id,
            data.is_published,
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error
