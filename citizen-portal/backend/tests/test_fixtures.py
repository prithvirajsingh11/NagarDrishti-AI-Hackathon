"""
Test fixtures for NagarDrishti AI automated tests.
Isolated strictly to tests, never loaded in production runtime.
"""
from datetime import datetime, timedelta, timezone

now_utc = datetime.now(timezone.utc)

def _dt_offset(days: int, hours: int = 0) -> str:
    return (now_utc - timedelta(days=days, hours=hours)).isoformat()

INITIAL_DEMO_COMPLAINTS = [
    {
        "id": "c001",
        "report_id": "NGD-2026-00101",
        "problem_type": "pothole",
        "confidence": 0.94,
        "severity": "HIGH",
        "evidence": ["Large cavity visible in active road lane", "Cracked asphalt with water pooling"],
        "latitude": 28.6315,
        "longitude": 77.2167,
        "location_name": "Connaught Place Outer Circle near Radial 2",
        "department": "Municipal Roads",
        "description": "Hazardous pothole causing two-wheeler skids near metro gate.",
        "image_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60",
        "status": "REPORTED",
        "duplicate_of": None,
        "citizen_id": "11111111-1111-1111-1111-111111111111",
        "created_at": _dt_offset(3, 4),
        "updated_at": _dt_offset(3, 4)
    },
    {
        "id": "c005",
        "report_id": "NGD-2026-00105",
        "problem_type": "pothole",
        "confidence": 0.82,
        "severity": "MEDIUM",
        "evidence": ["Asphalt wear and shallow road rutting"],
        "latitude": 28.6322,
        "longitude": 77.2175,
        "location_name": "Near Shivaji Stadium Terminal",
        "department": "Municipal Roads",
        "description": "Road surface cracking and minor pothole developing.",
        "image_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60",
        "status": "RESOLVED",
        "duplicate_of": None,
        "citizen_id": "11111111-1111-1111-1111-111111111111",
        "created_at": _dt_offset(5, 6),
        "updated_at": _dt_offset(1, 2)
    },
    {
        "id": "c008",
        "report_id": "NGD-2026-00108",
        "problem_type": "pothole",
        "confidence": 0.91,
        "severity": "CRITICAL",
        "evidence": ["Deep road collapse cave-in exposing base gravel", "Severe vehicular obstruction"],
        "latitude": 28.6310,
        "longitude": 77.2160,
        "location_name": "Radial Road 3, Connaught Place",
        "department": "Municipal Roads",
        "description": "Cave-in on inner lane, traffic backed up.",
        "image_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60",
        "status": "IN_PROGRESS",
        "duplicate_of": None,
        "citizen_id": "22222222-2222-2222-2222-222222222222",
        "created_at": _dt_offset(1, 8),
        "updated_at": _dt_offset(0, 4)
    }
]
