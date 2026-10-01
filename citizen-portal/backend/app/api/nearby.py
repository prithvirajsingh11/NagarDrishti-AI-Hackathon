from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import db
from app.schemas.complaint import NearbyCivicIssue

router = APIRouter(prefix="/nearby", tags=["Civic Discovery"])


@router.get("/issues", response_model=List[NearbyCivicIssue])
async def get_nearby_issues(
    latitude: Optional[float] = Query(None, description="Optional center latitude for proximity search"),
    longitude: Optional[float] = Query(None, description="Optional center longitude for proximity search"),
    radius_km: float = Query(default=settings.NEARBY_DEFAULT_RADIUS_KM, ge=0.5, le=100.0, description="Search radius in kilometers"),
    category: Optional[str] = Query(None, description="Category filter (pothole, garbage, streetlight, drain, other, all)"),
    problem_type: Optional[str] = Query(None, description="Alias for category"),
    status: Optional[str] = Query(None, description="Status filter (REPORTED, IN_PROGRESS, RESOLVED, all)"),
    limit: int = Query(default=100, ge=1, le=500),
    user: Dict = Depends(get_current_user)
):
    """
    Nearby Civic Issues discovery endpoint.
    Returns real complaint data with privacy-preserving approximate coordinates (~110m).
    Strictly strips citizen identity, personal details, contact info, and private descriptions.
    Supports nationwide discovery with Bhopal as default initial center when location is unavailable.
    """
    effective_category = category or problem_type
    issues = await db.get_nearby_issues(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        problem_type=effective_category,
        status=status,
        limit=limit
    )
    return issues
