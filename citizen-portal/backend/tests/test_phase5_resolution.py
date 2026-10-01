import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import app
from app.core.database import db

client = TestClient(app)

CITIZEN_1_HEADERS = {"Authorization": "Bearer test-citizen-token"}
CITIZEN_2_HEADERS = {"Authorization": "Bearer test-citizen-token-2"}
AUTHORITY_HEADERS = {"Authorization": "Bearer test-authority-token"}


@pytest.fixture(autouse=True)
def clean_memory_db():
    # Keep only the live production record or clean memory store
    db._memory_complaints = [
        c for c in db._memory_complaints if c.get("report_id") == "NGD-2026-00001"
    ]
    yield


def _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS, loc_name="Bhopal Junction", problem="pothole"):
    payload = {
        "problem_type": problem,
        "confidence": 0.94,
        "severity": "HIGH",
        "evidence": ["Deep cavity in road"],
        "latitude": 23.2599,
        "longitude": 77.4126,
        "location_name": loc_name,
        "department": "Municipal Roads",
        "description": "Hazardous road depression near bus terminal.",
        "image_url": "/api/complaints/image/test-pothole-img.jpg"
    }
    res = client.post("/api/complaints", json=payload, headers=citizen_token)
    assert res.status_code == 201
    return res.json()


# 1. Citizen can view own complaint status
def test_citizen_can_view_own_complaint_status():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    res = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["report_id"] == report_id
    assert data["status"] == "REPORTED"
    assert data["citizen_id"] == "11111111-1111-1111-1111-111111111111"


# 2. Citizen cannot view another citizen's complaint
def test_citizen_cannot_view_another_citizens_complaint():
    complaint_1 = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint_1["report_id"]

    # Citizen 2 attempts to access Citizen 1's complaint
    res = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_2_HEADERS)
    assert res.status_code == 403
    assert "not authorized" in res.json()["detail"].lower()


# 3. Resolved complaint shows resolution evidence
def test_resolved_complaint_shows_resolution_evidence():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority marks complaint as RESOLVED with resolution image
    resolution_img = "/api/complaints/image/resolution-evidence-123.jpg"
    res_auth = client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": resolution_img},
        headers=AUTHORITY_HEADERS
    )
    assert res_auth.status_code == 200
    auth_data = res_auth.json()
    assert auth_data["status"] == "RESOLVED"
    assert auth_data["resolution_image_url"] == resolution_img
    assert auth_data["resolved_at"] is not None

    # Citizen views the resolved complaint
    res_cit = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS)
    assert res_cit.status_code == 200
    cit_data = res_cit.json()
    assert cit_data["status"] == "RESOLVED"
    assert cit_data["resolution_image_url"] == resolution_img
    assert cit_data["resolved_at"] is not None
    # Original image remains untouched
    assert cit_data["image_url"] == complaint["image_url"]


# 4. Citizen can confirm resolution
def test_citizen_can_confirm_resolution():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority marks RESOLVED
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/res-ok.jpg"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen confirms resolution
    res_confirm = client.post(
        f"/api/complaints/{report_id}/confirm-resolution",
        headers=CITIZEN_1_HEADERS
    )
    assert res_confirm.status_code == 200
    data = res_confirm.json()
    assert data["citizen_resolution_confirmed"] is True
    assert data["citizen_resolution_confirmed_at"] is not None
    assert data["citizen_reopened"] is False


# 5. Citizen cannot confirm another citizen's complaint
def test_citizen_cannot_confirm_another_citizens_complaint():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority marks RESOLVED
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen 2 attempts to confirm Citizen 1's complaint
    res = client.post(
        f"/api/complaints/{report_id}/confirm-resolution",
        headers=CITIZEN_2_HEADERS
    )
    assert res.status_code == 403


# 6. Citizen can submit reopen request
def test_citizen_can_submit_reopen_request():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # Authority marks RESOLVED
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": "/api/complaints/image/paving-done.jpg"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen reopens complaint
    reopen_reason = "Asphalt is still sinking and pothole rim is cracked."
    res_reopen = client.post(
        f"/api/complaints/{report_id}/reopen",
        json={"reason": reopen_reason},
        headers=CITIZEN_1_HEADERS
    )
    assert res_reopen.status_code == 200
    data = res_reopen.json()
    assert data["status"] == "REOPENED"
    assert data["citizen_reopened"] is True
    assert data["citizen_reopened_at"] is not None
    assert data["reopen_reason"] == reopen_reason
    assert data["citizen_resolution_confirmed"] is False


# 7. Reopen preserves resolution history
def test_reopen_preserves_resolution_history():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]
    original_img = complaint["image_url"]
    original_evidence = complaint["evidence"]

    resolution_img = "/api/complaints/image/prior-repair.jpg"
    client.patch(
        f"/api/complaints/{report_id}/status",
        json={"status": "RESOLVED", "resolution_image_url": resolution_img},
        headers=AUTHORITY_HEADERS
    )

    # Fetch resolved timestamp
    res_before = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS).json()
    resolved_at = res_before["resolved_at"]
    assert resolved_at is not None

    # Reopen
    client.post(
        f"/api/complaints/{report_id}/reopen",
        json={"reason": "Water is still pooling in the crater."},
        headers=CITIZEN_1_HEADERS
    )

    # Fetch reopened complaint
    res_after = client.get(f"/api/complaints/{report_id}", headers=CITIZEN_1_HEADERS).json()
    assert res_after["status"] == "REOPENED"
    # Preserved evidence and analysis
    assert res_after["image_url"] == original_img
    assert res_after["evidence"] == original_evidence
    assert res_after["problem_type"] == complaint["problem_type"]
    assert res_after["confidence"] == complaint["confidence"]
    # Preserved resolution history
    assert res_after["resolution_image_url"] == resolution_img
    assert res_after["resolved_at"] == resolved_at
    # Added reopen audit
    assert res_after["citizen_reopened"] is True
    assert res_after["citizen_reopened_at"] is not None
    assert res_after["reopen_reason"] == "Water is still pooling in the crater."


# 8. Duplicate information does not expose personal data
def test_duplicate_public_summary_sanitized():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS, loc_name="MP Nagar Zone 1, Bhopal")
    report_id = complaint["report_id"]

    # Access public summary
    res = client.get(f"/api/complaints/{report_id}/public-summary", headers=CITIZEN_2_HEADERS)
    assert res.status_code == 200
    pub = res.json()
    assert pub["report_id"] == report_id
    assert pub["problem_type"] == "pothole"
    assert pub["location_name"] == "MP Nagar Zone 1, Bhopal"
    assert pub["status"] == "REPORTED"
    assert "created_at" in pub
    # Strict privacy assertions: NO personal info returned
    assert "citizen_id" not in pub
    assert "email" not in pub
    assert "name" not in pub
    assert "phone" not in pub
    assert "description" not in pub


# 9. Unauthorized requests are rejected
def test_unauthorized_requests_rejected():
    complaint = _create_sample_complaint(CITIZEN_1_HEADERS)
    report_id = complaint["report_id"]

    # No token at all -> 401
    res_anon_get = client.get(f"/api/complaints/{report_id}")
    assert res_anon_get.status_code == 401

    res_anon_confirm = client.post(f"/api/complaints/{report_id}/confirm-resolution")
    assert res_anon_confirm.status_code == 401

    res_anon_reopen = client.post(f"/api/complaints/{report_id}/reopen")
    assert res_anon_reopen.status_code == 401

    # Cannot confirm or reopen non-resolved complaints -> 400
    res_bad_confirm = client.post(
        f"/api/complaints/{report_id}/confirm-resolution",
        headers=CITIZEN_1_HEADERS
    )
    assert res_bad_confirm.status_code == 400
    assert "only resolved" in res_bad_confirm.json()["detail"].lower()
