export type ProblemType = 'pothole' | 'garbage' | 'streetlight' | 'drain' | 'other';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ComplaintStatus = 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED';

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

export interface PublicTimelineEvent {
  key: string;
  title: string;
  description: string;
  timestamp?: string | null;
  state: 'completed' | 'current' | 'upcoming';
}

export interface ComplaintPublicSummary {
  report_id: string;
  problem_type: ProblemType | string;
  location_name: string;
  status: ComplaintStatus | string;
  department?: string;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  citizen_resolution_confirmed?: boolean;
  citizen_resolution_confirmed_at?: string | null;
  citizen_reopened?: boolean;
  citizen_reopened_at?: string | null;
  reopen_reason?: string | null;
  pending_status_request?: boolean;
  response_time_hours?: number | null;
  timeline_events?: PublicTimelineEvent[];
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
  resolved_at?: string | null;
  citizen_resolution_confirmed?: boolean | null;
  citizen_resolution_confirmed_at?: string | null;
  citizen_reopened?: boolean;
  citizen_reopened_at?: string | null;
  reopen_reason?: string | null;
  status_history?: ComplaintStatusHistoryItem[];
}

export interface ComplaintStatusHistoryItem {
  id: string;
  complaint_id: string;
  previous_status?: string | null;
  new_status: string;
  changed_by_role: string;
  note?: string | null;
  created_at: string;
}

export interface CitizenNotification {
  id: string;
  citizen_id: string;
  complaint_id: string;
  report_id: string;
  title: string;
  message: string;
  event_type: string;
  is_read: boolean;
  created_at: string;
}

export interface CitizenImpactSummary {
  total_submitted: number;
  total_reports: number;
  active_reports?: number;
  resolved_count: number;
  in_progress_count: number;
  reopened_count: number;
  reported_count?: number;
  pending_status_requests?: number;
}

export interface NearbyCivicIssue {
  id: string;
  report_id: string;
  problem_type: ProblemType | string;
  severity: SeverityLevel | string;
  status: ComplaintStatus | string;
  location_name: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface SimilarComplaintSummary {
  id: string;
  report_id: string;
  problem_type: ProblemType | string;
  location_name: string;
  severity: SeverityLevel | string;
  status: ComplaintStatus | string;
  distance_meters: number;
  created_at: string;
}

export interface StatusRequestResponse {
  id: string;
  complaint_id: string;
  report_id: string;
  citizen_id: string;
  problem_type: string;
  location_name?: string | null;
  message?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

export interface HotspotInfo {
  id?: string;
  title: string;
  dominant_issue: string;
  total_reports: number;
  unresolved_count: number;
  high_critical_count: number;
  trend_percentage: number;
  suggested_action: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  repeated_count?: number;
  report_ids?: string[];
}

export interface DailyTrendPoint {
  date: string;
  day_label: string;
  count: number;
}

export interface DashboardStatistics {
  total_reports: number;
  high_critical: number;
  pending: number;
  in_progress: number;
  resolved: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  hotspots: HotspotInfo[];
  daily_trends?: DailyTrendPoint[];
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
  problem_type: string;
  severity: string;
  report_id: string;
}
