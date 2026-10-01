import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

CITIZEN_1_TOKEN = "Bearer test-citizen-token"
CITIZEN_2_TOKEN = "Bearer test-citizen-token-2"
AUTHORITY_TOKEN = "Bearer test-authority-token"

def test_unauthenticated_request_rejected():
    """Unauthenticated requests to protected endpoints return 401 Unauthorized."""
    # Attempting to fetch citizen reports without auth
    res = client.get("/api/complaints")
    assert res.status_code == 401
    assert "Authentication required" in res.json().get("detail", "")

    # Attempting to submit report without auth
    res_post = client.post("/api/complaints", json={
        "problem_type": "pothole",
        "confidence": 0.95,
        "severity": "HIGH",
        "evidence": ["Large crater"],
        "latitude": 28.6139,
        "longitude": 77.2090,
        "location_name": "Connaught Place",
        "department": "Municipal Roads",
        "description": "Unauthorized attempt",
        "image_url": "https://example.com/test.jpg"
    })
    assert res_post.status_code == 401

def test_complaint_ownership_enforcement():
    """Server-side identity verification guarantees complaint citizen_id equals authenticated user ID."""
    res = client.post(
        "/api/complaints",
        json={
            "problem_type": "drain",
            "confidence": 0.92,
            "severity": "MEDIUM",
            "evidence": ["Blocked gutter"],
            "latitude": 28.6200,
            "longitude": 77.2100,
            "location_name": "Barakhamba Road",
            "department": "Drainage & Sewerage",
            "description": "Drain overflowing onto sidewalk",
            "image_url": "https://example.com/drain.jpg",
            # Even if a client maliciously sends an arbitrary citizen_id:
            "citizen_id": "00000000-0000-0000-0000-000000000000",
        },
        headers={"Authorization": CITIZEN_1_TOKEN}
    )
    assert res.status_code == 201
    created = res.json()
    # Must match Citizen 1's actual ID from verified token, NOT the forged ID
    assert created["citizen_id"] == "11111111-1111-1111-1111-111111111111"

def test_citizen_data_isolation():
    """Citizen 1 cannot see Citizen 2's complaints and vice-versa."""
    # Citizen 1 complaints
    c1_res = client.get("/api/complaints", headers={"Authorization": CITIZEN_1_TOKEN})
    assert c1_res.status_code == 200
    for report in c1_res.json():
        assert report["citizen_id"] == "11111111-1111-1111-1111-111111111111"

    # Citizen 2 complaints
    c2_res = client.get("/api/complaints", headers={"Authorization": CITIZEN_2_TOKEN})
    assert c2_res.status_code == 200
    for report in c2_res.json():
        assert report["citizen_id"] == "33333333-3333-3333-3333-333333333333"

def test_citizen_cannot_alter_complaint_status():
    """Citizens cannot update status or assign departments — authority role strictly required."""
    res = client.patch(
        "/api/complaints/test-id-1/status",
        json={"status": "RESOLVED"},
        headers={"Authorization": CITIZEN_1_TOKEN}
    )
    assert res.status_code == 403
    assert "Authority role required" in res.json().get("detail", "")

def test_auth_me_identity_and_role():
    """Verify /api/auth/me returns citizen profile and prevents role spoofing."""
    res = client.get("/api/auth/me", headers={"Authorization": CITIZEN_1_TOKEN})
    assert res.status_code == 200
    profile = res.json()
    assert profile["role"] == "citizen"
    assert profile["id"] == "11111111-1111-1111-1111-111111111111"
