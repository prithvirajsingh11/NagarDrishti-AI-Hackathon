import logging
from typing import List
from fastapi import APIRouter, HTTPException

from app.core.database import db
from app.schemas.department import DepartmentResponse

router = APIRouter(prefix="/departments", tags=["Departments"])
logger = logging.getLogger(__name__)

@router.get("", response_model=List[DepartmentResponse])
async def list_departments():
    """
    List configured municipal departments from Supabase.
    """
    try:
        departments = await db.get_departments()
        return departments
    except Exception as e:
        logger.error(f"Error fetching departments: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve departments.")
