from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query, Depends
from ..models.schemas import (
    DashboardStatistics,
    HeatmapPoint,
    Complaint,
    AgingAnalysis,
    DepartmentPerformance,
    CategoryTrend,
    EscalationItem,
    StatusUpdateRequestItem,
    GovernanceOutcomes,
    TimeBasedAnalytics,
)
from ..services.store import data_store
from ..auth import require_authority

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/statistics", response_model=DashboardStatistics)
def get_dashboard_statistics():
    """Aggregate live metrics, category breakdowns, daily trends, priority actions, and spatial hotspots."""
    return data_store.get_statistics()


@router.get("/heatmap", response_model=List[HeatmapPoint])
def get_dashboard_heatmap():
    """Retrieve geo-weighted points for GIS canvas heatmap visualization."""
    return data_store.get_heatmap_points()


@router.get("/priority-actions", response_model=List[Complaint])
def get_priority_actions():
    """Retrieve top urgent unresolved complaints ranked by deterministic priority score."""
    return data_store.get_priority_actions()


@router.get("/aging", response_model=AgingAnalysis)
def get_aging_analysis():
    """Retrieve turnaround and complaint aging distribution across 0-24h, 1-3d, 3-7d, 7+d."""
    return data_store.get_aging_analysis()


@router.get("/departments", response_model=List[DepartmentPerformance])
def get_department_performance():
    """Retrieve department workloads, turnaround averages, and resolution rates."""
    return data_store.get_department_performance()


@router.get("/trends", response_model=List[CategoryTrend])
def get_category_trends():
    """Retrieve 7-day and 30-day velocity trends per civic defect category."""
    return data_store.get_category_trends()


@router.get("/governance-outcomes", response_model=GovernanceOutcomes)
def get_governance_outcomes():
    """Retrieve municipal governance outcome KPIs derived strictly from real complaint records."""
    return data_store.get_governance_outcomes()


@router.get("/time-analytics", response_model=TimeBasedAnalytics)
def get_time_analytics():
    """Retrieve time-based volume curves and response/resolution turnaround averages."""
    return data_store.get_time_analytics()


@router.get("/escalations", response_model=List[EscalationItem])
def get_escalations(current_user: dict = Depends(require_authority)):
    """Retrieve operational complaints escalated for urgent intervention with explicit reasons. Authority only."""
    return data_store.get_escalations()


@router.get("/status-requests", response_model=List[StatusUpdateRequestItem])
def get_status_update_requests(
    state: Optional[str] = Query(None, description="Filter by state (OPEN, ACKNOWLEDGED, RESOLVED)"),
    current_user: dict = Depends(require_authority),
):
    """Retrieve citizen status update requests queue. Authority only."""
    return data_store.list_status_update_requests(state=state)


@router.post("/reset-demo", response_model=Dict[str, Any])
def reset_demo_dataset(current_user: dict = Depends(require_authority)):
    """Reset municipal complaint store back to pristine sample demonstration state. Authority only."""
    return data_store.reset_demo()

