export type ProblemType = 'pothole' | 'garbage' | 'streetlight' | 'drain' | 'other';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ComplaintStatus = 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED';

export type CitizenVerificationStatus = 'PENDING' | 'CONFIRMED' | 'REOPENED';

export interface StatusHistoryItem {
  status: string;
  timestamp: string;
  note?: string | null;
  actor?: string | null;
  actor_role?: string | null;
}

export interface AssignmentRecord {
  id: string;
  previous_department?: string | null;
  new_department: string;
  previous_assignee?: string | null;
  new_assignee: string;
  changed_by: string;
  timestamp: string;
  note?: string | null;
}

export interface InternalNote {
  id: string;
  complaint_id: string;
  note: string;
  author: string;
  author_role?: string | null;
  timestamp: string;
}

export interface StatusUpdateRequestItem {
  id: string;
  complaint_id: string;
  report_id?: string | null;
  problem_type?: string | null;
  issue_type?: string | null;
  location_name?: string | null;
  current_status?: string | null;
  requested_at?: string | null;
  request_date?: string | null;
  citizen_message?: string | null;
  status?: string | null;
  state?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  citizen_notified?: boolean;
  response_note?: string | null;
}

export interface EscalationItem {
  complaint: Complaint;
  reasons: string[];
  primary_reason: string;
  priority_score: number;
  priority_level: string;
  days_unresolved?: number;
  has_open_status_request?: boolean;
  is_reopened?: boolean;
  assigned_to?: string | null;
  department?: string | null;
}

export interface CivicDetectionResult {
  problem_type: ProblemType;
  confidence: number;
  severity: SeverityLevel;
  evidence: string[];
  alternatives: string[];
  needs_retake: boolean;
  suggested_department?: string;
  guidance_message?: string;
  is_fallback?: boolean;
}

export interface ComplaintCreate {
  problem_type: ProblemType;
  confidence: number;
  severity: SeverityLevel;
  evidence: string[];
  latitude: number;
  longitude: number;
  location_name: string;
  department: string;
  description?: string;
  image_url: string;
  duplicate_of?: string | null;
}

export interface Complaint {
  id: string;
  report_id: string;
  problem_type: ProblemType;
  confidence: number;
  severity: SeverityLevel;
  evidence: string[];
  latitude: number;
  longitude: number;
  location_name: string;
  department: string;
  description: string;
  image_url: string;
  status: ComplaintStatus;
  duplicate_of?: string | null;
  created_at: string;
  updated_at: string;
  resolution_image_url?: string | null;
  resolution_image_path?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  citizen_verification_status?: CitizenVerificationStatus | null;
  citizen_resolution_confirmed?: boolean | null;
  citizen_resolution_confirmed_at?: string | null;
  citizen_verified_at?: string | null;
  citizen_reopened?: boolean;
  citizen_reopened_at?: string | null;
  reopened_at?: string | null;
  reopen_reason?: string | null;
  status_history?: StatusHistoryItem[];
  priority_score?: number | null;
  priority_level?: PriorityLevel | null;
  priority_explanation?: string | null;
  assigned_to?: string | null;
  assigned_at?: string | null;
  assignment_history?: AssignmentRecord[];
  internal_notes?: InternalNote[];
  status_update_requests?: StatusUpdateRequestItem[];
}

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Department {
  id: string;
  name: string;
  category?: string;
  is_active?: boolean;
  code?: string;
  email?: string;
  active?: boolean;
}

export interface HotspotInfo {
  id?: string;
  title: string;
  dominant_issue: string;
  total_reports: number;
  unresolved_count: number;
  high_critical_count: number;
  trend_percentage?: number;
  trend?: string;
  suggested_action: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  repeated_count?: number;
  report_ids?: string[];
  reopened_count?: number;
  affected_department?: string | null;
  severity_distribution?: Record<string, number>;
  centroid_name?: string;
  severity_score?: number;
}

export interface DailyTrendPoint {
  date: string;
  day_label: string;
  count: number;
}

export interface AgingCategory {
  label: string;
  count: number;
  percentage: number;
  department_distribution?: Record<string, number>;
  department_breakdown?: Record<string, number>;
  unresolved_count?: number;
}

export interface AgingAnalysis {
  total_unresolved: number;
  categories?: AgingCategory[];
  oldest_unresolved_count?: number;
  bucket_0_24h?: AgingCategory;
  bucket_1_3d?: AgingCategory;
  bucket_3_7d?: AgingCategory;
  bucket_7d_plus?: AgingCategory;
}

export interface DepartmentPerformance {
  department: string;
  total: number;
  assigned?: number;
  active_workload?: number;
  total_assigned?: number;
  pending: number;
  in_progress: number;
  resolved: number;
  reopened: number;
  avg_resolution_hours?: number | null;
  resolution_rate: number;
}

export interface GovernanceOutcomes {
  total_complaints: number;
  active_complaints: number;
  resolved_complaints: number;
  reopened_complaints: number;
  resolution_rate_pct?: number | null;
  avg_response_hours?: number | null;
  avg_resolution_hours?: number | null;
  pending_citizen_verification: number;
  escalated_cases: number;
  resolution_rate_label: string;
  response_time_label: string;
  resolution_time_label: string;
}

export interface TimeBasedAnalytics {
  received_over_time: DailyTrendPoint[];
  resolved_over_time: DailyTrendPoint[];
  reopened_over_time: DailyTrendPoint[];
  avg_response_hours?: number | null;
  avg_resolution_hours?: number | null;
}

export interface CategoryTrend {
  category: string;
  count_7d: number;
  count_prior_7d?: number;
  count_prev_7d?: number;
  count_30d?: number;
  count_prev_30d?: number;
  trend_7d_pct?: number | null;
  trend_30d_pct?: number | null;
  velocity_change_pct?: number | null;
  direction: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  status_label?: string;
}

export interface DashboardStatistics {
  total_reports: number;
  total_complaints?: number;
  high_critical: number;
  pending: number;
  in_progress: number;
  resolved: number;
  awaiting_verification?: number;
  reopened?: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  hotspots: HotspotInfo[];
  daily_trends?: DailyTrendPoint[];
  priority_actions?: Complaint[];
  aging_analysis?: AgingAnalysis | null;
  department_performance?: DepartmentPerformance[];
  category_trends?: CategoryTrend[];
  governance_outcomes?: GovernanceOutcomes | null;
  time_analytics?: TimeBasedAnalytics | null;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
  problem_type: string;
  severity: string;
  report_id: string;
}
