import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import db

client = TestClient(app)

CITIZEN_1_HEADERS = {"Authorization": "Bearer test-citizen-token"}
CITIZEN_2_HEADERS = {"Authorization": "Bearer test-citizen-token-2"}
AUTHORITY_HEADERS = {"Authorization": "Bearer test-authority-token"}


@pytest.fixture(autouse=True)
def clean_memory_db():
    db._memory_complaints = [
        c for c in db._memory_complaints if c.get("report_id") == "NGD-2026-00001"
    ]
    db._memory_status_history = []
    db._memory_notifications = []
    yield


def _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS, loc_name="Bhopal Station", problem="pothole"):
    payload = {
        "problem_type": problem,
        "confidence": 0.95,
        "severity": "HIGH",
        "evidence": ["Pothole with asphalt breakage"],
        "latitude": 23.2599,
        "longitude": 77.4126,
        "location_name": loc_name,
        "department": "Municipal Roads",
        "description": "Hazardous road issue.",
        "image_url": "/api/complaints/image/test-pothole.jpg"
    }
    res = client.post("/api/complaints", json=payload, headers=citizen_token)
    assert res.status_code == 201
    return res.json()


# 1. Citizen can only view their own complaints
def test_citizen_can_only_view_own_complaints():
    complaint_1 = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint_1["report_id"]

    # Citizen 1 can view
    res = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS)
    assert res.status_code == 200
    assert res.json()["report_id"] == report_id

    # Citizen 2 cannot view Citizen 1's complaint
    res_other = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_2_HEADERS)
    assert res_other.status_code == 403


# 2. Timeline reflects real status history
def test_timeline_reflects_real_status_history():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Move through statuses: ASSIGNED -> IN_PROGRESS -> RESOLVED
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "ASSIGNED"},
        headers=AUTHORITY_HEADERS
    )
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=AUTHORITY_HEADERS
    )
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/fixed.jpg"},
        headers=AUTHORITY_HEADERS
    )

    # Check history endpoint
    res_hist = client.get(f"/api/complaints/{report_id}/history", headers=CITIZEN_1_HEADERS)
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) >= 4
    statuses = [h["new_status"] for h in history]
    assert "REPORTED" in statuses
    assert "ASSIGNED" in statuses
    assert "IN_PROGRESS" in statuses
    assert "RESOLVED" in statuses


# 3. Resolution evidence is displayed correctly
def test_resolution_evidence_displayed_correctly():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]
    resolution_img = "/api/complaints/image/res-pic-101.jpg"

    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": resolution_img},
        headers=AUTHORITY_HEADERS
    )

    res = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESOLVED"
    assert data["resolution_image_url"] == resolution_img
    assert data["resolved_at"] is not None


# 4. Citizen can confirm a valid resolution
def test_citizen_can_confirm_valid_resolution():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/proof.jpg"},
        headers=AUTHORITY_HEADERS
    )

    res_confirm = client.post(f"/api/complaints/{report_id}/confirm-resolution", headers=CITIZEN_1_HEADERS)
    assert res_confirm.status_code == 200
    data = res_confirm.json()
    assert data["citizen_resolution_confirmed"] is True
    assert data["citizen_resolution_confirmed_at"] is not None


# 5. Citizen can reopen a valid complaint
def test_citizen_can_reopen_valid_complaint():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/proof.jpg"},
        headers=AUTHORITY_HEADERS
    )

    res_reopen = client.post(
        f"/api/complaints/{report_id}/reopen",
        json={"reason": "Pothole was only partially filled and broke open again."},
        headers=CITIZEN_1_HEADERS
    )
    assert res_reopen.status_code == 200
    data = res_reopen.json()
    assert data["status"] == "REOPENED"
    assert data["citizen_reopened"] is True
    assert "partially filled" in data["reopen_reason"]


# 6. Invalid duplicate verification actions are rejected
def test_invalid_duplicate_verification_actions_rejected():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/proof.jpg"},
        headers=AUTHORITY_HEADERS
    )

    # First confirmation succeeds
    res_1 = client.post(f"/api/complaints/{report_id}/confirm-resolution", headers=CITIZEN_1_HEADERS)
    assert res_1.status_code == 200

    # Duplicate confirmation rejected
    res_dup = client.post(f"/api/complaints/{report_id}/confirm-resolution", headers=CITIZEN_1_HEADERS)
    assert res_dup.status_code == 400
    assert "already been confirmed" in res_dup.json()["detail"].lower()

    # Reopening after confirmed resolution is rejected
    res_reopen_conflict = client.post(
        f"/api/complaints/{report_id}/reopen",
        json={"reason": "Trying to reopen after confirmation"},
        headers=CITIZEN_1_HEADERS
    )
    assert res_reopen_conflict.status_code == 400


# 7. My Reports filters only the authenticated user's reports
def test_my_reports_filters_only_authenticated_users_reports():
    _create_sample_complaint(CITIZEN_1_HEADERS, loc_name="Location A", problem="pothole")
    _create_sample_complaint(CITIZEN_2_HEADERS, loc_name="Location B", problem="garbage")

    # Citizen 1 queries their reports
    res_1 = client.get("/api/complaints", headers=CITIZEN_1_HEADERS)
    assert res_1.status_code == 200
    c1_reports = res_1.json()
    for r in c1_reports:
        assert r["citizen_id"] == "11111111-1111-1111-1111-111111111111"

    # Citizen 2 queries their reports
    res_2 = client.get("/api/complaints", headers=CITIZEN_2_HEADERS)
    assert res_2.status_code == 200
    c2_reports = res_2.json()
    for r in c2_reports:
        assert r["citizen_id"] == "33333333-3333-3333-3333-333333333333"


# 8. Notifications correspond only to real complaint events
def test_notifications_correspond_only_to_real_complaint_events():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority updates complaint
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "ASSIGNED"},
        headers=AUTHORITY_HEADERS
    )

    res_notif = client.get("/api/notifications", headers=CITIZEN_1_HEADERS)
    assert res_notif.status_code == 200
    notifs = res_notif.json()
    assert len(notifs) >= 1
    # Notifications should reference the created report_id
    assert any(report_id in n["report_id"] or report_id in n["message"] for n in notifs)

    # Citizen 2 sees 0 notifications for Citizen 1's complaint
    res_notif_2 = client.get("/api/notifications", headers=CITIZEN_2_HEADERS)
    assert res_notif_2.status_code == 200
    assert not any(report_id in n["report_id"] for n in res_notif_2.json())


# 9. Unauthenticated users cannot access protected complaint data
def test_unauthenticated_users_cannot_access_protected_complaint_data():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    res_list = client.get("/api/complaints")
    assert res_list.status_code in [401, 403]

    res_get = client.get(f"/api/complaints/{report_id}")
    assert res_get.status_code in [401, 403]

    res_notif = client.get("/api/notifications")
    assert res_notif.status_code in [401, 403]

    res_impact = client.get("/api/complaints/my-impact")
    assert res_impact.status_code in [401, 403]


# 10. No authority-only endpoint becomes accessible to citizens
def test_no_authority_only_endpoint_becomes_accessible_to_citizens():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Citizen tries to directly alter complaint status
    res = client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED"},
        headers=CITIZEN_1_HEADERS
    )
    assert res.status_code == 403
    assert "authority" in res.json()["detail"].lower()


# 11. Civic impact endpoint calculates authenticated citizen impact accurately
def test_citizen_impact_endpoint():
    # Citizen 1 creates 2 complaints
    c1 = _create_sample_complaint(CITIZEN_1_HEADERS)
    c2 = _create_sample_complaint(CITIZEN_1_HEADERS)

    # Authority resolves one
    client.patch(
        f"/api/complaints/{c1['report_id']}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/done.jpg"},
        headers=AUTHORITY_HEADERS
    )

    res = client.get("/api/complaints/my-impact", headers=CITIZEN_1_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["total_submitted"] >= 2
    assert data["resolved_count"] >= 1
    assert data["reported_count"] >= 1
