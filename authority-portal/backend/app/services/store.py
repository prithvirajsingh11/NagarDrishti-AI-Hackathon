import copy
import json
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

import httpx

from ..config import (
    SHARED_DB_PATH,
    LOCAL_BACKUP_DB_PATH,
    USER_SITE_API_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)
from ..models.schemas import (
    Complaint,
    ComplaintCreate,
    ComplaintStatus,
    CitizenVerificationStatus,
    StatusHistoryItem,
    DashboardStatistics,
    Department,
    HeatmapPoint,
    HotspotInfo,
    DailyTrendPoint,
    AgingCategory,
    AgingAnalysis,
    DepartmentPerformance,
    CategoryTrend,
    AssignmentRecord,
    InternalNote,
    StatusUpdateRequestItem,
    EscalationItem,
    GovernanceOutcomes,
    TimeBasedAnalytics,
)

logger = logging.getLogger(__name__)

# Municipal Departments matching the civic taxonomy
INITIAL_DEPARTMENTS: List[Department] = [
    Department(id="dept-1", name="Municipal Roads (PWD)", category="Roads & Bridges", is_active=True),
    Department(id="dept-2", name="MCD Sanitation & Solid Waste", category="Sanitation", is_active=True),
    Department(id="dept-3", name="BSES / Municipal Street Lighting Cell", category="Street Lighting", is_active=True),
    Department(id="dept-4", name="Delhi Jal Board (DJB)", category="Drainage & Water", is_active=True),
    Department(id="dept-5", name="Delhi Traffic Police & Civic Oversight", category="Traffic & Hazards", is_active=True),
]


def build_default_history(item_dict: Dict[str, Any]) -> List[StatusHistoryItem]:
    """Generates an auditable civic lifecycle history timeline for complaint record."""
    history: List[StatusHistoryItem] = []
    created = item_dict.get("created_at") or datetime.now(timezone.utc).isoformat()
    updated = item_dict.get("updated_at") or created
    status = item_dict.get("status", "REPORTED")
    problem = str(item_dict.get("problem_type", "civic issue")).capitalize()
    confidence = int(item_dict.get("confidence", 0.92) * 100)
    dept = item_dict.get("department") or "Municipal Directorate"

    # Step 1: REPORT
    history.append(StatusHistoryItem(
        status="REPORTED",
        timestamp=created,
        note="Citizen submitted civic report",
        actor="Citizen User",
        actor_role="citizen",
    ))
    # Step 2: AI VERIFIED
    history.append(StatusHistoryItem(
        status="AI_VERIFIED",
        timestamp=created,
        note=f"{problem} detected ({confidence}% vision confidence)",
        actor="NagarDrishti Vision AI",
        actor_role="ai",
    ))
    # Step 3: ASSIGNED
    if status in ("ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED") or dept:
        history.append(StatusHistoryItem(
            status="ASSIGNED",
            timestamp=created,
            note=f"Assigned to {dept}",
            actor="Municipal Dispatch",
            actor_role="authority",
        ))
    # Step 4: IN PROGRESS
    if status in ("IN_PROGRESS", "RESOLVED", "REOPENED"):
        history.append(StatusHistoryItem(
            status="IN_PROGRESS",
            timestamp=updated,
            note="Repair squad dispatched and work started on-site",
            actor=item_dict.get("resolved_by") or "Field Maintenance Squad",
            actor_role="authority",
        ))
    # Step 5: RESOLVED
    if status in ("RESOLVED", "REOPENED") or item_dict.get("resolved_at"):
        history.append(StatusHistoryItem(
            status="RESOLVED",
            timestamp=item_dict.get("resolved_at") or updated,
            note=item_dict.get("resolution_note") or "Defect rectified and resolution evidence uploaded",
            actor=item_dict.get("resolved_by") or "Municipal Authority Officer",
            actor_role="authority",
        ))
    # Step 6: CITIZEN VERIFICATION
    if item_dict.get("citizen_resolution_confirmed") is True or item_dict.get("citizen_verification_status") == "CONFIRMED":
        history.append(StatusHistoryItem(
            status="CITIZEN_CONFIRMED",
            timestamp=item_dict.get("citizen_resolution_confirmed_at") or item_dict.get("citizen_verified_at") or updated,
            note="Citizen confirmed resolution",
            actor="Citizen User",
            actor_role="citizen",
        ))
    elif item_dict.get("citizen_reopened") is True or status == "REOPENED" or item_dict.get("citizen_verification_status") == "REOPENED":
        history.append(StatusHistoryItem(
            status="REOPENED",
            timestamp=item_dict.get("citizen_reopened_at") or item_dict.get("reopened_at") or updated,
            note=item_dict.get("reopen_reason") or "Citizen reported issue still exists",
            actor="Citizen User",
            actor_role="citizen",
        ))
    elif status == "RESOLVED":
        history.append(StatusHistoryItem(
            status="CITIZEN_VERIFICATION_PENDING",
            timestamp=item_dict.get("resolved_at") or updated,
            note="Pending citizen verification",
            actor="Citizen Verification Cell",
            actor_role="system",
        ))

    return history


def parse_complaint_dict(item: Dict[str, Any]) -> Complaint:
    """Parses a dictionary into a validated Complaint model with Phase 5 fields and history."""
    data = dict(item)
    if not isinstance(data.get("evidence"), list):
        data["evidence"] = []

    res_img = data.get("resolution_image_url") or data.get("resolution_image_path")
    if res_img:
        data["resolution_image_url"] = res_img
        data["resolution_image_path"] = res_img

    if data.get("citizen_resolution_confirmed") is True:
        data["citizen_verification_status"] = "CONFIRMED"
    elif data.get("citizen_reopened") is True or data.get("status") == "REOPENED":
        data["citizen_verification_status"] = "REOPENED"
    elif data.get("status") == "RESOLVED" and not data.get("citizen_verification_status"):
        data["citizen_verification_status"] = "PENDING"

    if "citizen_resolution_confirmed_at" in data and not data.get("citizen_verified_at"):
        data["citizen_verified_at"] = data["citizen_resolution_confirmed_at"]
    if "citizen_reopened_at" in data and not data.get("reopened_at"):
        data["reopened_at"] = data["citizen_reopened_at"]

    if not data.get("status_history") or len(data["status_history"]) == 0:
        data["status_history"] = build_default_history(data)
    else:
        parsed_history = []
        for h in data["status_history"]:
            if isinstance(h, dict):
                parsed_history.append(StatusHistoryItem(**h))
            else:
                parsed_history.append(h)
        data["status_history"] = parsed_history

    if "assignment_history" in data and isinstance(data["assignment_history"], list):
        data["assignment_history"] = [
            AssignmentRecord(**ah) if isinstance(ah, dict) else ah
            for ah in data["assignment_history"]
        ]
    else:
        data["assignment_history"] = []

    if "internal_notes" in data and isinstance(data["internal_notes"], list):
        data["internal_notes"] = [
            InternalNote(**note) if isinstance(note, dict) else note
            for note in data["internal_notes"]
        ]
    else:
        data["internal_notes"] = []

    if "status_update_requests" in data and isinstance(data["status_update_requests"], list):
        data["status_update_requests"] = [
            StatusUpdateRequestItem(**sur) if isinstance(sur, dict) else sur
            for sur in data["status_update_requests"]
        ]
    else:
        data["status_update_requests"] = []

    return Complaint(**data)


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def calculate_hotspots(complaints: List[Complaint]) -> List[HotspotInfo]:
    """
    Deterministic spatial clustering algorithm matching NagarDrishti-AI.
    Groups complaint coordinates into geographic clusters (~1.4km corridor radius).
    Computes centroids, repeated counts, unresolved ratios, dominant categories,
    and municipal suggested actions.
    """
    if not complaints:
        return []

    clusters: List[Dict[str, Any]] = []
    MAX_CLUSTER_DIST_METERS = 1400.0

    for c in complaints:
        lat = c.latitude
        lng = c.longitude
        if lat is None or lng is None:
            continue

        matched_cluster = None
        for cl in clusters:
            dist = haversine_distance_meters(lat, lng, cl["centroid_lat"], cl["centroid_lng"])
            if dist <= MAX_CLUSTER_DIST_METERS:
                matched_cluster = cl
                break

        if matched_cluster:
            matched_cluster["reports"].append(c)
            reps = matched_cluster["reports"]
            matched_cluster["centroid_lat"] = sum(r.latitude for r in reps) / len(reps)
            matched_cluster["centroid_lng"] = sum(r.longitude for r in reps) / len(reps)
            d = haversine_distance_meters(lat, lng, matched_cluster["centroid_lat"], matched_cluster["centroid_lng"])
            if d > matched_cluster.get("max_dist_m", 400.0):
                matched_cluster["max_dist_m"] = d
        else:
            clusters.append({
                "centroid_lat": lat,
                "centroid_lng": lng,
                "max_dist_m": 400.0,
                "reports": [c]
            })

    hotspot_list: List[HotspotInfo] = []
    now_utc = datetime.now(timezone.utc)
    three_days_ago = (now_utc - timedelta(days=3)).isoformat()

    title_map = {
        "pothole": "ROAD SAFETY HOTSPOT",
        "garbage": "SOLID WASTE ACCUMULATION HOTSPOT",
        "streetlight": "LIGHTING & ELECTRICAL HAZARD HOTSPOT",
        "drain": "DRAINAGE & STORM OVERFLOW HOTSPOT",
        "other": "CIVIC INFRASTRUCTURE HOTSPOT"
    }
    action_map = {
        "pothole": "Deploy emergency night milling and asphalt patching squad",
        "garbage": "Double municipal secondary compactor frequency and clear blockage",
        "streetlight": "Dispatch electrical inspection crew and secure overhead wiring",
        "drain": "Desilt arterial stormwater trunk lines and clear inlet grating",
        "other": "Conduct joint on-site inspection with local zonal officer"
    }

    for idx, cl in enumerate(clusters):
        reps: List[Complaint] = cl["reports"]
        total_reps = len(reps)
        cat_counts: Dict[str, int] = {}
        for r in reps:
            cat = r.problem_type
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

        dominant_cat = max(cat_counts, key=cat_counts.get) if cat_counts else "other"
        repeated_count = cat_counts.get(dominant_cat, 0)
        unresolved = sum(1 for r in reps if r.status != "RESOLVED")
        high_critical = sum(1 for r in reps if r.severity in ["HIGH", "CRITICAL"])

        # Dominant department
        dept_counts: Dict[str, int] = {}
        for r in reps:
            if r.department:
                dept_counts[r.department] = dept_counts.get(r.department, 0) + 1
        affected_dept = max(dept_counts, key=dept_counts.get) if dept_counts else "Municipal Works"

        # Severity distribution
        sev_dist = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for r in reps:
            sev = (r.severity or "MEDIUM").upper()
            sev_dist[sev] = sev_dist.get(sev, 0) + 1

        reopened_cnt = sum(
            1 for r in reps
            if r.status == "REOPENED" or r.citizen_reopened is True or r.citizen_verification_status == "REOPENED"
        )

        title = title_map.get(dominant_cat, "MUNICIPAL CIVIC HOTSPOT")

        # Deterministic suggested action based on real metrics
        if dominant_cat == "pothole":
            if unresolved >= 3:
                action = f"Deploy emergency asphalt patching squad. {unresolved} unresolved potholes creating acute traffic hazard."
            else:
                action = "Schedule preventive road resurfacing inspection."
        elif dominant_cat == "drain":
            action = f"Desilt arterial stormwater lines and clear {unresolved} blocked intake gratings."
        elif dominant_cat == "garbage":
            action = f"Double municipal compactor rounds and inspect commercial dumping for {unresolved} waste piles."
        elif dominant_cat == "streetlight":
            action = f"Dispatch electrical repair crew to restore {unresolved} dark road fixtures."
        else:
            action = f"Conduct joint on-site inspection with local zonal officer for {unresolved} unresolved defects."

        if reopened_cnt > 0:
            action += f" Note: {reopened_cnt} incident(s) previously reopened by citizens — prioritize field re-inspection."

        radius_km = round(max(0.4, cl["max_dist_m"] / 1000.0), 1)

        recent_count = sum(1 for r in reps if r.created_at >= three_days_ago)
        trend_pct = int((recent_count / total_reps) * 45) if total_reps > 0 else 10

        hotspot_list.append(HotspotInfo(
            id=f"hs-{idx + 1}",
            title=title,
            dominant_issue=f"{dominant_cat.capitalize()} ({repeated_count} reports in corridor)",
            total_reports=total_reps,
            unresolved_count=unresolved,
            high_critical_count=high_critical,
            trend_percentage=float(max(12, trend_pct)),
            suggested_action=action,
            latitude=round(cl["centroid_lat"], 5),
            longitude=round(cl["centroid_lng"], 5),
            radius_km=radius_km,
            repeated_count=repeated_count,
            report_ids=[r.report_id for r in reps],
            reopened_count=reopened_cnt,
            affected_department=affected_dept,
            severity_distribution=sev_dist,
        ))

    hotspot_list.sort(key=lambda h: h.total_reports, reverse=True)
    return hotspot_list


def compute_priority(
    complaint: Complaint,
    all_complaints: List[Complaint],
    now_utc: Optional[datetime] = None,
) -> Tuple[float, str, str]:
    """
    Deterministic Municipal Priority Scoring Engine (Phase 6).
    Formula specification:
    
    1. Base Severity Weight:
       - CRITICAL: 40 points
       - HIGH:     25 points
       - MEDIUM:   12 points
       - LOW:       5 points

    2. Reopened Civic Defect Boost:
       - If status == 'REOPENED' or citizen_reopened or citizen_verification_status == 'REOPENED':
         +20 points (Citizen confirmed problem still persists after reported resolution)

    3. Unresolved Duration (Complaint Age):
       - If status == 'RESOLVED': 0 points (issue is closed)
       - Age >= 7 days: +20 points (acute administrative aging)
       - 3 to 7 days:   +12 points
       - 1 to 3 days:   +6 points
       - < 1 day:       +2 points

    4. Nearby Unresolved Spatial Density (within 1400m radius corridor):
       - Counts other unresolved complaints within 1.4km using Haversine distance
       - >= 4 nearby unresolved: +15 points (high defect density / corridor hazard)
       - 2 to 3 nearby:          +8 points
       - 1 nearby:               +4 points

    5. Lifecycle Status Weight:
       - REOPENED:               +10 points
       - REPORTED (unassigned):  +8 points (untriaged citizen intake)
       - ASSIGNED / IN_PROGRESS: +5 points
       - RESOLVED:                0 points

    6. Problem Category Municipal Urgency Weight:
       - pothole:     +5 points (direct vehicular collision / safety hazard)
       - drain:       +4 points (sewage / flooding / public health risk)
       - streetlight: +3 points (nighttime pedestrian / crime hazard)
       - garbage:     +2 points (sanitary nuisance / vector risk)
       - other:       +1 point

    Special Case:
       - If complaint is RESOLVED:
         Score = 0.0, Level = "LOW", Explanation = "Resolved civic issue."

    Score normalization:
       - Capped at min 0, max 100.
    
    Priority Levels:
       - Score >= 70: CRITICAL
       - Score 50 - 69: HIGH
       - Score 30 - 49: MEDIUM
       - Score < 30:  LOW
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    if complaint.status == "RESOLVED":
        return 0.0, "LOW", "Resolved civic complaint (no active field intervention required)."

    factors = []
    score = 0.0

    # 1. Base Severity Weight
    sev = (complaint.severity or "MEDIUM").upper()
    if sev == "CRITICAL":
        score += 40.0
        factors.append("Critical severity (+40)")
    elif sev == "HIGH":
        score += 25.0
        factors.append("High severity (+25)")
    elif sev == "MEDIUM":
        score += 12.0
        factors.append("Medium severity (+12)")
    else:
        score += 5.0
        factors.append("Low severity (+5)")

    # 2. Reopened Civic Defect Boost
    is_reopened = (
        complaint.status == "REOPENED"
        or complaint.citizen_reopened is True
        or complaint.citizen_verification_status == "REOPENED"
    )
    if is_reopened:
        score += 20.0
        factors.append("Reopened by citizen (+20)")

    # 3. Lifecycle Status Factor
    if complaint.status == "REOPENED":
        score += 10.0
        factors.append("Reopened status (+10)")
    elif complaint.status == "REPORTED":
        score += 8.0
        factors.append("Untriaged intake (+8)")
    elif complaint.status in ("ASSIGNED", "IN_PROGRESS"):
        score += 5.0
        factors.append("Active field deployment (+5)")

    # 4. Unresolved Duration (Age)
    age_days = 0.0
    if complaint.created_at:
        try:
            created_dt = datetime.fromisoformat(complaint.created_at.replace("Z", "+00:00"))
            age_days = max(0.0, (now_utc - created_dt).total_seconds() / 86400.0)
        except Exception:
            pass

    if age_days >= 7.0:
        score += 20.0
        factors.append(f"Unresolved for {age_days:.1f} days (+20)")
    elif age_days >= 3.0:
        score += 12.0
        factors.append(f"Unresolved for {age_days:.1f} days (+12)")
    elif age_days >= 1.0:
        score += 6.0
        factors.append(f"Unresolved for {age_days:.1f} days (+6)")
    else:
        score += 2.0
        factors.append("Fresh intake < 24h (+2)")

    # 5. Nearby Unresolved Spatial Density (within 1400m corridor)
    if complaint.latitude is not None and complaint.longitude is not None:
        nearby_unresolved = 0
        for other in all_complaints:
            if other.id == complaint.id or other.report_id == complaint.report_id:
                continue
            if other.status == "RESOLVED":
                continue
            if other.latitude is not None and other.longitude is not None:
                dist = haversine_distance_meters(
                    complaint.latitude, complaint.longitude,
                    other.latitude, other.longitude
                )
                if dist <= 1400.0:
                    nearby_unresolved += 1

        if nearby_unresolved >= 4:
            score += 15.0
            factors.append(f"{nearby_unresolved} nearby unresolved reports (+15)")
        elif nearby_unresolved >= 2:
            score += 8.0
            factors.append(f"{nearby_unresolved} nearby unresolved reports (+8)")
        elif nearby_unresolved == 1:
            score += 4.0
            factors.append("1 nearby unresolved report (+4)")

    # 6. Problem Category Municipal Urgency Weight
    pt = (complaint.problem_type or "other").lower()
    if pt == "pothole":
        score += 5.0
        factors.append("Road safety risk (+5)")
    elif pt == "drain":
        score += 4.0
        factors.append("Drainage/flooding hazard (+4)")
    elif pt == "streetlight":
        score += 3.0
        factors.append("Night visibility hazard (+3)")
    elif pt == "garbage":
        score += 2.0
        factors.append("Sanitation accumulation (+2)")
    else:
        score += 1.0
        factors.append("General infrastructure (+1)")

    # Normalization capped at 100
    normalized_score = min(100.0, max(0.0, round(score, 1)))

    if normalized_score >= 70.0:
        level = "CRITICAL"
    elif normalized_score >= 50.0:
        level = "HIGH"
    elif normalized_score >= 30.0:
        level = "MEDIUM"
    else:
        level = "LOW"

    explanation = f"{level.capitalize()} priority because: " + " + ".join(factors)
    return normalized_score, level, explanation


def calculate_aging_analysis(
    complaints: List[Complaint],
    now_utc: Optional[datetime] = None,
) -> AgingAnalysis:
    """
    Analyzes resolution turnaround and complaint aging for unresolved civic reports.
    Buckets:
      - 0–24 hours
      - 1–3 days
      - 3–7 days
      - 7+ days
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    unresolved = [c for c in complaints if c.status != "RESOLVED"]
    total_unresolved = len(unresolved)

    bucket_defs = [
        {"key": "0-24h", "label": "0–24 hours", "min_h": 0.0, "max_h": 24.0},
        {"key": "1-3d", "label": "1–3 days", "min_h": 24.0, "max_h": 72.0},
        {"key": "3-7d", "label": "3–7 days", "min_h": 72.0, "max_h": 168.0},
        {"key": "7d+", "label": "7+ days", "min_h": 168.0, "max_h": float("inf")},
    ]

    bucket_counts = {b["key"]: 0 for b in bucket_defs}
    bucket_depts = {b["key"]: {} for b in bucket_defs}

    for c in unresolved:
        age_hours = 0.0
        if c.created_at:
            try:
                created_dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                age_hours = max(0.0, (now_utc - created_dt).total_seconds() / 3600.0)
            except Exception:
                pass

        matched_key = "7d+"
        for b in bucket_defs:
            if b["min_h"] <= age_hours < b["max_h"]:
                matched_key = b["key"]
                break

        bucket_counts[matched_key] += 1
        dept = c.department or "Unassigned"
        bucket_depts[matched_key][dept] = bucket_depts[matched_key].get(dept, 0) + 1

    categories = []
    for b in bucket_defs:
        k = b["key"]
        cnt = bucket_counts[k]
        pct = round((cnt / total_unresolved * 100.0), 1) if total_unresolved > 0 else 0.0
        categories.append(AgingCategory(
            label=b["label"],
            count=cnt,
            percentage=pct,
            department_distribution=bucket_depts[k],
            unresolved_count=cnt,
        ))

    oldest_count = bucket_counts["7d+"]
    return AgingAnalysis(
        total_unresolved=total_unresolved,
        categories=categories,
        oldest_unresolved_count=oldest_count,
    )


def calculate_department_performance(
    complaints: List[Complaint],
    departments: List[Department],
) -> List[DepartmentPerformance]:
    """
    Computes department workload distribution, active resolution rates,
    and average resolution turnaround times from actual complaint history.
    """
    perf_list = []
    dept_names = [d.name for d in departments]
    for c in complaints:
        if c.department and c.department not in dept_names:
            dept_names.append(c.department)

    for dept_name in dept_names:
        dept_complaints = [
            c for c in complaints
            if c.department and (dept_name.lower() in c.department.lower() or c.department.lower() in dept_name.lower())
        ]
        total = len(dept_complaints)
        assigned = sum(
            1 for c in dept_complaints
            if c.status == "ASSIGNED" or (c.assigned_to is not None and len(c.assigned_to.strip()) > 0)
        )
        active_workload = sum(
            1 for c in dept_complaints
            if c.status in ("REPORTED", "ASSIGNED", "IN_PROGRESS", "REOPENED") or c.citizen_reopened is True
        )
        pending = sum(1 for c in dept_complaints if c.status == "REPORTED")
        in_progress = sum(1 for c in dept_complaints if c.status in ("ASSIGNED", "IN_PROGRESS"))
        resolved = sum(1 for c in dept_complaints if c.status == "RESOLVED")
        reopened = sum(
            1 for c in dept_complaints
            if c.status == "REOPENED" or c.citizen_reopened is True or c.citizen_verification_status == "REOPENED"
        )

        res_durations = []
        for c in dept_complaints:
            if c.status == "RESOLVED" and c.resolved_at and c.created_at:
                try:
                    c_dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                    r_dt = datetime.fromisoformat(c.resolved_at.replace("Z", "+00:00"))
                    diff_h = (r_dt - c_dt).total_seconds() / 3600.0
                    if diff_h >= 0:
                        res_durations.append(diff_h)
                except Exception:
                    pass

        avg_res_h = round(sum(res_durations) / len(res_durations), 1) if res_durations else None
        res_rate = round((resolved / total * 100.0), 1) if total > 0 else 0.0

        perf_list.append(DepartmentPerformance(
            department=dept_name,
            total=total,
            assigned=assigned,
            active_workload=active_workload,
            pending=pending,
            in_progress=in_progress,
            resolved=resolved,
            reopened=reopened,
            avg_resolution_hours=avg_res_h,
            resolution_rate=res_rate,
        ))

    perf_list.sort(key=lambda p: p.total, reverse=True)
    return perf_list


def calculate_category_trends(
    complaints: List[Complaint],
    now_utc: Optional[datetime] = None,
) -> List[CategoryTrend]:
    """
    Computes 7-day and 30-day incident velocity trends per problem category.
    Handles sparse or insufficient historical data transparently without fabrication.
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    t_now = now_utc
    t_7d_ago = t_now - timedelta(days=7)
    t_14d_ago = t_now - timedelta(days=14)
    t_30d_ago = t_now - timedelta(days=30)
    t_60d_ago = t_now - timedelta(days=60)

    categories = ["pothole", "garbage", "streetlight", "drain", "other"]
    trends = []

    for cat in categories:
        cat_complaints = [c for c in complaints if (c.problem_type or "other").lower() == cat]

        count_7d = 0
        count_prior_7d = 0
        count_30d = 0
        count_prior_30d = 0

        for c in cat_complaints:
            if not c.created_at:
                continue
            try:
                dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                if t_7d_ago <= dt <= t_now:
                    count_7d += 1
                elif t_14d_ago <= dt < t_7d_ago:
                    count_prior_7d += 1

                if t_30d_ago <= dt <= t_now:
                    count_30d += 1
                elif t_60d_ago <= dt < t_30d_ago:
                    count_prior_30d += 1
            except Exception:
                pass

        trend_7d_pct = None
        trend_30d_pct = None
        direction = "insufficient_data"
        status_label = "Insufficient data"

        if count_prior_7d > 0:
            trend_7d_pct = round(((count_7d - count_prior_7d) / count_prior_7d) * 100.0, 1)
            if trend_7d_pct > 15.0:
                direction = "increasing"
                status_label = f"+{trend_7d_pct}% vs prior 7d"
            elif trend_7d_pct < -15.0:
                direction = "decreasing"
                status_label = f"{trend_7d_pct}% vs prior 7d"
            else:
                direction = "stable"
                status_label = f"{trend_7d_pct}% (stable)"
        elif count_7d >= 2:
            trend_7d_pct = 100.0
            direction = "increasing"
            status_label = f"{count_7d} reports (new surge)"
        elif count_7d == 1:
            trend_7d_pct = None
            direction = "stable"
            status_label = "1 report (baseline)"
        else:
            trend_7d_pct = None
            direction = "insufficient_data"
            status_label = "Insufficient data"

        if count_prior_30d > 0:
            trend_30d_pct = round(((count_30d - count_prior_30d) / count_prior_30d) * 100.0, 1)
        elif count_30d >= 3:
            trend_30d_pct = 100.0

        trends.append(CategoryTrend(
            category=cat,
            count_7d=count_7d,
            count_prior_7d=count_prior_7d,
            trend_7d_pct=trend_7d_pct,
            trend_30d_pct=trend_30d_pct,
            direction=direction,
            status_label=status_label,
        ))

    return trends


def calculate_daily_trends(complaints: List[Complaint]) -> List[DailyTrendPoint]:
    """
    Computes actual 7-day complaint intake volume from database records.
    Returns ordered list of daily trend points (Mon-Sun).
    """
    now_utc = datetime.now(timezone.utc)
    day_counts: Dict[str, int] = {}
    day_labels: Dict[str, str] = {}

    for i in range(6, -1, -1):
        dt = now_utc - timedelta(days=i)
        key = dt.strftime("%Y-%m-%d")
        day_counts[key] = 0
        day_labels[key] = dt.strftime("%a")

    for c in complaints:
        if c.created_at:
            try:
                dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                key = dt.strftime("%Y-%m-%d")
                if key in day_counts:
                    day_counts[key] += 1
            except Exception:
                pass

    trends = []
    for key in sorted(day_counts.keys()):
        trends.append(DailyTrendPoint(
            date=key,
            day_label=day_labels.get(key, key),
            count=day_counts[key]
        ))
    return trends


def calculate_governance_outcomes(
    complaints: List[Complaint],
    escalations_count: int = 0,
) -> GovernanceOutcomes:
    """
    Computes evidence-based municipal governance outcomes from actual complaint records.
    Never invents numbers; uses 'Insufficient data' labels when baseline is missing.
    """
    total = len(complaints)
    active = sum(1 for c in complaints if c.status in ("REPORTED", "ASSIGNED", "IN_PROGRESS", "REOPENED") or c.citizen_reopened is True)
    resolved = sum(1 for c in complaints if c.status == "RESOLVED")
    reopened = sum(
        1 for c in complaints
        if c.status == "REOPENED" or c.citizen_reopened is True or c.citizen_verification_status == "REOPENED"
    )
    pending_verif = sum(
        1 for c in complaints
        if c.status == "RESOLVED" and (
            c.citizen_verification_status == "PENDING"
            or (c.citizen_resolution_confirmed is None and not c.citizen_reopened)
        )
    )

    # Resolution rate
    if total > 0:
        res_rate = round((resolved / total * 100.0), 1)
        res_label = f"{res_rate}%"
    else:
        res_rate = None
        res_label = "Insufficient data"

    # Average response time: time between created_at and earliest operational action (assigned_at or status change)
    response_durations: List[float] = []
    for c in complaints:
        if not c.created_at:
            continue
        try:
            c_dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
            earliest_action_dt = None

            if c.assigned_at:
                earliest_action_dt = datetime.fromisoformat(c.assigned_at.replace("Z", "+00:00"))

            for h in (c.status_history or []):
                if h.status in ("ASSIGNED", "IN_PROGRESS", "INTERNAL_NOTE", "STATUS_REQUEST_ACKNOWLEDGED") and h.timestamp:
                    try:
                        h_dt = datetime.fromisoformat(h.timestamp.replace("Z", "+00:00"))
                        if earliest_action_dt is None or h_dt < earliest_action_dt:
                            earliest_action_dt = h_dt
                    except Exception:
                        pass

            if earliest_action_dt:
                diff_h = (earliest_action_dt - c_dt).total_seconds() / 3600.0
                if diff_h >= 0:
                    response_durations.append(diff_h)
        except Exception:
            pass

    if response_durations:
        avg_resp_h = round(sum(response_durations) / len(response_durations), 1)
        resp_label = f"{avg_resp_h}h avg response"
    else:
        avg_resp_h = None
        resp_label = "Insufficient data"

    # Average resolution turnaround: time between created_at and resolved_at for resolved complaints
    resolution_durations: List[float] = []
    for c in complaints:
        if c.status == "RESOLVED" and c.resolved_at and c.created_at:
            try:
                c_dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                r_dt = datetime.fromisoformat(c.resolved_at.replace("Z", "+00:00"))
                diff_h = (r_dt - c_dt).total_seconds() / 3600.0
                if diff_h >= 0:
                    resolution_durations.append(diff_h)
            except Exception:
                pass

    if resolution_durations:
        avg_res_h = round(sum(resolution_durations) / len(resolution_durations), 1)
        res_turnaround_label = f"{avg_res_h}h avg turnaround"
    else:
        avg_res_h = None
        res_turnaround_label = "Insufficient data (no resolved complaints in period)"

    return GovernanceOutcomes(
        total_complaints=total,
        active_complaints=active,
        resolved_complaints=resolved,
        reopened_complaints=reopened,
        resolution_rate_pct=res_rate,
        avg_response_hours=avg_resp_h,
        avg_resolution_hours=avg_res_h,
        pending_citizen_verification=pending_verif,
        escalated_cases=escalations_count,
        resolution_rate_label=res_label,
        response_time_label=resp_label,
        resolution_time_label=res_turnaround_label,
    )


def calculate_time_analytics(complaints: List[Complaint]) -> TimeBasedAnalytics:
    """
    Computes lightweight time-series volume curves for received, resolved, and reopened cases
    across 7 days using actual timestamps.
    """
    now_utc = datetime.now(timezone.utc)
    day_keys = [(now_utc - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    day_labels = {k: datetime.fromisoformat(k).strftime("%a") for k in day_keys}

    rcv_counts = {k: 0 for k in day_keys}
    res_counts = {k: 0 for k in day_keys}
    reopen_counts = {k: 0 for k in day_keys}

    for c in complaints:
        # Received
        if c.created_at:
            try:
                k = datetime.fromisoformat(c.created_at.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                if k in rcv_counts:
                    rcv_counts[k] += 1
            except Exception:
                pass

        # Resolved
        if c.status == "RESOLVED" and c.resolved_at:
            try:
                k = datetime.fromisoformat(c.resolved_at.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                if k in res_counts:
                    res_counts[k] += 1
            except Exception:
                pass

        # Reopened
        reopen_ts = c.citizen_reopened_at or c.reopened_at
        if (c.status == "REOPENED" or c.citizen_reopened is True) and reopen_ts:
            try:
                k = datetime.fromisoformat(reopen_ts.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                if k in reopen_counts:
                    reopen_counts[k] += 1
            except Exception:
                pass

    received_over_time = [
        DailyTrendPoint(date=k, day_label=day_labels[k], count=rcv_counts[k]) for k in day_keys
    ]
    resolved_over_time = [
        DailyTrendPoint(date=k, day_label=day_labels[k], count=res_counts[k]) for k in day_keys
    ]
    reopened_over_time = [
        DailyTrendPoint(date=k, day_label=day_labels[k], count=reopen_counts[k]) for k in day_keys
    ]

    outcomes = calculate_governance_outcomes(complaints, 0)

    return TimeBasedAnalytics(
        received_over_time=received_over_time,
        resolved_over_time=resolved_over_time,
        reopened_over_time=reopened_over_time,
        avg_response_hours=outcomes.avg_response_hours,
        avg_resolution_hours=outcomes.avg_resolution_hours,
    )


class CivicDataStore:
    """
    Connected data store bridging the Authority Portal directly to the NagarDrishti-AI citizen platform.
    Features:
    - Shared disk persistence to complaints_db.json
    - Dynamic mtime cache auto-reload so citizen reports appear in real-time
    - Dynamic spatial clustering for Hotspot Intelligence
    - Dynamic 7-day daily intake volume trends
    - Live synchronization with NagarDrishti-AI backend API (if running)
    - Full lifecycle management (REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED)
    """

    def __init__(self):
        self._supabase_client = None
        self._last_supabase_sync: float = 0.0
        self.departments: List[Department] = copy.deepcopy(INITIAL_DEPARTMENTS)
        self.complaints: List[Complaint] = []
        self._last_mtime: float = 0.0
        self._report_seq = 119
        self._load_from_storage()

    def _get_supabase_client(self):
        if self._supabase_client is None and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            try:
                from supabase import create_client
                self._supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                logger.info("Connected to Supabase PostgreSQL database.")
            except Exception as e:
                logger.warning(f"Could not initialize Supabase client: {e}")
        return self._supabase_client

    def _sync_with_supabase(self) -> bool:
        client = self._get_supabase_client()
        if not client:
            return False
        try:
            res = client.table("complaints").select("*").order("created_at", desc=True).execute()
            if res.data is not None:
                parsed = []
                existing_report_ids = set()
                local_by_rep = {c.report_id: c for c in self.complaints}
                local_by_id = {c.id: c for c in self.complaints}

                max_seq = 118
                for item in res.data:
                    try:
                        c = parse_complaint_dict(item)
                        # If local store has recent updates, preserve them
                        local_c = local_by_rep.get(c.report_id) or local_by_id.get(c.id)
                        if local_c:
                            if local_c.updated_at >= c.updated_at:
                                c.status = local_c.status
                                c.resolved_at = local_c.resolved_at or c.resolved_at
                                c.resolved_by = local_c.resolved_by or c.resolved_by
                                c.resolution_image_url = local_c.resolution_image_url or c.resolution_image_url
                                c.resolution_note = local_c.resolution_note or c.resolution_note
                                c.citizen_verification_status = local_c.citizen_verification_status or c.citizen_verification_status
                                c.citizen_verified_at = local_c.citizen_verified_at or c.citizen_verified_at
                                c.reopened_at = local_c.reopened_at or c.reopened_at
                                c.reopen_reason = local_c.reopen_reason or c.reopen_reason
                                c.assigned_to = local_c.assigned_to or c.assigned_to
                                c.assigned_at = local_c.assigned_at or c.assigned_at
                                if len(local_c.assignment_history) > len(c.assignment_history):
                                    c.assignment_history = local_c.assignment_history
                                if len(local_c.internal_notes) > len(c.internal_notes):
                                    c.internal_notes = local_c.internal_notes
                                if len(local_c.status_update_requests) > len(c.status_update_requests):
                                    c.status_update_requests = local_c.status_update_requests
                                if len(local_c.status_history) > len(c.status_history):
                                    c.status_history = local_c.status_history

                        parsed.append(c)
                        existing_report_ids.add(c.report_id)
                        existing_report_ids.add(c.id)
                        rep = str(c.report_id)
                        if rep.startswith("NGD-2026-"):
                            try:
                                s = int(rep.split("-")[-1])
                                if s > max_seq:
                                    max_seq = s
                            except ValueError:
                                pass
                    except Exception as parse_err:
                        logger.warning(f"Error parsing complaint record from Supabase: {parse_err}")

                # Preserve local complaints not in Supabase (e.g. seeded baseline, test records)
                for local_c in self.complaints:
                    if local_c.id not in existing_report_ids and local_c.report_id not in existing_report_ids:
                        parsed.append(local_c)
                        existing_report_ids.add(local_c.id)
                        existing_report_ids.add(local_c.report_id)

                # Also merge baseline complaints from complaints_backup.json if missing
                backup_file = Path(LOCAL_BACKUP_DB_PATH).parent / "complaints_backup.json"
                if backup_file.exists():
                    try:
                        with open(backup_file, "r", encoding="utf-8") as bf:
                            b_data = json.load(bf)
                        b_items = []
                        if isinstance(b_data, list):
                            b_items = b_data
                        elif isinstance(b_data, dict):
                            b_items = b_data.get("local", []) + b_data.get("supabase", [])
                        for b_item in b_items:
                            try:
                                bc = parse_complaint_dict(b_item)
                                if bc.id not in existing_report_ids and bc.report_id not in existing_report_ids:
                                    parsed.append(bc)
                                    existing_report_ids.add(bc.id)
                                    existing_report_ids.add(bc.report_id)
                            except Exception:
                                pass
                    except Exception as be:
                        logger.warning(f"Could not merge backup complaints: {be}")

                self.complaints = parsed
                self._report_seq = max_seq + 1
                self._last_supabase_sync = datetime.now(timezone.utc).timestamp()
                logger.info(f"Loaded {len(parsed)} complaints from Supabase and baseline store")
                self._save_to_storage()

                # Sync active departments
                try:
                    dept_res = client.table("departments").select("*").eq("is_active", True).execute()
                    if dept_res.data:
                        self.departments = [
                            Department(
                                id=str(d["id"]),
                                name=d["name"],
                                category=d.get("category", "other"),
                                is_active=d.get("is_active", True),
                            )
                            for d in dept_res.data
                        ]
                except Exception as de:
                    logger.warning(f"Could not sync departments from Supabase: {de}")

                return True
        except Exception as e:
            logger.warning(f"Failed to sync with Supabase: {e}")
        return False

    def _get_storage_targets(self) -> List[Path]:
        targets = []
        for p_str in [SHARED_DB_PATH, LOCAL_BACKUP_DB_PATH]:
            if p_str:
                p = Path(p_str)
                try:
                    p.parent.mkdir(parents=True, exist_ok=True)
                    targets.append(p)
                except Exception as e:
                    logger.warning(f"Could not prepare path {p_str}: {e}")
        return targets

    def _load_from_storage(self):
        """Loads complaints from local storage targets (merging unique records) and synchronizes with Supabase."""
        targets = self._get_storage_targets()
        known_ids = set()
        all_raw_items = []
        max_mtime = 0.0

        for target in targets:
            if target.exists() and target.stat().st_size > 5:
                try:
                    max_mtime = max(max_mtime, target.stat().st_mtime)
                    with open(target, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    items = []
                    if isinstance(data, list):
                        items = data
                    elif isinstance(data, dict):
                        items = data.get("local", []) + data.get("supabase", [])
                    for it in items:
                        iid = it.get("id") or it.get("report_id")
                        if iid and iid not in known_ids:
                            known_ids.add(iid)
                            all_raw_items.append(it)
                except Exception as e:
                    logger.warning(f"Failed to load from {target}: {e}")

        parsed = []
        max_seq = 118
        for item in all_raw_items:
            try:
                c = parse_complaint_dict(item)
                parsed.append(c)
                rep = str(c.report_id)
                if rep.startswith("NGD-2026-"):
                    try:
                        s = int(rep.split("-")[-1])
                        if s > max_seq:
                            max_seq = s
                    except ValueError:
                        pass
            except Exception as parse_err:
                logger.warning(f"Error parsing complaint record: {parse_err}")

        self.complaints = parsed
        self._report_seq = max_seq + 1
        self._last_mtime = max_mtime

        # Synchronize live updates from Supabase while preserving local baseline
        self._sync_with_supabase()
        self._save_to_storage()

    def _get_seed_records(self) -> List[Complaint]:
        """Returns empty list: dummy seed data removed."""
        return []

    def _seed_initial_records(self):
        """Initializes empty complaints list for clean database state."""
        self.complaints = []
        self._report_seq = 1

    def _save_to_storage(self):
        """Saves current state to all configured storage targets."""
        targets = self._get_storage_targets()
        raw_list = [c.model_dump() for c in self.complaints]

        for target in targets:
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                with open(target, "w", encoding="utf-8") as f:
                    json.dump(raw_list, f, indent=2, ensure_ascii=False)
                self._last_mtime = target.stat().st_mtime
            except Exception as e:
                logger.warning(f"Failed to persist complaints to {target}: {e}")

    def _check_auto_reload(self):
        """Checks if Supabase or disk storage has updates, with 5s sync debounce."""
        now = datetime.now(timezone.utc).timestamp()
        if now - self._last_supabase_sync > 5.0:
            if self._sync_with_supabase():
                return

        targets = self._get_storage_targets()
        for target in targets:
            if target.exists():
                try:
                    mtime = target.stat().st_mtime
                    if mtime > self._last_mtime + 0.1:
                        self._load_from_storage()
                        break
                except Exception:
                    pass

    def _notify_user_site_status(self, complaint_id: str, new_status: str):
        """Optionally forwards status change to user site API if configured."""
        if not USER_SITE_API_URL:
            return
        try:
            with httpx.Client(timeout=2.0) as client:
                client.patch(
                    f"{USER_SITE_API_URL}/api/complaints/{complaint_id}/status",
                    json={"status": new_status},
                )
        except Exception as e:
            logger.debug(f"User site API notify skipped or unavailable ({USER_SITE_API_URL}): {e}")

    def reset_demo(self) -> Dict[str, Any]:
        """Clears dummy dataset while strictly preserving any real citizen user reports."""
        self._check_auto_reload()
        demo_ids = {f"c{i:03d}" for i in range(1, 19)}
        demo_reps = {f"NGD-2026-{i:05d}" for i in range(101, 119)}

        user_reports = [
            c for c in self.complaints
            if c.id not in demo_ids and c.report_id not in demo_reps
        ]

        self.complaints = user_reports
        self._save_to_storage()

        return {
            "status": "success",
            "message": "Dummy complaints removed; citizen user-submitted reports preserved.",
            "demo_count": 0,
            "user_preserved_count": len(user_reports),
        }

    def list_departments(self) -> List[Department]:
        return self.departments

    def list_complaints(
        self,
        problem_type: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        department: Optional[str] = None,
        resolution_status: Optional[str] = None,
        priority_level: Optional[str] = None,
        aging: Optional[str] = None,
        is_reopened: Optional[bool] = None,
        limit: Optional[int] = None,
    ) -> List[Complaint]:
        self._check_auto_reload()
        now_utc = datetime.now(timezone.utc)

        # Decorate with Phase 6 deterministic priority calculations
        for c in self.complaints:
            score, level, explanation = compute_priority(c, self.complaints, now_utc)
            c.priority_score = score
            c.priority_level = level  # type: ignore
            c.priority_explanation = explanation

        results = self.complaints

        if problem_type:
            results = [c for c in results if c.problem_type.lower() == problem_type.lower()]
        if severity:
            results = [c for c in results if c.severity.upper() == severity.upper()]
        if status:
            results = [c for c in results if c.status.upper() == status.upper()]
        if department:
            results = [c for c in results if department.lower() in c.department.lower()]
        if priority_level:
            results = [c for c in results if (c.priority_level or "").upper() == priority_level.upper()]
        if is_reopened is not None:
            if is_reopened:
                results = [
                    c for c in results
                    if c.status == "REOPENED" or c.citizen_reopened is True or c.citizen_verification_status == "REOPENED"
                ]
            else:
                results = [
                    c for c in results
                    if not (c.status == "REOPENED" or c.citizen_reopened is True or c.citizen_verification_status == "REOPENED")
                ]
        if aging:
            ag = aging.lower().strip()
            def _get_age_days(c: Complaint) -> float:
                if not c.created_at:
                    return 0.0
                try:
                    c_dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                    return max(0.0, (now_utc - c_dt).total_seconds() / 86400.0)
                except Exception:
                    return 0.0

            if ag in ("0-24h", "24h", "0-1d"):
                results = [c for c in results if _get_age_days(c) < 1.0]
            elif ag in ("1-3d", "3d"):
                results = [c for c in results if 1.0 <= _get_age_days(c) < 3.0]
            elif ag in ("3-7d", "7d"):
                results = [c for c in results if 3.0 <= _get_age_days(c) < 7.0]
            elif ag in ("7+d", "7d+", "critical"):
                results = [c for c in results if _get_age_days(c) >= 7.0]

        if resolution_status:
            rs = resolution_status.lower().strip()
            if rs in ("pending_resolution", "pending-resolution", "unresolved"):
                results = [c for c in results if c.status in ("REPORTED", "ASSIGNED", "IN_PROGRESS")]
            elif rs == "resolved":
                results = [c for c in results if c.status == "RESOLVED"]
            elif rs in ("awaiting_verification", "awaiting-verification", "pending_verification"):
                results = [
                    c for c in results
                    if c.status == "RESOLVED" and (
                        c.citizen_verification_status == "PENDING"
                        or (c.citizen_resolution_confirmed is None and not c.citizen_reopened)
                    )
                ]
            elif rs in ("citizen_confirmed", "confirmed"):
                results = [
                    c for c in results
                    if c.citizen_verification_status == "CONFIRMED" or c.citizen_resolution_confirmed is True
                ]
            elif rs in ("reopened", "citizen_reopened"):
                results = [
                    c for c in results
                    if c.status == "REOPENED" or c.citizen_reopened is True or c.citizen_verification_status == "REOPENED"
                ]

        # Sort newest first
        results = sorted(results, key=lambda x: x.created_at, reverse=True)

        if limit and limit > 0:
            results = results[:limit]

        return results

    def get_complaint(self, complaint_id: str) -> Optional[Complaint]:
        self._check_auto_reload()
        now_utc = datetime.now(timezone.utc)
        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                score, level, explanation = compute_priority(c, self.complaints, now_utc)
                c.priority_score = score
                c.priority_level = level  # type: ignore
                c.priority_explanation = explanation
                return c
        return None

    def update_complaint_status(
        self,
        complaint_id: str,
        new_status: ComplaintStatus,
        resolution_image_url: Optional[str] = None,
        resolution_note: Optional[str] = None,
        resolved_by: Optional[str] = None,
    ) -> Optional[Complaint]:
        self._check_auto_reload()
        updated_c = None
        now_iso = datetime.now(timezone.utc).isoformat()
        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                c.status = new_status
                c.updated_at = now_iso

                if new_status == "RESOLVED":
                    if resolution_image_url:
                        c.resolution_image_url = resolution_image_url
                        c.resolution_image_path = resolution_image_url
                    if resolution_note is not None:
                        c.resolution_note = resolution_note
                    if not c.resolved_at:
                        c.resolved_at = now_iso
                    if resolved_by:
                        c.resolved_by = resolved_by
                    c.citizen_verification_status = "PENDING"
                    c.citizen_resolution_confirmed = None
                    c.citizen_reopened = False

                    c.status_history.append(StatusHistoryItem(
                        status="RESOLVED",
                        timestamp=now_iso,
                        note=c.resolution_note or "Civic defect rectified and resolution evidence uploaded",
                        actor=c.resolved_by or "Municipal Authority Officer",
                        actor_role="authority",
                    ))
                elif new_status == "IN_PROGRESS":
                    c.status_history.append(StatusHistoryItem(
                        status="IN_PROGRESS",
                        timestamp=now_iso,
                        note="Repair work resumed on-site by municipal team",
                        actor=resolved_by or "Municipal Authority Officer",
                        actor_role="authority",
                    ))
                elif new_status == "ASSIGNED":
                    c.status_history.append(StatusHistoryItem(
                        status="ASSIGNED",
                        timestamp=now_iso,
                        note=f"Assigned to {c.department}",
                        actor="Municipal Dispatch",
                        actor_role="authority",
                    ))
                elif new_status == "REOPENED":
                    c.citizen_verification_status = "REOPENED"
                    c.citizen_reopened = True
                    c.citizen_reopened_at = now_iso
                    c.reopened_at = now_iso
                    c.status_history.append(StatusHistoryItem(
                        status="REOPENED",
                        timestamp=now_iso,
                        note=c.reopen_reason or "Complaint transitioned to REOPENED",
                        actor="Municipal Authority / Citizen",
                        actor_role="authority",
                    ))

                updated_c = c
                break

        if updated_c:
            client = self._get_supabase_client()
            if client:
                try:
                    payload_to_supabase: Dict[str, Any] = {
                        "status": new_status,
                        "updated_at": now_iso,
                    }
                    if updated_c.resolved_at:
                        payload_to_supabase["resolved_at"] = updated_c.resolved_at
                    if updated_c.resolution_image_url:
                        payload_to_supabase["resolution_image_url"] = updated_c.resolution_image_url
                    if updated_c.reopen_reason:
                        payload_to_supabase["reopen_reason"] = updated_c.reopen_reason
                    client.table("complaints").update(payload_to_supabase).eq("report_id", updated_c.report_id).execute()
                    logger.info(f"Updated status for {updated_c.report_id} in Supabase")
                except Exception as se:
                    try:
                        client.table("complaints").update({
                            "status": new_status,
                            "updated_at": now_iso,
                        }).eq("report_id", updated_c.report_id).execute()
                        logger.info(f"Updated core status for {updated_c.report_id} in Supabase")
                    except Exception as se2:
                        logger.warning(f"Failed to update status in Supabase: {se2}")

            self._save_to_storage()
            self._notify_user_site_status(updated_c.report_id, new_status)
            return updated_c
        return None

    def resolve_complaint(
        self,
        complaint_id: str,
        resolution_image_url: str,
        resolution_note: Optional[str] = None,
        resolved_by: Optional[str] = None,
    ) -> Optional[Complaint]:
        return self.update_complaint_status(
            complaint_id=complaint_id,
            new_status="RESOLVED",
            resolution_image_url=resolution_image_url,
            resolution_note=resolution_note,
            resolved_by=resolved_by or "Municipal Authority Officer",
        )

    def confirm_resolution(self, complaint_id: str) -> Optional[Complaint]:
        self._check_auto_reload()
        updated_c = None
        now_iso = datetime.now(timezone.utc).isoformat()
        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                if c.status != "RESOLVED":
                    return None
                c.citizen_resolution_confirmed = True
                c.citizen_resolution_confirmed_at = now_iso
                c.citizen_verified_at = now_iso
                c.citizen_verification_status = "CONFIRMED"
                c.citizen_reopened = False
                c.updated_at = now_iso
                c.status_history.append(StatusHistoryItem(
                    status="CITIZEN_CONFIRMED",
                    timestamp=now_iso,
                    note="Citizen confirmed resolution",
                    actor="Citizen User",
                    actor_role="citizen",
                ))
                updated_c = c
                break

        if updated_c:
            client = self._get_supabase_client()
            if client:
                try:
                    client.table("complaints").update({
                        "citizen_resolution_confirmed": True,
                        "citizen_resolution_confirmed_at": now_iso,
                        "updated_at": now_iso,
                    }).eq("report_id", updated_c.report_id).execute()
                except Exception:
                    try:
                        client.table("complaints").update({
                            "status": "RESOLVED",
                            "updated_at": now_iso,
                        }).eq("report_id", updated_c.report_id).execute()
                    except Exception as se:
                        logger.warning(f"Could not update confirmation in Supabase: {se}")
            self._save_to_storage()
            return updated_c
        return None

    def reopen_complaint(self, complaint_id: str, reason: str = "") -> Optional[Complaint]:
        self._check_auto_reload()
        updated_c = None
        now_iso = datetime.now(timezone.utc).isoformat()
        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                if c.status != "RESOLVED":
                    return None
                c.status = "REOPENED"
                c.citizen_reopened = True
                c.citizen_reopened_at = now_iso
                c.reopened_at = now_iso
                c.reopen_reason = reason or "Citizen reported that this issue is still unresolved."
                c.citizen_resolution_confirmed = False
                c.citizen_verification_status = "REOPENED"
                c.updated_at = now_iso
                # Note: Prior resolution image and timestamp remain PRESERVED!
                c.status_history.append(StatusHistoryItem(
                    status="REOPENED",
                    timestamp=now_iso,
                    note=c.reopen_reason,
                    actor="Citizen User",
                    actor_role="citizen",
                ))
                updated_c = c
                break

        if updated_c:
            client = self._get_supabase_client()
            if client:
                try:
                    client.table("complaints").update({
                        "status": "REOPENED",
                        "reopen_reason": updated_c.reopen_reason,
                        "updated_at": now_iso,
                    }).eq("report_id", updated_c.report_id).execute()
                except Exception:
                    try:
                        client.table("complaints").update({
                            "status": "REOPENED",
                            "updated_at": now_iso,
                        }).eq("report_id", updated_c.report_id).execute()
                    except Exception as se:
                        logger.warning(f"Could not update reopen in Supabase: {se}")
            self._save_to_storage()
            return updated_c
        return None

    def add_complaint(self, payload: ComplaintCreate) -> Complaint:
        self._check_auto_reload()
        now_iso = datetime.now(timezone.utc).isoformat()
        report_id = f"NGD-2026-{self._report_seq:05d}"
        self._report_seq += 1

        # Check duplicate within 50 meters for same problem category
        duplicate_report_id = None
        for existing in self.complaints:
            if existing.problem_type == payload.problem_type:
                dist = haversine_distance_meters(
                    payload.latitude, payload.longitude,
                    existing.latitude, existing.longitude
                )
                if dist <= 50.0:
                    duplicate_report_id = existing.report_id
                    break

        new_complaint = Complaint(
            id=str(uuid.uuid4()),
            report_id=report_id,
            problem_type=payload.problem_type,
            confidence=payload.confidence,
            severity=payload.severity,
            evidence=payload.evidence,
            latitude=payload.latitude,
            longitude=payload.longitude,
            location_name=payload.location_name,
            department=payload.department,
            description=payload.description,
            image_url=payload.image_url,
            status="REPORTED",
            duplicate_of=duplicate_report_id or payload.duplicate_of,
            created_at=now_iso,
            updated_at=now_iso,
        )
        self.complaints.insert(0, new_complaint)
        self._save_to_storage()

        client = self._get_supabase_client()
        if client:
            try:
                client.table("complaints").insert({
                    "id": new_complaint.id,
                    "report_id": new_complaint.report_id,
                    "problem_type": new_complaint.problem_type,
                    "confidence": new_complaint.confidence,
                    "severity": new_complaint.severity,
                    "evidence": new_complaint.evidence,
                    "latitude": new_complaint.latitude,
                    "longitude": new_complaint.longitude,
                    "location_name": new_complaint.location_name,
                    "department": new_complaint.department,
                    "description": new_complaint.description,
                    "image_url": new_complaint.image_url,
                    "status": new_complaint.status,
                    "duplicate_of": new_complaint.duplicate_of,
                    "created_at": new_complaint.created_at,
                    "updated_at": new_complaint.updated_at,
                }).execute()
                logger.info(f"Inserted complaint {new_complaint.report_id} into Supabase")
            except Exception as se:
                logger.warning(f"Failed to insert complaint into Supabase: {se}")

        return new_complaint

    def get_heatmap_points(self) -> List[HeatmapPoint]:
        self._check_auto_reload()
        severity_weights = {
            "LOW": 0.35,
            "MEDIUM": 0.60,
            "HIGH": 0.85,
            "CRITICAL": 1.00,
        }
        return [
            HeatmapPoint(
                latitude=c.latitude,
                longitude=c.longitude,
                weight=severity_weights.get(c.severity, 0.5),
                problem_type=c.problem_type,
                severity=c.severity,
                report_id=c.report_id,
            )
            for c in self.complaints
            if c.latitude is not None and c.longitude is not None
        ]

    def get_statistics(self) -> DashboardStatistics:
        self._check_auto_reload()
        now_utc = datetime.now(timezone.utc)

        # Decorate all complaints with deterministic Phase 6 priority engine
        for c in self.complaints:
            score, level, explanation = compute_priority(c, self.complaints, now_utc)
            c.priority_score = score
            c.priority_level = level  # type: ignore
            c.priority_explanation = explanation

        total = len(self.complaints)
        high_critical = sum(1 for c in self.complaints if c.severity in ("HIGH", "CRITICAL"))
        pending = sum(1 for c in self.complaints if c.status == "REPORTED")
        in_prog = sum(1 for c in self.complaints if c.status in ("ASSIGNED", "IN_PROGRESS"))
        resolved = sum(1 for c in self.complaints if c.status == "RESOLVED")
        awaiting_verif = sum(
            1 for c in self.complaints
            if c.status == "RESOLVED" and (
                c.citizen_verification_status == "PENDING"
                or (c.citizen_resolution_confirmed is None and not c.citizen_reopened)
            )
        )
        reopened = sum(
            1 for c in self.complaints
            if c.status == "REOPENED" or c.citizen_reopened is True or c.citizen_verification_status == "REOPENED"
        )

        by_category = {"pothole": 0, "garbage": 0, "streetlight": 0, "drain": 0, "other": 0}
        for c in self.complaints:
            by_category[c.problem_type] = by_category.get(c.problem_type, 0) + 1

        by_severity = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for c in self.complaints:
            by_severity[c.severity] = by_severity.get(c.severity, 0) + 1

        by_status = {"REPORTED": 0, "ASSIGNED": 0, "IN_PROGRESS": 0, "RESOLVED": 0, "REOPENED": 0}
        for c in self.complaints:
            st = c.status.upper()
            by_status[st] = by_status.get(st, 0) + 1

        hotspots = calculate_hotspots(self.complaints)
        daily_trends = calculate_daily_trends(self.complaints)

        # Phase 6 Priority Actions: Most important unresolved complaints first
        unresolved = [c for c in self.complaints if c.status != "RESOLVED"]
        priority_actions = sorted(unresolved, key=lambda c: (c.priority_score or 0.0), reverse=True)[:10]

        aging_analysis = calculate_aging_analysis(self.complaints, now_utc)
        department_performance = calculate_department_performance(self.complaints, self.departments)
        category_trends = calculate_category_trends(self.complaints, now_utc)

        return DashboardStatistics(
            total_reports=total,
            high_critical=high_critical,
            pending=pending,
            in_progress=in_prog,
            resolved=resolved,
            awaiting_verification=awaiting_verif,
            reopened=reopened,
            by_category=by_category,
            by_severity=by_severity,
            by_status=by_status,
            hotspots=hotspots,
            daily_trends=daily_trends,
            priority_actions=priority_actions,
            aging_analysis=aging_analysis,
            department_performance=department_performance,
            category_trends=category_trends,
            governance_outcomes=calculate_governance_outcomes(self.complaints, len(self.get_escalations())),
            time_analytics=calculate_time_analytics(self.complaints),
        )

    def get_priority_actions(self, limit: int = 10) -> List[Complaint]:
        stats = self.get_statistics()
        return stats.priority_actions[:limit]

    def get_aging_analysis(self) -> AgingAnalysis:
        stats = self.get_statistics()
        return stats.aging_analysis or AgingAnalysis(total_unresolved=0, categories=[])

    def get_department_performance(self) -> List[DepartmentPerformance]:
        stats = self.get_statistics()
        return stats.department_performance

    def get_category_trends(self) -> List[CategoryTrend]:
        stats = self.get_statistics()
        return stats.category_trends

    def get_governance_outcomes(self) -> GovernanceOutcomes:
        self._check_auto_reload()
        return calculate_governance_outcomes(self.complaints, len(self.get_escalations()))

    def get_time_analytics(self) -> TimeBasedAnalytics:
        self._check_auto_reload()
        return calculate_time_analytics(self.complaints)

    def assign_complaint(
        self,
        complaint_id: str,
        department: str,
        assigned_to: str,
        note: Optional[str] = None,
        changed_by: Optional[str] = None,
    ) -> Optional[Complaint]:
        self._check_auto_reload()
        now_iso = datetime.now(timezone.utc).isoformat()
        updated_c = None

        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                prev_dept = c.department
                prev_assignee = c.assigned_to

                c.department = department
                c.assigned_to = assigned_to
                c.assigned_at = now_iso
                c.updated_at = now_iso

                # Transition REPORTED -> ASSIGNED
                if c.status == "REPORTED":
                    c.status = "ASSIGNED"

                actor_name = changed_by or "Municipal Authority Officer"

                record = AssignmentRecord(
                    id=str(uuid.uuid4()),
                    complaint_id=c.report_id,
                    previous_department=prev_dept,
                    new_department=department,
                    previous_assignee=prev_assignee,
                    new_assignee=assigned_to,
                    changed_by=actor_name,
                    timestamp=now_iso,
                    note=note,
                )
                c.assignment_history.append(record)

                note_detail = f"Assigned to {department} — Team/Officer: {assigned_to}"
                if note:
                    note_detail += f" ({note})"
                c.status_history.append(StatusHistoryItem(
                    status="ASSIGNED",
                    timestamp=now_iso,
                    note=note_detail,
                    actor=actor_name,
                    actor_role="authority",
                ))

                updated_c = c
                break

        if updated_c:
            self._save_to_storage()
            client = self._get_supabase_client()
            if client:
                try:
                    client.table("complaints").update({
                        "department": updated_c.department,
                        "status": updated_c.status,
                        "updated_at": now_iso,
                    }).eq("report_id", updated_c.report_id).execute()
                except Exception as se:
                    logger.warning(f"Could not sync assignment to Supabase: {se}")
            return updated_c
        return None

    def add_internal_note(
        self,
        complaint_id: str,
        note: str,
        author: Optional[str] = None,
        author_role: str = "authority",
    ) -> Optional[InternalNote]:
        self._check_auto_reload()
        now_iso = datetime.now(timezone.utc).isoformat()
        author_name = author or "Municipal Authority Officer"

        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                new_note = InternalNote(
                    id=str(uuid.uuid4()),
                    complaint_id=c.report_id,
                    author=author_name,
                    author_role=author_role,
                    note=note,
                    timestamp=now_iso,
                )
                c.internal_notes.append(new_note)
                c.updated_at = now_iso

                c.status_history.append(StatusHistoryItem(
                    status="INTERNAL_NOTE",
                    timestamp=now_iso,
                    note=f"Internal note: {note}",
                    actor=author_name,
                    actor_role=author_role,
                ))

                self._save_to_storage()
                return new_note
        return None

    def get_internal_notes(self, complaint_id: str) -> List[InternalNote]:
        self._check_auto_reload()
        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                return sorted(c.internal_notes, key=lambda n: n.timestamp)
        return []

    def create_status_update_request(
        self,
        complaint_id: str,
        citizen_message: Optional[str] = None,
    ) -> Optional[StatusUpdateRequestItem]:
        self._check_auto_reload()
        now_iso = datetime.now(timezone.utc).isoformat()

        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                req = StatusUpdateRequestItem(
                    id=str(uuid.uuid4()),
                    complaint_id=c.report_id,
                    issue_type=c.problem_type,
                    location_name=c.location_name,
                    current_status=c.status,
                    request_date=now_iso,
                    citizen_message=citizen_message,
                    state="OPEN",
                    citizen_notified=False,
                )
                c.status_update_requests.append(req)
                c.updated_at = now_iso

                c.status_history.append(StatusHistoryItem(
                    status="STATUS_UPDATE_REQUESTED",
                    timestamp=now_iso,
                    note="Citizen requested status update" + (f': "{citizen_message}"' if citizen_message else ""),
                    actor="Citizen User",
                    actor_role="citizen",
                ))

                self._save_to_storage()
                return req
        return None

    def acknowledge_status_update_request(
        self,
        complaint_id: str,
        request_id: str,
        acknowledged_by: Optional[str] = None,
        response_note: Optional[str] = None,
    ) -> Optional[StatusUpdateRequestItem]:
        self._check_auto_reload()
        now_iso = datetime.now(timezone.utc).isoformat()
        actor_name = acknowledged_by or "Municipal Authority Officer"

        for c in self.complaints:
            if c.id == complaint_id or c.report_id == complaint_id:
                for req in c.status_update_requests:
                    if req.id == request_id or request_id == "latest":
                        req.state = "ACKNOWLEDGED"
                        req.acknowledged_at = now_iso
                        req.acknowledged_by = actor_name
                        req.citizen_notified = True
                        req.response_note = response_note
                        c.updated_at = now_iso

                        note_text = f"Status update request acknowledged by {actor_name}"
                        if response_note:
                            note_text += f': "{response_note}"'
                        else:
                            note_text += " (Citizen notified)"

                        c.status_history.append(StatusHistoryItem(
                            status="STATUS_REQUEST_ACKNOWLEDGED",
                            timestamp=now_iso,
                            note=note_text,
                            actor=actor_name,
                            actor_role="authority",
                        ))

                        self._save_to_storage()
                        return req
        return None

    def list_status_update_requests(
        self,
        state: Optional[str] = None,
    ) -> List[StatusUpdateRequestItem]:
        self._check_auto_reload()
        requests: List[StatusUpdateRequestItem] = []

        for c in self.complaints:
            for req in c.status_update_requests:
                req.current_status = c.status
                if state:
                    if req.state.upper() == state.upper():
                        requests.append(req)
                else:
                    requests.append(req)

        requests.sort(key=lambda r: r.request_date, reverse=True)
        return requests

    def get_escalations(self) -> List[EscalationItem]:
        self._check_auto_reload()
        now_utc = datetime.now(timezone.utc)

        # Ensure priority scores and explanations are up-to-date using existing Phase 6 engine
        for c in self.complaints:
            score, level, explanation = compute_priority(c, self.complaints, now_utc)
            c.priority_score = score
            c.priority_level = level  # type: ignore
            c.priority_explanation = explanation

        hotspots = calculate_hotspots(self.complaints)
        hotspot_report_ids = set()
        hotspot_map = {}
        for hs in hotspots:
            if hs.total_reports >= 2:
                for rid in hs.report_ids:
                    hotspot_report_ids.add(rid)
                    hotspot_map[rid] = hs

        escalations: List[EscalationItem] = []

        for c in self.complaints:
            # Skip resolved complaints that have not been reopened
            if c.status == "RESOLVED" and not (c.citizen_reopened or c.status == "REOPENED"):
                continue

            reasons: List[str] = []

            # 1. Reopened complaint
            if c.status == "REOPENED" or c.citizen_reopened is True:
                if c.reopen_reason:
                    reasons.append(f"Reopened by citizen: {c.reopen_reason}")
                else:
                    reasons.append("Reopened by citizen")

            # 2. Aging 7+ days
            age_days = 0.0
            if c.created_at:
                try:
                    c_dt = datetime.fromisoformat(c.created_at.replace("Z", "+00:00"))
                    age_days = max(0.0, (now_utc - c_dt).total_seconds() / 86400.0)
                except Exception:
                    pass
            if age_days >= 7.0 and c.status != "RESOLVED":
                reasons.append(f"{int(age_days)}+ days unresolved")

            # 3. Status update request pending
            open_requests = [r for r in c.status_update_requests if r.state == "OPEN"]
            if open_requests:
                reasons.append(f"Citizen requested status update ({len(open_requests)} pending)")

            # 4. High / Critical priority
            if (c.priority_score or 0) >= 50.0 or c.severity in ("HIGH", "CRITICAL") or (c.priority_level or "") in ("HIGH", "CRITICAL"):
                reasons.append(f"High priority ({c.priority_level or c.severity} urgency)")

            # 5. Hotspot corridor
            if c.report_id in hotspot_report_ids:
                hs = hotspot_map[c.report_id]
                reasons.append(f"{hs.dominant_issue} (Hotspot corridor)")

            if reasons:
                escalations.append(EscalationItem(
                    complaint=c,
                    reasons=reasons,
                    primary_reason=reasons[0],
                    priority_score=c.priority_score or 0.0,
                    priority_level=c.priority_level or "MEDIUM",
                    days_unresolved=round(age_days, 1),
                    has_open_status_request=len(open_requests) > 0,
                    is_reopened=(c.status == "REOPENED" or c.citizen_reopened is True),
                    assigned_to=c.assigned_to,
                    department=c.department,
                ))

        # Sort escalations: highest priority score first, then days unresolved
        escalations.sort(key=lambda e: (e.priority_score, e.days_unresolved), reverse=True)
        return escalations


# Global singleton instance
data_store = CivicDataStore()
