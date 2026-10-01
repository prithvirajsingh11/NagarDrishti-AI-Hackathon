import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import db

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
    loc_name="Shivaji Nagar Ward 48",
    problem="pothole",
    lat=23.2350,
    lng=77.4180,
    severity="HIGH",
    desc="Dangerous crater on turning near bus stop, contact citizen 9876543210"
):
    payload = {
        "problem_type": problem,
        "confidence": 0.94,
        "severity": severity,
        "evidence": ["Asphalt crater depth 12cm"],
        "latitude": lat,
        "longitude": lng,
        "location_name": loc_name,
        "department": "Road Maintenance Division",
        "description": desc,
        "image_url": "/api/complaints/image/crater-pothole.jpg"
    }
    res = client.post("/api/complaints", json=payload, headers=citizen_token)
    assert res.status_code == 201
    return res.json()


# 1. Public complaint lookup succeeds without authentication
def test_public_complaint_status_lookup_without_auth():
    complaint = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Public anonymous request (no headers/token)
    res = client.get(f"/api/complaints/{report_id}/public-summary")
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == report_id
    assert data["problem_type"] == "pothole"
    assert data["status"] == "REPORTED"
    assert data["department"] == "Road Maintenance Division"
    assert data["location_name"] == "Shivaji Nagar Ward 48"
    assert "created_at" in data
    assert isinstance(data["timeline_events"], list)
    assert len(data["timeline_events"]) >= 1


# 2. Public lookup strictly omits citizen personal data and internal fields
def test_public_lookup_strictly_omits_pii_and_internal_data():
    complaint = _create_sample_complaint(
        citizen_token=CITIZEN_1_HEADERS,
        desc="Secret personal information with citizen contact prithvi@example.com"
    )
    report_id = complaint["report_id"]

    res = client.get(f"/api/complaints/{report_id}/public-summary")
    assert res.status_code == 200
    pub = res.json()

    # PII and private data omission guarantees
    assert "citizen_id" not in pub
    assert "email" not in pub
    assert "phone" not in pub
    assert "description" not in pub
    assert "evidence" not in pub
    assert "image_url" not in pub
    assert "token" not in pub
    assert "internal_notes" not in pub
    assert "officer_name" not in pub


# 3. Invalid or nonexistent report ID returns 404
def test_invalid_or_nonexistent_report_id_returns_404():
    res = client.get("/api/complaints/NGD-9999-99999/public-summary")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


# 4. Authenticated citizen ownership remains strictly protected on private endpoint
def test_authenticated_citizen_ownership_remains_protected():
    complaint = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Owner can access private report with description
    res_owner = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS)
    assert res_owner.status_code == 200
    assert "crater on turning" in res_owner.json()["description"]

    # Other citizen cannot access private report
    res_other = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_2_HEADERS)
    assert res_other.status_code == 403

    # Anonymous user cannot access private report
    res_anon = client.get(f"/api/complaints/{report_id}")
    assert res_anon.status_code == 401


# 5. Public lookup cannot expose internal notes or private resolution evidence
def test_public_lookup_cannot_expose_internal_notes_or_officer_details():
    complaint = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority updates status with internal note in database history
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=AUTHORITY_HEADERS
    )

    res = client.get(f"/api/complaints/{report_id}/public-summary")
    assert res.status_code == 200
    pub = res.json()

    assert pub["status"] == "IN_PROGRESS"
    # Verify no internal authority notes or officer IDs leaked
    assert "internal_notes" not in pub
    assert "officer_id" not in pub
    for event in pub["timeline_events"]:
        assert "officer" not in event.get("title", "").lower()


# 6. Reopened complaint displays correctly with public citizen reason
def test_reopened_complaint_displays_correctly():
    complaint = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Mark resolved by authority
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen reopens
    reopen_res = client.post(
        f"/api/complaints/{report_id}/reopen",
        json={"reason": "Asphalt patch washed away by rain"},
        headers=CITIZEN_1_HEADERS
    )
    assert reopen_res.status_code == 200

    # Public summary shows reopened state
    res = client.get(f"/api/complaints/{report_id}/public-summary")
    assert res.status_code == 200
    pub = res.json()

    assert pub["status"] == "REOPENED"
    assert pub["citizen_reopened"] is True
    assert pub["reopen_reason"] == "Asphalt patch washed away by rain"
    assert any(e["key"] == "REOPENED" for e in pub["timeline_events"])


# 7. Resolution verification state and factual response time display correctly
def test_resolution_verification_state_and_response_time():
    complaint = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority resolves
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen confirms resolution
    confirm_res = client.post(
        f"/api/complaints/{report_id}/confirm-resolution",
        headers=CITIZEN_1_HEADERS
    )
    assert confirm_res.status_code == 200

    # Public summary shows verified resolution state
    res = client.get(f"/api/complaints/{report_id}/public-summary")
    assert res.status_code == 200
    pub = res.json()

    assert pub["status"] == "RESOLVED"
    assert pub["citizen_resolution_confirmed"] is True
    assert pub["citizen_resolution_confirmed_at"] is not None
    assert pub["response_time_hours"] is not None
    assert pub["response_time_hours"] >= 0.0

    # Verification milestone is completed
    verified_event = next((e for e in pub["timeline_events"] if e["key"] == "CITIZEN_VERIFIED"), None)
    assert verified_event is not None
    assert verified_event["state"] == "completed"
