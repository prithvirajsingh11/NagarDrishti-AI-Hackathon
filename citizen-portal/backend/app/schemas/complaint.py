from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ComplaintStatus(str, Enum):
    REPORTED = "REPORTED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REOPENED = "REOPENED"

class ComplaintCreate(BaseModel):
    problem_type: str = Field(..., description="pothole, garbage, streetlight, drain, other")
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: str = Field(..., description="LOW, MEDIUM, HIGH, CRITICAL")
    evidence: List[str] = Field(default_factory=list)
    latitude: float = Field(...)
    longitude: float = Field(...)
    location_name: str = Field(..., description="Human-readable address or landmark")
    department: str = Field(..., description="Assigned/suggested department")
    description: Optional[str] = Field("", description="Optional citizen notes")
    image_url: str = Field(..., description="Storage URL of the uploaded image")
    duplicate_of: Optional[str] = Field(None, description="Report ID if this is a known duplicate")

class ComplaintUpdateStatus(BaseModel):
    status: ComplaintStatus
    resolution_image_url: Optional[str] = Field(None, description="Authority resolution image URL when marking RESOLVED")

class CitizenReopenRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="Optional citizen notes on why issue is not resolved")

class PublicTimelineEvent(BaseModel):
    key: str
    title: str
    description: str
    timestamp: Optional[datetime] = None
    state: str  # "completed", "current", "upcoming"

    model_config = ConfigDict(from_attributes=True)


class ComplaintPublicSummary(BaseModel):
    report_id: str
    problem_type: str
    location_name: str
    status: str
    department: str = "Municipal Corporation"
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    citizen_resolution_confirmed: bool = False
    citizen_resolution_confirmed_at: Optional[datetime] = None
    citizen_reopened: bool = False
    citizen_reopened_at: Optional[datetime] = None
    reopen_reason: Optional[str] = None
    pending_status_request: bool = False
    response_time_hours: Optional[float] = None
    timeline_events: List[PublicTimelineEvent] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ComplaintStatusHistoryItem(BaseModel):
    id: str
    complaint_id: str
    previous_status: Optional[str] = None
    new_status: str
    changed_by_role: str = "system"
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CitizenNotification(BaseModel):
    id: str
    citizen_id: str
    complaint_id: str
    report_id: str
    title: str
    message: str
    event_type: str
    is_read: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CitizenImpactSummary(BaseModel):
    total_submitted: int
    total_reports: int = 0
    active_reports: int = 0
    resolved_count: int
    in_progress_count: int
    reopened_count: int
    reported_count: int = 0
    pending_status_requests: int = 0

    model_config = ConfigDict(from_attributes=True)


class NearbyCivicIssue(BaseModel):
    """
    Privacy-safe public discovery representation of a civic complaint.
    Strictly strips citizen identity, personal details, contact data, and private descriptions.
    Uses approximate coordinates (~3 decimal places, ~100m) for public map rendering.
    """
    id: str
    report_id: str
    problem_type: str
    severity: str
    status: str
    location_name: str
    latitude: float
    longitude: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SimilarComplaintSummary(BaseModel):
    """
    Pre-submission duplicate awareness representation.
    Informs citizen of nearby reports for same category without blocking submission.
    """
    id: str
    report_id: str
    problem_type: str
    location_name: str
    severity: str
    status: str
    distance_meters: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StatusRequestCreate(BaseModel):
    message: Optional[str] = Field(None, max_length=300, description="Optional brief citizen note to authorities")


class StatusRequestResponse(BaseModel):
    id: str
    complaint_id: str
    report_id: str
    citizen_id: str
    problem_type: str
    location_name: Optional[str] = None
    message: Optional[str] = None
    status: str = "PENDING"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplaintResponse(BaseModel):
    id: str
    report_id: str
    problem_type: str
    confidence: float
    severity: str
    evidence: List[str] = []
    latitude: float
    longitude: float
    location_name: str
    department: str
    description: Optional[str] = ""
    image_url: str
    status: str
    duplicate_of: Optional[str] = None
    citizen_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolution_image_url: Optional[str] = None
    resolved_at: Optional[datetime] = None
    citizen_resolution_confirmed: Optional[bool] = None
    citizen_resolution_confirmed_at: Optional[datetime] = None
    citizen_reopened: Optional[bool] = False
    citizen_reopened_at: Optional[datetime] = None
    reopen_reason: Optional[str] = None
    status_history: List[ComplaintStatusHistoryItem] = []

    model_config = ConfigDict(from_attributes=True)

class HeatmapPoint(BaseModel):
    latitude: float
    longitude: float
    weight: float
    problem_type: str
    severity: str
    report_id: str

class HotspotInfo(BaseModel):
    id: str = "hs-1"
    title: str
    dominant_issue: str
    total_reports: int
    unresolved_count: int
    high_critical_count: int
    trend_percentage: int
    suggested_action: str
    latitude: float
    longitude: float
    radius_km: float
    repeated_count: int = 0
    report_ids: List[str] = []

class DailyTrendPoint(BaseModel):
    date: str
    day_label: str
    count: int

class DashboardStatistics(BaseModel):
    total_reports: int
    high_critical: int
    pending: int
    in_progress: int
    resolved: int
    by_category: Dict[str, int]
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    hotspots: List[HotspotInfo]
    daily_trends: List[DailyTrendPoint] = []
