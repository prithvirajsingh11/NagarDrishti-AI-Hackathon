import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import db
from app.core.config import settings

client = TestClient(app)

CITIZEN_1_HEADERS = {"Authorization": "Bearer test-citizen-token"}
CITIZEN_2_HEADERS = {"Authorization": "Bearer test-citizen-token-2"}
AUTHORITY_HEADERS = {"Authorization": "Bearer test-authority-token"}


@pytest.fixture(autouse=True)
def clean_memory_db():
    db._memory_complaints = []
    db._memory_status_history = []
    db._memory_notifications = []
    db._memory_status_requests = []
    yield


def _create_sample_complaint(
    citizen_token=CITIZEN_1_HEADERS,
    loc_name="Arera Colony",
    problem="pothole",
    lat=23.2300,
    lng=77.4200,
    severity="HIGH",
    desc="Dangerous road crater near market"
):
    payload = {
        "problem_type": problem,
        "confidence": 0.95,
        "severity": severity,
        "evidence": ["Pothole with broken edge"],
        "latitude": lat,
        "longitude": lng,
        "location_name": loc_name,
        "department": "Municipal Roads",
        "description": desc,
        "image_url": "/api/complaints/image/test-pothole.jpg"
    }
    res = client.post("/api/complaints", json=payload, headers=citizen_token)
    assert res.status_code == 201
    return res.json()


# 1. Nearby reports return privacy-safe information (no citizen identity, rounded coordinates)
def test_nearby_reports_return_privacy_safe_information():
    complaint = _create_sample_complaint(
        citizen_token=CITIZEN_1_HEADERS,
        loc_name="Arera Colony E-3",
        problem="pothole",
        lat=23.2312345,
        lng=77.4256789,
        desc="Extremely private citizen description with phone 9876543210"
    )

    res = client.get("/api/nearby/issues", headers=CITIZEN_1_HEADERS)
    assert res.status_code == 200
    issues = res.json()
    assert len(issues) >= 1

    target = next((i for i in issues if i["report_id"] == complaint["report_id"]), None)
    assert target is not None

    # Safe fields present
    assert target["report_id"] == complaint["report_id"]
    assert target["problem_type"] == "pothole"
    assert target["severity"] == "HIGH"
    assert target["status"] == "REPORTED"
    assert target["location_name"] == "Arera Colony E-3"
    assert "created_at" in target

    # Approximate coordinates rounded to 3 decimal places (~110m)
    assert target["latitude"] == round(23.2312345, 3)
    assert target["longitude"] == round(77.4256789, 3)

    # Privacy verification: Strict PII omission
    assert "citizen_id" not in target
    assert "description" not in target
    assert "phone" not in target
    assert "email" not in target
    assert "evidence" not in target


# 2. Citizen cannot access another citizen's private complaint information
def test_citizen_cannot_access_another_citizens_private_data():
    complaint_1 = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = complaint_1["report_id"]

    # Citizen 1 can access full report
    res_owner = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS)
    assert res_owner.status_code == 200
    assert res_owner.json()["description"] == "Dangerous road crater near market"

    # Citizen 2 cannot access Citizen 1's private report
    res_other = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_2_HEADERS)
    assert res_other.status_code == 403

    # Citizen 2 cannot view status requests for Citizen 1's report
    res_reqs = client.get(f"/api/complaints/{report_id}/status-requests", headers=CITIZEN_2_HEADERS)
    assert res_reqs.status_code == 403


# 3. Similar-report detection works by category + proximity + recency
def test_similar_report_detection_by_category_proximity_and_recency():
    # Report at Arera Colony (23.2300, 77.4200)
    complaint = _create_sample_complaint(
        citizen_token=CITIZEN_1_HEADERS,
        problem="pothole",
        lat=23.2300,
        lng=77.4200
    )

    # Matching category nearby (~200m away)
    res_match = client.get(
        "/api/complaints/similar?problem_type=pothole&latitude=23.2315&longitude=77.4210&radius_km=1.0",
        headers=CITIZEN_1_HEADERS
    )
    assert res_match.status_code == 200
    matches = res_match.json()
    assert len(matches) == 1
    assert matches[0]["report_id"] == complaint["report_id"]
    assert matches[0]["distance_meters"] > 0
    assert "citizen_id" not in matches[0]

    # Non-matching category (garbage vs pothole)
    res_diff_cat = client.get(
        "/api/complaints/similar?problem_type=garbage&latitude=23.2315&longitude=77.4210&radius_km=1.0",
        headers=CITIZEN_1_HEADERS
    )
    assert res_diff_cat.status_code == 200
    assert len(res_diff_cat.json()) == 0

    # Distant location (>50km away)
    res_far = client.get(
        "/api/complaints/similar?problem_type=pothole&latitude=23.8000&longitude=77.9000&radius_km=1.0",
        headers=CITIZEN_1_HEADERS
    )
    assert res_far.status_code == 200
    assert len(res_far.json()) == 0


# 4. Citizen can still submit a report despite similar reports
def test_citizen_can_still_submit_report_despite_similar_reports():
    # First report
    comp_1 = _create_sample_complaint(
        citizen_token=CITIZEN_1_HEADERS,
        problem="pothole",
        lat=23.2300,
        lng=77.4200
    )

    # Citizen 2 detects similar issue
    similar_res = client.get(
        "/api/complaints/similar?problem_type=pothole&latitude=23.2302&longitude=77.4201&radius_km=1.0",
        headers=CITIZEN_2_HEADERS
    )
    assert similar_res.status_code == 200
    assert len(similar_res.json()) >= 1

    # Citizen 2 submits anyway
    comp_2 = _create_sample_complaint(
        citizen_token=CITIZEN_2_HEADERS,
        problem="pothole",
        lat=23.2302,
        lng=77.4201,
        desc="I also observed this pothole, causing major congestion."
    )
    assert comp_2["report_id"] != comp_1["report_id"]
    assert comp_2["status"] == "REPORTED"


# 5. Status update request requires ownership
def test_status_update_request_requires_ownership():
    comp = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = comp["report_id"]

    # Citizen 2 attempts status update on Citizen 1's complaint
    res = client.post(
        f"/api/complaints/{report_id}/status-request",
        json={"message": "Please fix this soon."},
        headers=CITIZEN_2_HEADERS
    )
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]


def _backdate_complaint(report_id: str, hours: int = 50):
    old_time = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    for c in db._memory_complaints:
        if c.get("report_id") == report_id:
            c["created_at"] = old_time
            c["updated_at"] = old_time
            cid = c.get("id")
            for h in db._memory_status_history:
                if h.get("complaint_id") == cid or h.get("complaint_id") == report_id:
                    h["created_at"] = old_time


# 6. Duplicate status requests are rejected and cooldown protected
def test_duplicate_status_requests_and_cooldown_protected():
    comp = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = comp["report_id"]

    # Backdate complaint creation to simulate >48 hours of inactivity
    _backdate_complaint(report_id, hours=50)

    # 1st request succeeds
    res1 = client.post(
        f"/api/complaints/{report_id}/status-request",
        json={"message": "Any updates on road repair?"},
        headers=CITIZEN_1_HEADERS
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["report_id"] == report_id
    assert data1["status"] == "PENDING"
    assert data1["message"] == "Any updates on road repair?"

    # 2nd immediate request rejected because one is already PENDING
    res2 = client.post(
        f"/api/complaints/{report_id}/status-request",
        json={"message": "Spam follow up"},
        headers=CITIZEN_1_HEADERS
    )
    assert res2.status_code == 400
    assert "already pending" in res2.json()["detail"]

    # Mark the first request as REVIEWED, test cooldown protection
    for r in db._memory_status_requests:
        if r.get("report_id") == report_id:
            r["status"] = "REVIEWED"

    res3 = client.post(
        f"/api/complaints/{report_id}/status-request",
        json={"message": "Follow up after review"},
        headers=CITIZEN_1_HEADERS
    )
    assert res3.status_code == 400
    assert "cooldown active" in res3.json()["detail"]


# 7. Authority receives the status request
def test_authority_receives_status_request():
    comp = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = comp["report_id"]

    # Inactivity backdate
    _backdate_complaint(report_id, hours=60)

    # Submit status request
    req_res = client.post(
        f"/api/complaints/{report_id}/status-request",
        json={"message": "Monsoon is starting, drain overflowing."},
        headers=CITIZEN_1_HEADERS
    )
    assert req_res.status_code == 200

    # Authority retrieves status requests
    auth_res = client.get(
        f"/api/complaints/{report_id}/status-requests",
        headers=AUTHORITY_HEADERS
    )
    assert auth_res.status_code == 200
    requests = auth_res.json()
    assert len(requests) >= 1
    target = requests[0]
    assert target["report_id"] == report_id
    assert target["message"] == "Monsoon is starting, drain overflowing."
    assert target["status"] == "PENDING"
    assert target["problem_type"] == "pothole"


# 8. My Civic Activity uses real factual values
def test_my_civic_activity_uses_real_factual_values():
    # Citizen 1 creates 2 complaints
    c1 = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS, problem="pothole")
    c2 = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS, problem="garbage")

    # Inactivity backdate for c1 and create a status request
    _backdate_complaint(c1["report_id"], hours=72)

    res_sr = client.post(
        f"/api/complaints/{c1['report_id']}/status-request",
        json={"message": "Status check"},
        headers=CITIZEN_1_HEADERS
    )
    assert res_sr.status_code == 200

    # Authority resolves c2
    client.patch(
        f"/api/complaints/{c2['report_id']}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen 1 queries impact summary
    impact_res = client.get("/api/complaints/my-impact", headers=CITIZEN_1_HEADERS)
    assert impact_res.status_code == 200
    data = impact_res.json()

    assert data["total_submitted"] == 2
    assert data["active_reports"] == 1
    assert data["resolved_count"] == 1
    assert data["pending_status_requests"] == 1


# 9. Unauthenticated users cannot use protected features
def test_unauthenticated_users_cannot_use_protected_features():
    # Nearby issues requires auth
    res1 = client.get("/api/nearby/issues")
    assert res1.status_code == 401

    # Similar check requires auth
    res2 = client.get("/api/complaints/similar?problem_type=pothole&latitude=23.2&longitude=77.4")
    assert res2.status_code == 401

    # Status request requires auth
    res3 = client.post("/api/complaints/NGD-2026-00001/status-request", json={})
    assert res3.status_code == 401

    # My impact requires auth
    res4 = client.get("/api/complaints/my-impact")
    assert res4.status_code == 401


# 10. Nearby issue filters work by category and status
def test_nearby_issue_filters():
    _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS, problem="pothole", severity="HIGH")
    c_garb = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS, problem="garbage", severity="MEDIUM")

    # Mark garbage as resolved
    client.patch(
        f"/api/complaints/{c_garb['report_id']}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )

    # Filter by category: pothole only
    res_pothole = client.get("/api/nearby/issues?category=pothole", headers=CITIZEN_1_HEADERS)
    assert res_pothole.status_code == 200
    for issue in res_pothole.json():
        assert issue["problem_type"] == "pothole"

    # Filter by status: RESOLVED only
    res_resolved = client.get("/api/nearby/issues?status=RESOLVED", headers=CITIZEN_1_HEADERS)
    assert res_resolved.status_code == 200
    resolved_issues = res_resolved.json()
    assert len(resolved_issues) >= 1
    assert any(i["report_id"] == c_garb["report_id"] for i in resolved_issues)
    assert all(i["status"] == "RESOLVED" for i in resolved_issues)
