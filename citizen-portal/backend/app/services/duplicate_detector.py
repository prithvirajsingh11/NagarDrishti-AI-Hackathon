import math
from datetime import datetime, timezone
from typing import Dict, List, Optional

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lon coordinates using Haversine formula."""
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class DuplicateDetector:
    """
    Duplicate detector for civic reports.
    Baseline criteria:
    - Same problem category
    - Nearby location (within threshold distance, e.g., 100 meters)
    - Recent report (e.g., within 48 hours)
    """

    DUPLICATE_DISTANCE_METERS = 100.0
    DUPLICATE_TIME_WINDOW_HOURS = 48.0

    @classmethod
    def check_duplicate(
        cls, 
        new_category: str, 
        new_lat: float, 
        new_lng: float, 
        existing_reports: List[Dict]
    ) -> Optional[str]:
        """
        Returns report_id of potential duplicate if found, else None.
        """
        now = datetime.now(timezone.utc)

        for report in existing_reports:
            # Skip resolved reports
            if report.get("status") == "RESOLVED":
                continue

            # Must match category
            if report.get("problem_type") != new_category:
                continue

            # Check distance
            r_lat = report.get("latitude")
            r_lng = report.get("longitude")
            if r_lat is None or r_lng is None:
                continue

            dist = haversine_distance_meters(new_lat, new_lng, r_lat, r_lng)
            if dist > cls.DUPLICATE_DISTANCE_METERS:
                continue

            # Check time window
            created_at = report.get("created_at")
            if created_at:
                if isinstance(created_at, str):
                    try:
                        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    except Exception:
                        dt = now
                elif isinstance(created_at, datetime):
                    dt = created_at
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                else:
                    dt = now

                hours_diff = (now - dt).total_seconds() / 3600.0
                if hours_diff <= cls.DUPLICATE_TIME_WINDOW_HOURS:
                    return report.get("report_id")

        return None
