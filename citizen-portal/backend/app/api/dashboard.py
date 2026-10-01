import logging
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import require_authority
from app.core.database import db
from app.schemas.complaint import DashboardStatistics, HeatmapPoint, HotspotInfo

router = APIRouter(prefix="/dashboard", tags=["Authority Dashboard"])
logger = logging.getLogger(__name__)

@router.get("/statistics", response_model=DashboardStatistics)
async def get_dashboard_statistics(user: Dict = Depends(require_authority)):
    """
    Returns high-level KPI cards, status distributions, and Hotspot Intelligence.
    Strictly restricted to authorized municipal officers.
    """
    try:
        stats = await db.get_dashboard_stats()
        return stats
    except Exception as e:
        logger.error(f"Error computing dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Could not compute dashboard statistics.")

@router.get("/heatmap", response_model=List[HeatmapPoint])
async def get_dashboard_heatmap(user: Dict = Depends(require_authority)):
    """
    Returns coordinate points with severity-weighted intensity for Leaflet heatmaps.
    Strictly restricted to authorized municipal officers.
    """
    try:
        points = await db.get_heatmap_points()
        return points
    except Exception as e:
        logger.error(f"Error generating heatmap points: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve heatmap points.")

@router.get("/hotspots", response_model=List[HotspotInfo])
async def get_dashboard_hotspots(user: Dict = Depends(require_authority)):
    """
    Returns list of civic problem hotspots with severity counts and recommendations.
    Strictly restricted to authorized municipal officers.
    """
    try:
        stats = await db.get_dashboard_stats()
        if isinstance(stats, dict):
            return stats.get("hotspots", [])
        return stats.hotspots
    except Exception as e:
        logger.error(f"Error retrieving hotspots: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve hotspots.")
