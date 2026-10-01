import logging
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.database import db
from app.schemas.complaint import CitizenNotification

router = APIRouter(prefix="/notifications", tags=["Citizen Notifications"])
logger = logging.getLogger(__name__)


@router.get("", response_model=List[CitizenNotification])
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    user: Dict = Depends(get_current_user)
):
    """
    Returns authentic lifecycle event notifications for the authenticated citizen.
    Derives citizen identity strictly from verified token.
    Never exposes other citizens' notifications.
    """
    try:
        citizen_id = user["id"]
        return await db.get_citizen_notifications(citizen_id, limit=limit)
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notifications."
        )


@router.patch("/{id}/read", response_model=dict)
async def mark_notification_read(
    id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Marks a single notification as read.
    Validates that the notification belongs to the calling citizen.
    """
    try:
        citizen_id = user["id"]
        success = await db.mark_notification_read(id, citizen_id)
        return {"status": "success", "id": id, "is_read": True}
    except Exception as e:
        logger.error(f"Error marking notification read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification."
        )


@router.post("/mark-all-read", response_model=dict)
async def mark_all_notifications_read(
    user: Dict = Depends(get_current_user)
):
    """
    Marks all unread notifications as read for the authenticated citizen.
    """
    try:
        citizen_id = user["id"]
        count = await db.mark_all_notifications_read(citizen_id)
        return {"status": "success", "marked_count": count}
    except Exception as e:
        logger.error(f"Error marking all notifications read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all notifications read."
        )
