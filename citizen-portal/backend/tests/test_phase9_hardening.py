import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
import io

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
    loc_name="Indrapuri Ward 52",
    problem="pothole",
    lat=23.2310,
    lng=77.4120,
    severity="HIGH",
    desc="Road subsidence near market",
    img_url="/api/complaints/image/test-pothole.jpg"
):
    payload = {
        "problem_type": problem,
        "confidence": 0.92,
        "severity": severity,
        "evidence": ["Asphalt crater 15cm"],
        "latitude": lat,
        "longitude": lng,
        "location_name": loc_name,
        "department": "Road Maintenance Division",
        "description": desc,
        "image_url": img_url
    }
    res = client.post("/api/complaints", json=payload, headers=citizen_token)
    assert res.status_code == 201
    return res.json()


# 1. Duplicate issue detection and linking
def test_duplicate_submission_detection():
    # Submit first complaint
    c1 = _create_sample_complaint(lat=23.2310, lng=77.4120, problem="pothole")
    
    # Second submission nearby for same category
    payload = {
        "problem_type": "pothole",
        "confidence": 0.92,
        "severity": "HIGH",
        "evidence": ["Asphalt crater 15cm"],
        "latitude": 23.2311,
        "longitude": 77.4121,
        "location_name": "Indrapuri Ward 52",
        "department": "Road Maintenance Division",
        "description": "Road subsidence near market",
        "image_url": "/api/complaints/image/pothole-dup-2.jpg"
    }
    res2 = client.post("/api/complaints", json=payload, headers=CITIZEN_1_HEADERS)
    assert res2.status_code == 201
    c2 = res2.json()

    # Must link to previous report ID to prevent duplicate effort
    assert c2["duplicate_of"] == c1["report_id"]


# 2. File size limit enforcement on upload
def test_upload_image_size_limit_rejection():
    # 11MB fake file (exceeds 10MB limit)
    oversized_data = b"x" * (11 * 1024 * 1024)
    file_payload = {"file": ("huge_photo.jpg", io.BytesIO(oversized_data), "image/jpeg")}
    
    res = client.post("/api/complaints/upload", files=file_payload, headers=CITIZEN_1_HEADERS)
    assert res.status_code == 413
    assert "too large" in res.json()["detail"].lower()


# 3. Invalid image MIME format rejection
def test_upload_image_invalid_mime_format():
    invalid_data = b"%PDF-1.4 simulated pdf"
    file_payload = {"file": ("malicious.pdf", io.BytesIO(invalid_data), "application/pdf")}

    res = client.post("/api/complaints/upload", files=file_payload, headers=CITIZEN_1_HEADERS)
    assert res.status_code == 400
    assert "unsupported" in res.json()["detail"].lower()


# 4. Anonymous cannot access protected complaint detail
def test_anonymous_access_to_protected_complaint_rejected():
    complaint = _create_sample_complaint()
    res = client.get(f"/api/complaints/{complaint['id']}")
    assert res.status_code == 401


# 5. Citizen ownership isolation on complaint detail
def test_cross_citizen_access_forbidden():
    c1 = _create_sample_complaint(citizen_token=CITIZEN_1_HEADERS)
    
    # Citizen 2 attempts to access Citizen 1's complaint
    res = client.get(f"/api/complaints/{c1['id']}", headers=CITIZEN_2_HEADERS)
    assert res.status_code == 403


# 6. Citizen notification lifecycle
def test_citizen_notifications_lifecycle():
    complaint = _create_sample_complaint()
    cid = complaint["id"]

    # Authority resolves complaint -> notification emitted
    res = client.patch(
        f"/api/complaints/{cid}/status",
        json={"status": "RESOLVED"},
        headers=AUTHORITY_HEADERS
    )
    assert res.status_code == 200

    # Citizen fetches notifications
    notif_res = client.get("/api/notifications", headers=CITIZEN_1_HEADERS)
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert len(notifs) >= 1
    target_notif = notifs[0]
    assert target_notif["is_read"] is False

    # Mark single notification as read
    read_res = client.patch(f"/api/notifications/{target_notif['id']}/read", headers=CITIZEN_1_HEADERS)
    assert read_res.status_code == 200

    # Mark all as read
    mark_all = client.post("/api/notifications/mark-all-read", headers=CITIZEN_1_HEADERS)
    assert mark_all.status_code == 200


# 7. Public tracker never exposes citizen credentials or internal notes
def test_public_tracker_zero_pii_guarantee():
    complaint = _create_sample_complaint(
        desc="Citizen private contact: 9876543210 and private note"
    )
    rid = complaint["report_id"]

    res = client.get(f"/api/complaints/{rid}/public-summary")
    assert res.status_code == 200
    pub = res.json()

    assert "citizen_id" not in pub
    assert "email" not in pub
    assert "phone" not in pub
    assert "image_url" not in pub
    assert "latitude" not in pub
    assert "longitude" not in pub
    assert "9876543210" not in str(pub)
