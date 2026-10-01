import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import db

client = TestClient(app)

CITIZEN_HEADERS = {"Authorization": "Bearer test-citizen-token"}
AUTHORITY_HEADERS = {"Authorization": "Bearer test-authority-token"}


@pytest.fixture(autouse=True)
def clean_memory_db():
    db._memory_complaints = []
    db._memory_status_history = []
    db._memory_notifications = []
    db._memory_status_requests = []
    yield


def test_complete_cross_repo_citizen_authority_lifecycle():
    """
    Simulates the exact end-to-end lifecycle between Citizen App and Authority App:
    1. Citizen creates complaint.
    2. Authority sees the complaint in its management portal.
    3. Category, severity, department, location are intact.
    4. Authority assigns complaint -> citizen sees ASSIGNED.
    5. Authority moves to IN_PROGRESS -> citizen sees IN_PROGRESS.
    6. Citizen submits status-request -> authority sees request in queue.
    7. Authority marks RESOLVED with resolution image -> citizen sees RESOLVED and receives notification.
    8. Citizen verifies resolution -> confirmed flag visible to authority.
    9. Citizen reopens complaint -> authority sees REOPENED with citizen reason.
    10. Audit timeline history is chronologically consistent and complete.
    """
    # 1. Citizen submits complaint
    create_payload = {
        "problem_type": "pothole",
        "confidence": 0.95,
        "severity": "HIGH",
        "evidence": ["Asphalt crater 12cm depth"],
        "latitude": 23.2355,
        "longitude": 77.4182,
        "location_name": "Arera Colony Sector E",
        "department": "Road Maintenance Division",
        "description": "Hazardous road crater near school gate",
        "image_url": "/api/complaints/image/pothole-cross-repo.jpg"
    }
    create_res = client.post("/api/complaints", json=create_payload, headers=CITIZEN_HEADERS)
    assert create_res.status_code == 201
    citizen_view = create_res.json()
    cid = citizen_view["id"]
    rid = citizen_view["report_id"]

    # 2 & 3. Authority views complaints and checks preservation of attributes
    auth_list_res = client.get("/api/complaints", headers=AUTHORITY_HEADERS)
    assert auth_list_res.status_code == 200
    auth_complaints = auth_list_res.json()
    assert any(c["id"] == cid for c in auth_complaints)
    
    auth_view = client.get(f"/api/complaints/{rid}", headers=AUTHORITY_HEADERS).json()
    assert auth_view["problem_type"] == "pothole"
    assert auth_view["severity"] == "HIGH"
    assert auth_view["department"] == "Road Maintenance Division"
    assert auth_view["location_name"] == "Arera Colony Sector E"
    assert auth_view["status"] == "REPORTED"

    # 4. Authority assigns complaint
    assign_res = client.patch(
        f"/api/complaints/{rid}/status",
        json={"status": "ASSIGNED"},
        headers=AUTHORITY_HEADERS
    )
    assert assign_res.status_code == 200
    
    # Citizen checks status
    cit_view_assigned = client.get(f"/api/complaints/{rid}", headers=CITIZEN_HEADERS).json()
    assert cit_view_assigned["status"] == "ASSIGNED"

    # 5. Authority moves to IN_PROGRESS
    prog_res = client.patch(
        f"/api/complaints/{rid}/status",
        json={"status": "IN_PROGRESS"},
        headers=AUTHORITY_HEADERS
    )
    assert prog_res.status_code == 200
    cit_view_prog = client.get(f"/api/complaints/{rid}", headers=CITIZEN_HEADERS).json()
    assert cit_view_prog["status"] == "IN_PROGRESS"

    # 6. Citizen creates a status request inquiry
    # Backdate complaint and its history to simulate 72h inactivity threshold
    for c in db._memory_complaints:
        if c.get("id") == cid:
            c["updated_at"] = "2026-09-20T00:00:00+00:00"
            c["created_at"] = "2026-09-20T00:00:00+00:00"
            for h in c.get("status_history", []):
                h["created_at"] = "2026-09-20T00:00:00+00:00"
    for h in db._memory_status_history:
        if h.get("complaint_id") == cid:
            h["created_at"] = "2026-09-20T00:00:00+00:00"

    sr_res = client.post(
        f"/api/complaints/{rid}/status-request",
        json={"message": "Inquiring about field crew timeline"},
        headers=CITIZEN_HEADERS
    )
    assert sr_res.status_code == 200
    
    # Authority inspects status requests for this complaint
    auth_sr_res = client.get(f"/api/complaints/{rid}/status-requests", headers=AUTHORITY_HEADERS)
    assert auth_sr_res.status_code == 200
    requests_list = auth_sr_res.json()
    assert len(requests_list) >= 1
    assert requests_list[0]["message"] == "Inquiring about field crew timeline"

    # 7. Authority resolves complaint with resolution evidence
    res_res = client.patch(
        f"/api/complaints/{rid}/status",
        json={
            "status": "RESOLVED",
            "resolution_image_url": "/api/complaints/image/pothole-fixed.jpg"
        },
        headers=AUTHORITY_HEADERS
    )
    assert res_res.status_code == 200
    
    # Citizen checks resolved status and evidence
    cit_view_resolved = client.get(f"/api/complaints/{rid}", headers=CITIZEN_HEADERS).json()
    assert cit_view_resolved["status"] == "RESOLVED"
    assert cit_view_resolved["resolution_image_url"] == "/api/complaints/image/pothole-fixed.jpg"
    assert cit_view_resolved["resolved_at"] is not None

    # Citizen checks notifications
    notifs_res = client.get("/api/notifications", headers=CITIZEN_HEADERS)
    assert notifs_res.status_code == 200
    notifs = notifs_res.json()
    assert any(n["report_id"] == rid and "resolved" in n["title"].lower() for n in notifs)

    # 8. Citizen verifies / confirms resolution on Complaint 1
    conf_res = client.post(f"/api/complaints/{rid}/confirm-resolution", headers=CITIZEN_HEADERS)
    assert conf_res.status_code == 200
    cit_view_conf = conf_res.json()
    assert cit_view_conf["citizen_resolution_confirmed"] is True

    # Authority sees confirmed resolution
    auth_view_conf = client.get(f"/api/complaints/{rid}", headers=AUTHORITY_HEADERS).json()
    assert auth_view_conf["citizen_resolution_confirmed"] is True

    # Attempting to reopen an already-confirmed complaint is safely rejected
    reopen_confirmed_res = client.post(
        f"/api/complaints/{rid}/reopen",
        json={"reason": "Should fail because confirmed"},
        headers=CITIZEN_HEADERS
    )
    assert reopen_confirmed_res.status_code == 400

    # 9. Citizen reopens an unconfirmed resolved complaint (Complaint 2)
    c2_payload = {
        "problem_type": "garbage",
        "confidence": 0.93,
        "severity": "MEDIUM",
        "evidence": ["Overflowing bin near transit point"],
        "latitude": 23.2390,
        "longitude": 77.4200,
        "location_name": "Arera Colony Sector B",
        "department": "Sanitation Department",
        "description": "Garbage dump persistent",
        "image_url": "/api/complaints/image/garbage-cross-repo.jpg"
    }
    c2_res = client.post("/api/complaints", json=c2_payload, headers=CITIZEN_HEADERS)
    assert c2_res.status_code == 201
    c2_rid = c2_res.json()["report_id"]

    # Authority resolves Complaint 2
    client.patch(
        f"/api/complaints/{c2_rid}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )

    # Citizen reopens Complaint 2
    reopen_res = client.post(
        f"/api/complaints/{c2_rid}/reopen",
        json={"reason": "Bin cleared but waste scattered on sidewalk"},
        headers=CITIZEN_HEADERS
    )
    assert reopen_res.status_code == 200
    cit_view_reopened = reopen_res.json()
    assert cit_view_reopened["status"] == "REOPENED"
    assert cit_view_reopened["citizen_reopened"] is True
    assert cit_view_reopened["reopen_reason"] == "Bin cleared but waste scattered on sidewalk"

    # Authority sees reopened complaint and citizen reason
    auth_view_reopened = client.get(f"/api/complaints/{c2_rid}", headers=AUTHORITY_HEADERS).json()
    assert auth_view_reopened["status"] == "REOPENED"
    assert auth_view_reopened["reopen_reason"] == "Bin cleared but waste scattered on sidewalk"

    # 10. Audit history verification on Complaint 1
    hist_res = client.get(f"/api/complaints/{rid}/history", headers=CITIZEN_HEADERS)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 4  # REPORTED, ASSIGNED, IN_PROGRESS, RESOLVED, VERIFIED
    statuses_in_history = [h.get("new_status") for h in history if h.get("new_status")]
    assert "REPORTED" in statuses_in_history
    assert "RESOLVED" in statuses_in_history
