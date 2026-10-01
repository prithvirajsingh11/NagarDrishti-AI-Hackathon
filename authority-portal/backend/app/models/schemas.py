from __future__ import annotations
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

ProblemType = Literal["pothole", "garbage", "streetlight", "drain", "other"]
SeverityLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
ComplaintStatus = Literal["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED"]
CitizenVerificationStatus = Literal["PENDING", "CONFIRMED", "REOPENED"]


class AssignmentRecord(BaseModel):
    id: str
    previous_department: Optional[str] = None
    new_department: str
    previous_assignee: Optional[str] = None
    new_assignee: str
    changed_by: str
    timestamp: str
    note: Optional[str] = None


class AssignComplaintRequest(BaseModel):
    department: str
    assigned_to: str
    note: Optional[str] = None
    changed_by: Optional[str] = "Authority Officer"


class InternalNote(BaseModel):
    id: str
    complaint_id: str
    note: str
    author: str
    author_role: Optional[str] = "authority"
    timestamp: str


class CreateInternalNoteRequest(BaseModel):
    note: str
    author: Optional[str] = "Authority Officer"
    author_role: Optional[str] = "authority"


class StatusUpdateRequestItem(BaseModel):
    id: str
    complaint_id: str
    report_id: Optional[str] = None
    problem_type: Optional[str] = None
    issue_type: Optional[str] = None
    location_name: Optional[str] = None
    current_status: Optional[str] = None
    requested_at: Optional[str] = None
    request_date: Optional[str] = None
    citizen_message: Optional[str] = None
    status: Optional[str] = "OPEN"
    state: Literal["OPEN", "ACKNOWLEDGED", "RESOLVED"] = "OPEN"
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None
    citizen_notified: bool = False
    response_note: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.report_id and self.complaint_id:
            self.report_id = self.complaint_id
        if not self.problem_type and self.issue_type:
            self.problem_type = self.issue_type
        elif not self.issue_type and self.problem_type:
            self.issue_type = self.problem_type
        if not self.requested_at and self.request_date:
            self.requested_at = self.request_date
        elif not self.request_date and self.requested_at:
            self.request_date = self.requested_at
        if self.state and not self.status:
            self.status = self.state
        elif self.status and not self.state:
            self.state = self.status  # type: ignore


class AcknowledgeStatusRequest(BaseModel):
    acknowledged_by: Optional[str] = "Authority Officer"
    response_note: Optional[str] = None


class CreateStatusUpdateRequest(BaseModel):
    citizen_message: Optional[str] = None


class EscalationItem(BaseModel):
    complaint: Complaint
    reasons: List[str]
    primary_reason: str
    priority_score: float
    priority_level: str
    days_unresolved: float = 0.0
    has_open_status_request: bool = False
    is_reopened: bool = False
    assigned_to: Optional[str] = None
    department: Optional[str] = None

    # Flattened optional fields for backward compatibility
    id: Optional[str] = None
    complaint_id: Optional[str] = None
    report_id: Optional[str] = None
    problem_type: Optional[str] = None
    severity: Optional[str] = None
    location_name: Optional[str] = None
    status: Optional[str] = None
    age_days: Optional[int] = None
    escalation_level: Optional[str] = None
    has_status_update_request: Optional[bool] = None
    created_at: Optional[str] = None


class StatusHistoryItem(BaseModel):
    status: str
    timestamp: str
    note: Optional[str] = None
    actor: Optional[str] = None
    actor_role: Optional[str] = None


class Department(BaseModel):
    id: str
    name: str
    category: str
    is_active: bool = True


class ComplaintCreate(BaseModel):
    problem_type: ProblemType
    confidence: float = 0.92
    severity: SeverityLevel = "MEDIUM"
    evidence: List[str] = Field(default_factory=list)
    latitude: float
    longitude: float
    location_name: str
    department: str
    description: str = ""
    image_url: str = ""
    duplicate_of: Optional[str] = None


class Complaint(BaseModel):
    id: str
    report_id: str
    problem_type: ProblemType
    confidence: float
    severity: SeverityLevel
    evidence: List[str]
    latitude: float
    longitude: float
    location_name: str
    department: str
    description: str
    image_url: str
    status: ComplaintStatus
    duplicate_of: Optional[str] = None
    created_at: str
    updated_at: str
    resolution_image_url: Optional[str] = None
    resolution_image_path: Optional[str] = None
    resolution_note: Optional[str] = None
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    citizen_verification_status: Optional[CitizenVerificationStatus] = None
    citizen_resolution_confirmed: Optional[bool] = None
    citizen_resolution_confirmed_at: Optional[str] = None
    citizen_verified_at: Optional[str] = None
    citizen_reopened: Optional[bool] = None
    citizen_reopened_at: Optional[str] = None
    reopened_at: Optional[str] = None
    reopen_reason: Optional[str] = None
    status_history: List[StatusHistoryItem] = Field(default_factory=list)
    priority_score: Optional[float] = None
    priority_level: Optional[Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]] = None
    priority_explanation: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_at: Optional[str] = None
    assignment_history: List[AssignmentRecord] = Field(default_factory=list)
    internal_notes: List[InternalNote] = Field(default_factory=list)
    status_update_requests: List[StatusUpdateRequestItem] = Field(default_factory=list)


class StatusUpdate(BaseModel):
    status: ComplaintStatus
    resolution_image_url: Optional[str] = None
    resolution_note: Optional[str] = None


class ResolveComplaintRequest(BaseModel):
    resolution_image_url: Optional[str] = None
    resolution_note: Optional[str] = None


class ReopenComplaintRequest(BaseModel):
    reason: Optional[str] = ""


class HotspotInfo(BaseModel):
    id: Optional[str] = None
    title: str
    dominant_issue: str
    total_reports: int
    unresolved_count: int
    high_critical_count: int
    trend_percentage: float
    suggested_action: str
    latitude: float
    longitude: float
    radius_km: float
    repeated_count: Optional[int] = 0
    report_ids: Optional[List[str]] = Field(default_factory=list)
    reopened_count: Optional[int] = 0
    affected_department: Optional[str] = None
    severity_distribution: Optional[Dict[str, int]] = Field(default_factory=dict)


class DailyTrendPoint(BaseModel):
    date: str
    day_label: str
    count: int


class AgingCategory(BaseModel):
    label: str  # "0–24 hours", "1–3 days", "3–7 days", "7+ days"
    count: int
    percentage: float
    department_distribution: Dict[str, int] = Field(default_factory=dict)
    unresolved_count: int = 0


class AgingAnalysis(BaseModel):
    total_unresolved: int
    categories: List[AgingCategory] = Field(default_factory=list)
    oldest_unresolved_count: int = 0  # 7+ days count


class DepartmentPerformance(BaseModel):
    department: str
    total: int
    assigned: int = 0
    active_workload: int = 0
    pending: int
    in_progress: int
    resolved: int
    reopened: int
    avg_resolution_hours: Optional[float] = None
    resolution_rate: float  # percentage 0.0 - 100.0


class CategoryTrend(BaseModel):
    category: str
    count_7d: int = 0
    count_prior_7d: int = 0
    trend_7d_pct: Optional[float] = None  # None if insufficient historical data
    trend_30d_pct: Optional[float] = None # None if insufficient historical data
    direction: Literal["increasing", "decreasing", "stable", "insufficient_data"] = "insufficient_data"
    status_label: str = "Insufficient data"


class GovernanceOutcomes(BaseModel):
    total_complaints: int
    active_complaints: int
    resolved_complaints: int
    reopened_complaints: int
    resolution_rate_pct: Optional[float] = None
    avg_response_hours: Optional[float] = None
    avg_resolution_hours: Optional[float] = None
    pending_citizen_verification: int = 0
    escalated_cases: int = 0
    resolution_rate_label: str = "Insufficient data"
    response_time_label: str = "Insufficient data"
    resolution_time_label: str = "Insufficient data"


class TimeBasedAnalytics(BaseModel):
    received_over_time: List[DailyTrendPoint] = Field(default_factory=list)
    resolved_over_time: List[DailyTrendPoint] = Field(default_factory=list)
    reopened_over_time: List[DailyTrendPoint] = Field(default_factory=list)
    avg_response_hours: Optional[float] = None
    avg_resolution_hours: Optional[float] = None


class DashboardStatistics(BaseModel):
    total_reports: int
    high_critical: int
    pending: int
    in_progress: int
    resolved: int
    awaiting_verification: int = 0
    reopened: int = 0
    by_category: Dict[str, int]
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    hotspots: List[HotspotInfo]
    daily_trends: Optional[List[DailyTrendPoint]] = Field(default_factory=list)
    priority_actions: List[Complaint] = Field(default_factory=list)
    aging_analysis: Optional[AgingAnalysis] = None
    department_performance: List[DepartmentPerformance] = Field(default_factory=list)
    category_trends: List[CategoryTrend] = Field(default_factory=list)
    governance_outcomes: Optional[GovernanceOutcomes] = None
    time_analytics: Optional[TimeBasedAnalytics] = None


class HeatmapPoint(BaseModel):
    latitude: float
    longitude: float
    weight: float
    problem_type: str
    severity: str
    report_id: str
