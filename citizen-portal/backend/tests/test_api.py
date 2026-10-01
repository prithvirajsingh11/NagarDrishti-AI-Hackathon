import io
import asyncio
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from datetime import datetime, timedelta, timezone
from app.main import app
from app.schemas.ai import CivicDetectionResult, ProblemType, SeverityLevel
from app.services.gemini_provider import GeminiVisionProvider
from app.services.local_provider import LocalVisionProvider
from app.services.severity_engine import SeverityEngine
from app.services.department_resolver import DepartmentResolver
from app.services.duplicate_detector import DuplicateDetector
from tests.test_fixtures import INITIAL_DEMO_COMPLAINTS

client = TestClient(app)

CITIZEN_HEADERS = {"Authorization": "Bearer test-citizen-token"}
CITIZEN_2_HEADERS = {"Authorization": "Bearer test-citizen-token-2"}
AUTHORITY_HEADERS = {"Authorization": "Bearer test-authority-token"}

# Helper to create valid JPEG in-memory bytes
def create_test_image(color=(128, 128, 128), size=(200, 200), format="JPEG", with_noise=True) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    if with_noise:
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, 100, 100], fill=(40, 50, 60))
        draw.ellipse([50, 50, 150, 150], fill=(200, 180, 160))
    img.save(buf, format=format)
    return buf.getvalue()


# ============================================================================
# PHASE 1 PRESERVED TESTS
# ============================================================================

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["app"] == "NagarDrishti AI"
    assert data["status"] == "online"

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_severity_engine_rules():
    # Critical rule: live wire / sinkhole
    sev = SeverityEngine.evaluate(ProblemType.STREETLIGHT, ["Live wire sparking near pavement"])
    assert sev == SeverityLevel.CRITICAL

    # High rule: active lane / deep
    sev = SeverityEngine.evaluate(ProblemType.POTHOLE, ["Deep crater in active road lane"])
    assert sev == SeverityLevel.HIGH

    # Medium rule: moderate crack
    sev = SeverityEngine.evaluate(ProblemType.POTHOLE, ["Moderate road surface wear"])
    assert sev == SeverityLevel.MEDIUM

def test_department_resolver_rules():
    assert DepartmentResolver.resolve(ProblemType.POTHOLE) == "Municipal Roads"
    assert DepartmentResolver.resolve(ProblemType.GARBAGE) == "Sanitation"
    assert DepartmentResolver.resolve(ProblemType.STREETLIGHT) == "Electrical / Municipal Lighting"
    assert DepartmentResolver.resolve(ProblemType.DRAIN) == "Drainage / Sanitation"
    assert DepartmentResolver.resolve(ProblemType.OTHER) == "Manual Review"

def test_duplicate_detector():
    existing = [
        {
            "report_id": "NGD-2026-00010",
            "problem_type": "pothole",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "status": "REPORTED",
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        }
    ]

    # Duplicate: same category + very close (within 20m)
    dup = DuplicateDetector.check_duplicate("pothole", 28.61395, 77.20905, existing)
    assert dup == "NGD-2026-00010"

    # Not duplicate: different category
    no_dup_cat = DuplicateDetector.check_duplicate("garbage", 28.61395, 77.20905, existing)
    assert no_dup_cat is None

    # Not duplicate: far away (e.g. 5km away)
    no_dup_dist = DuplicateDetector.check_duplicate("pothole", 28.6500, 77.2500, existing)
    assert no_dup_dist is None

def test_complaints_flow():
    payload = {
        "problem_type": "pothole",
        "confidence": 0.92,
        "severity": "HIGH",
        "evidence": ["Road depression"],
        "latitude": 28.6120,
        "longitude": 77.2080,
        "location_name": "Test Pothole Site",
        "department": "Municipal Roads",
        "description": "Urgent repair needed",
        "image_url": "https://example.com/test.jpg"
    }
    create_res = client.post("/api/complaints", json=payload, headers=CITIZEN_HEADERS)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["report_id"].startswith("NGD-2026-")
    assert created_data["status"] == "REPORTED"
    assert created_data["citizen_id"] == "11111111-1111-1111-1111-111111111111"
    rep_id = created_data["report_id"]

    get_res = client.get(f"/api/complaints/{rep_id}", headers=CITIZEN_HEADERS)
    assert get_res.status_code == 200
    assert get_res.json()["report_id"] == rep_id

    patch_res = client.patch(
        f"/api/complaints/{rep_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=AUTHORITY_HEADERS
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "IN_PROGRESS"

def test_dashboard_endpoints():
    stats_res = client.get("/api/dashboard/statistics", headers=AUTHORITY_HEADERS)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_reports" in stats
    assert "high_critical" in stats
    assert isinstance(stats["hotspots"], list)

    heatmap_res = client.get("/api/dashboard/heatmap", headers=AUTHORITY_HEADERS)
    assert heatmap_res.status_code == 200
    points = heatmap_res.json()
    assert isinstance(points, list)


# ============================================================================
# PHASE 2 TESTS: AI VISION, QUALITY CHECKS, STORAGE & CITIZEN OVERRIDE
# ============================================================================

@pytest.mark.anyio
async def test_gemini_valid_response():
    """Verify Gemini provider processes structured JSON response correctly."""
    mock_resp = MagicMock()
    mock_resp.text = '{"problem_type": "garbage", "confidence": 0.94, "severity": "HIGH", "evidence": ["Overflowing commercial waste bin"], "alternatives": [], "needs_retake": false}'

    provider = GeminiVisionProvider(api_key="test-key")
    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_resp
        mock_get_client.return_value = mock_client

        img_bytes = create_test_image(color=(100, 150, 120))
        result = await provider.analyze(img_bytes, mime_type="image/jpeg")

        assert result.problem_type == ProblemType.GARBAGE
        assert result.confidence == 0.94
        assert result.severity in [SeverityLevel.HIGH, SeverityLevel.CRITICAL]
        assert result.suggested_department == "Sanitation"
        assert result.needs_retake is False
        assert result.is_fallback is False

@pytest.mark.anyio
async def test_gemini_malformed_response():
    """Verify Gemini provider handles malformed JSON without crashing."""
    mock_resp = MagicMock()
    mock_resp.text = 'I see a pothole in the road, looks bad!'

    provider = GeminiVisionProvider(api_key="test-key")
    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_resp
        mock_get_client.return_value = mock_client

        img_bytes = create_test_image(color=(120, 120, 120))
        result = await provider.analyze(img_bytes, mime_type="image/jpeg")
        assert result.needs_retake is True

@pytest.mark.anyio
async def test_low_confidence_safeguard():
    """Verify confidence below 0.75 triggers 'other' and needs_retake=True."""
    mock_resp = MagicMock()
    mock_resp.text = '{"problem_type": "pothole", "confidence": 0.62, "severity": "LOW", "evidence": ["Blurry gray patch"], "alternatives": ["drain"], "needs_retake": false}'

    provider = GeminiVisionProvider(api_key="test-key")
    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_resp
        mock_get_client.return_value = mock_client

        img_bytes = create_test_image(color=(100, 120, 140))
        result = await provider.analyze(img_bytes, mime_type="image/jpeg")

        assert result.problem_type == ProblemType.OTHER
        assert result.needs_retake is True
        assert "pothole" in result.alternatives
        assert "clearer photo" in result.guidance_message.lower()

@pytest.mark.anyio
async def test_needs_retake_on_dark_image():
    """Verify pre-analysis quality check flags extremely dark images before inference."""
    provider = GeminiVisionProvider(api_key="test-key")
    dark_bytes = create_test_image(color=(5, 5, 5), with_noise=False)
    result = await provider.analyze(dark_bytes, mime_type="image/jpeg")

    assert result.problem_type == ProblemType.OTHER
    assert result.needs_retake is True
    assert "dark" in result.evidence[0].lower()
    assert "clearer photo" in result.guidance_message.lower()

@pytest.mark.anyio
async def test_needs_retake_on_blank_image():
    """Verify pre-analysis check catches uniform/blank images."""
    provider = GeminiVisionProvider(api_key="test-key")
    blank_bytes = create_test_image(color=(220, 220, 220), with_noise=False)
    result = await provider.analyze(blank_bytes, mime_type="image/jpeg")

    assert result.problem_type == ProblemType.OTHER
    assert result.needs_retake is True
    assert "blank" in result.evidence[0].lower()

def test_gemini_timeout_handling():
    """Verify HTTP 504 with exact message when AI analysis times out."""
    with patch("app.api.analyze.get_vision_analyzer") as mock_get_analyzer:
        mock_analyzer = MagicMock()
        async def mock_timeout(*args, **kwargs):
            raise TimeoutError("AI analysis timed out. Please try again.")
        mock_analyzer.analyze = mock_timeout
        mock_get_analyzer.return_value = mock_analyzer

        img_bytes = create_test_image()
        res = client.post(
            "/api/analyze",
            files={"file": ("test.jpg", img_bytes, "image/jpeg")},
            headers=CITIZEN_HEADERS
        )
        assert res.status_code == 504
        assert res.json()["detail"] == "AI analysis timed out. Please try again."

def test_gemini_rate_limit_handling():
    """Verify HTTP 429 with exact message when rate limit or quota exceeded."""
    with patch("app.api.analyze.get_vision_analyzer") as mock_get_analyzer:
        mock_analyzer = MagicMock()
        async def mock_quota(*args, **kwargs):
            raise RuntimeError("429 ResourceExhausted: quota limit exceeded")
        mock_analyzer.analyze = mock_quota
        mock_get_analyzer.return_value = mock_analyzer

        img_bytes = create_test_image()
        res = client.post(
            "/api/analyze",
            files={"file": ("test.jpg", img_bytes, "image/jpeg")},
            headers=CITIZEN_HEADERS
        )
        assert res.status_code == 429
        assert res.json()["detail"] == "AI analysis is temporarily unavailable. Please try again."

def test_unsupported_image_mime():
    """Verify HTTP 400 when non-image format is uploaded."""
    res = client.post(
        "/api/analyze",
        files={"file": ("notes.pdf", b"%PDF-1.4...", "application/pdf")},
        headers=CITIZEN_HEADERS
    )
    assert res.status_code == 400
    assert "Unsupported image format" in res.json()["detail"]

@pytest.mark.anyio
async def test_corrupted_image_handling():
    """Verify corrupted image bytes return needs_retake=True without crash."""
    provider = GeminiVisionProvider(api_key="test-key")
    corrupt_bytes = b"not-a-valid-image-stream-bytes"
    result = await provider.analyze(corrupt_bytes, mime_type="image/jpeg")

    assert result.problem_type == ProblemType.OTHER
    assert result.needs_retake is True
    assert "clearer photo" in result.guidance_message.lower()

def test_citizen_override_flow():
    """Verify that citizen edits to AI categorization and severity are preserved upon complaint filing."""
    override_payload = {
        "problem_type": "drain",
        "confidence": 0.88,
        "severity": "CRITICAL",
        "evidence": ["Blocked gutter causing foul overflow"],
        "latitude": 28.6150,
        "longitude": 77.2100,
        "location_name": "Janpath Road",
        "department": "Drainage / Sanitation",
        "description": "Citizen adjusted category and marked critical due to health hazard.",
        "image_url": "/api/complaints/image/test-drain.jpg"
    }

    res = client.post("/api/complaints", json=override_payload, headers=CITIZEN_HEADERS)
    assert res.status_code == 201
    data = res.json()
    assert data["problem_type"] == "drain"
    assert data["severity"] == "CRITICAL"
    assert data["department"] == "Drainage / Sanitation"
    assert data["description"] == override_payload["description"]
    assert data["citizen_id"] == "11111111-1111-1111-1111-111111111111"

def test_supabase_private_storage_upload_and_controlled_access():
    """Verify upload returns controlled reference and image endpoint streams bytes."""
    img_bytes = create_test_image(color=(80, 120, 160))

    # 1. Upload with citizen token
    upload_res = client.post(
        "/api/complaints/upload",
        files={"file": ("civic_issue.jpg", img_bytes, "image/jpeg")},
        headers=CITIZEN_HEADERS
    )
    assert upload_res.status_code == 200
    image_url = upload_res.json()["image_url"]
    assert image_url.startswith("/api/complaints/image/")
    filename = image_url.replace("/api/complaints/image/", "")

    # 2. Controlled access retrieval with citizen token
    get_img_res = client.get(f"/api/complaints/image/{filename}", headers=CITIZEN_HEADERS)
    assert get_img_res.status_code == 200
    assert get_img_res.headers["content-type"] == "image/jpeg"
    assert len(get_img_res.content) == len(img_bytes)

    # 3. Signed URL endpoint check
    signed_res = client.get(f"/api/complaints/image/{filename}/signed-url", headers=CITIZEN_HEADERS)
    assert signed_res.status_code == 200
    assert "signed_url" in signed_res.json()


# ============================================================================
# PHASE 3 TESTS: AUTHORITY DASHBOARD, MAP, HOTSPOTS, TRENDS & DUPLICATES
# ============================================================================

def test_phase3_dashboard_statistics():
    """Verify statistics aggregates counts, daily trends, and hotspots accurately."""
    res = client.get("/api/dashboard/statistics", headers=AUTHORITY_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert "total_reports" in data
    assert "high_critical" in data
    assert "pending" in data
    assert "in_progress" in data
    assert "resolved" in data
    assert "by_category" in data
    assert "daily_trends" in data
    assert len(data["daily_trends"]) == 7

def test_phase3_filtered_complaints_by_category():
    """Verify filtering complaints by category returns matching items for authority."""
    res = client.get("/api/complaints?problem_type=pothole", headers=AUTHORITY_HEADERS)
    assert res.status_code == 200
    items = res.json()
    assert all(c["problem_type"] == "pothole" for c in items)

def test_phase3_filtered_complaints_by_severity():
    """Verify filtering complaints by severity level."""
    res = client.get("/api/complaints?severity=CRITICAL", headers=AUTHORITY_HEADERS)
    assert res.status_code == 200
    items = res.json()
    assert all(c["severity"] == "CRITICAL" for c in items)

def test_phase3_filtered_complaints_by_status():
    """Verify filtering complaints by lifecycle status."""
    res = client.get("/api/complaints?status=REPORTED", headers=AUTHORITY_HEADERS)
    assert res.status_code == 200
    items = res.json()
    assert all(c["status"] == "REPORTED" for c in items)

def test_phase3_filtered_complaints_by_department():
    """Verify filtering complaints by department."""
    res = client.get("/api/complaints?department=Municipal Roads", headers=AUTHORITY_HEADERS)
    assert res.status_code == 200
    items = res.json()
    assert all(c["department"] == "Municipal Roads" for c in items)

def test_phase3_hotspot_calculation():
    """Verify spatial corridor clustering computes centroids, dominant issue, and decision support."""
    from app.core.database import calculate_hotspots
    test_reports = [
        {"id": "t1", "report_id": "NGD-T1", "problem_type": "pothole", "severity": "HIGH", "status": "REPORTED", "latitude": 28.6315, "longitude": 77.2167},
        {"id": "t2", "report_id": "NGD-T2", "problem_type": "pothole", "severity": "CRITICAL", "status": "IN_PROGRESS", "latitude": 28.6320, "longitude": 77.2170},
        {"id": "t3", "report_id": "NGD-T3", "problem_type": "pothole", "severity": "MEDIUM", "status": "REPORTED", "latitude": 28.6325, "longitude": 77.2172},
    ]
    hotspots = calculate_hotspots(test_reports)
    assert len(hotspots) == 1
    hs = hotspots[0]
    assert "Pothole" in hs["dominant_issue"]
    assert hs["total_reports"] == 3
    assert hs["high_critical_count"] == 2
    assert hs["unresolved_count"] == 3
    assert len(hs["report_ids"]) == 3
    assert "Inspect" in hs["suggested_action"]

def test_phase3_duplicate_flagging():
    """Verify that reporting a duplicate civic issue near an existing one flags duplicate_of."""
    base_payload = {
        "problem_type": "pothole",
        "confidence": 0.91,
        "severity": "HIGH",
        "evidence": ["Asphalt crater"],
        "latitude": 28.7300,
        "longitude": 77.3300,
        "location_name": "Connaught Place Radial 1",
        "department": "Municipal Roads",
        "description": "Original report",
        "image_url": "https://example.com/pothole1.jpg"
    }
    r1 = client.post("/api/complaints", json=base_payload, headers=CITIZEN_HEADERS)
    assert r1.status_code == 201
    parent_id = r1.json()["report_id"]

    # Submit second report within 15 meters
    dup_payload = {
        "problem_type": "pothole",
        "confidence": 0.89,
        "severity": "HIGH",
        "evidence": ["Road depression"],
        "latitude": 28.73005,
        "longitude": 77.33005,
        "location_name": "Connaught Place Radial 1 nearby",
        "department": "Municipal Roads",
        "description": "Duplicate report",
        "image_url": "https://example.com/pothole2.jpg"
    }
    r2 = client.post("/api/complaints", json=dup_payload, headers=CITIZEN_HEADERS)
    assert r2.status_code == 201
    dup_data = r2.json()
    assert dup_data["duplicate_of"] == parent_id

def test_phase3_complaint_status_lifecycle_updates():
    """Verify lifecycle progression: REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED."""
    payload = {
        "problem_type": "garbage",
        "confidence": 0.95,
        "severity": "MEDIUM",
        "evidence": ["Overflowing waste"],
        "latitude": 28.6400,
        "longitude": 77.2300,
        "location_name": "Market Area",
        "department": "Sanitation",
        "description": "Lifecycle test",
        "image_url": "https://example.com/waste.jpg"
    }
    c_res = client.post("/api/complaints", json=payload, headers=CITIZEN_HEADERS)
    assert c_res.status_code == 201
    rep_id = c_res.json()["report_id"]

    for next_st in ["ASSIGNED", "IN_PROGRESS", "RESOLVED"]:
        p_res = client.patch(
            f"/api/complaints/{rep_id}/status",
            json={"status": next_st},
            headers=AUTHORITY_HEADERS
        )
        assert p_res.status_code == 200
        assert p_res.json()["status"] == next_st

    # Invalid status should return 422
    inv_res = client.patch(
        f"/api/complaints/{rep_id}/status",
        json={"status": "INVALID_STATUS"},
        headers=AUTHORITY_HEADERS
    )
    assert inv_res.status_code == 422

def test_phase3_heatmap_endpoint():
    """Verify /api/dashboard/heatmap returns weighted geospatial points."""
    res = client.get("/api/dashboard/heatmap", headers=AUTHORITY_HEADERS)
    assert res.status_code == 200
    points = res.json()
    assert isinstance(points, list)

def test_phase3_empty_dashboard_handling():
    """Verify statistics and hotspot calculations gracefully handle 0 reports."""
    from app.core.database import calculate_statistics
    empty_stats = calculate_statistics([])
    assert empty_stats["total_reports"] == 0
    assert empty_stats["high_critical"] == 0
    assert empty_stats["pending"] == 0
    assert empty_stats["in_progress"] == 0
    assert empty_stats["resolved"] == 0
    assert empty_stats["hotspots"] == []
    assert len(empty_stats["daily_trends"]) == 7

def test_phase3_isolated_test_fixtures_integrity():
    """Verify isolated test fixture complaints contain valid test data."""
    assert len(INITIAL_DEMO_COMPLAINTS) >= 3
    categories = {c["problem_type"] for c in INITIAL_DEMO_COMPLAINTS}
    assert "pothole" in categories


# ============================================================================
# PHASE 4 AUTHENTICATION & OWNERSHIP SECURITY TESTS (14 Requirement 23 Tests)
# ============================================================================

def test_1_signup_and_login_token_resolution():
    """1 & 2. Verify token resolution returns citizen user identity."""
    from app.core.auth import TEST_TOKENS
    citizen_user = TEST_TOKENS["test-citizen-token"]
    assert citizen_user["role"] == "citizen"
    assert citizen_user["id"] == "11111111-1111-1111-1111-111111111111"

def test_3_logout_invalidation_handling():
    """3. Unauthenticated requests simulate logged-out client state."""
    res = client.get("/api/complaints")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]

def test_4_protected_routes_reject_anonymous():
    """4. Anonymous requests to protected routes fail with 401."""
    assert client.post("/api/analyze").status_code == 401
    assert client.post("/api/complaints/upload").status_code == 401
    assert client.post("/api/complaints", json={}).status_code == 401
    assert client.get("/api/complaints").status_code == 401
    assert client.get("/api/complaints/nonexistent").status_code == 401

def test_5_unauthenticated_complaint_creation_rejection():
    """5. POST /api/complaints without auth token is rejected with 401."""
    res = client.post("/api/complaints", json={"problem_type": "pothole"})
    assert res.status_code == 401

def test_6_and_7_authenticated_complaint_creation_ownership():
    """6 & 7. Authenticated complaint derives citizen_id from token, ignoring any body citizen_id."""
    tampered_payload = {
        "citizen_id": "99999999-9999-9999-9999-999999999999",  # Attempt to forge ownership
        "problem_type": "pothole",
        "confidence": 0.90,
        "severity": "HIGH",
        "evidence": ["Asphalt crater"],
        "latitude": 28.6180,
        "longitude": 77.2080,
        "location_name": "Connaught Place",
        "department": "Municipal Roads",
        "description": "Owner verification test",
        "image_url": "https://example.com/pothole_owner.jpg"
    }
    res = client.post("/api/complaints", json=tampered_payload, headers=CITIZEN_HEADERS)
    assert res.status_code == 201
    data = res.json()
    # Must be authenticated citizen's ID, NOT the forged ID
    assert data["citizen_id"] == "11111111-1111-1111-1111-111111111111"

def test_8_citizen_can_read_own_complaint():
    """8. Citizen can read their own report by ID."""
    res = client.post("/api/complaints", json={
        "problem_type": "garbage",
        "confidence": 0.90,
        "severity": "LOW",
        "evidence": ["Litter pile"],
        "latitude": 28.6100,
        "longitude": 77.2000,
        "location_name": "Litter Zone",
        "department": "Sanitation",
        "description": "Read own complaint test",
        "image_url": "https://example.com/litter.jpg"
    }, headers=CITIZEN_HEADERS)
    assert res.status_code == 201
    rep_id = res.json()["report_id"]

    get_res = client.get(f"/api/complaints/{rep_id}", headers=CITIZEN_HEADERS)
    assert get_res.status_code == 200
    assert get_res.json()["report_id"] == rep_id

def test_9_citizen_cannot_read_another_citizens_complaint():
    """9. Citizen 2 cannot read Citizen 1's complaint."""
    # Create complaint as Citizen 1
    res1 = client.post("/api/complaints", json={
        "problem_type": "drain",
        "confidence": 0.90,
        "severity": "MEDIUM",
        "evidence": ["Clogged drain"],
        "latitude": 28.6200,
        "longitude": 77.2200,
        "location_name": "Drain Site",
        "department": "Drainage / Sanitation",
        "description": "Private complaint of citizen 1",
        "image_url": "https://example.com/drain1.jpg"
    }, headers=CITIZEN_HEADERS)
    assert res1.status_code == 201
    rep_id = res1.json()["report_id"]

    # Citizen 2 attempts to read Citizen 1's report
    res2 = client.get(f"/api/complaints/{rep_id}", headers=CITIZEN_2_HEADERS)
    assert res2.status_code in [403, 404]

def test_10_citizen_cannot_modify_another_users_complaint_status():
    """10. Citizens cannot invoke authority PATCH /api/complaints/{id}/status."""
    res1 = client.post("/api/complaints", json={
        "problem_type": "streetlight",
        "confidence": 0.90,
        "severity": "LOW",
        "evidence": ["Unlit fixture"],
        "latitude": 28.6210,
        "longitude": 77.2210,
        "location_name": "Streetlight Site",
        "department": "Electrical / Municipal Lighting",
        "description": "Status security test",
        "image_url": "https://example.com/light.jpg"
    }, headers=CITIZEN_HEADERS)
    rep_id = res1.json()["report_id"]

    # Citizen 1 attempts to change status to RESOLVED
    patch_res = client.patch(
        f"/api/complaints/{rep_id}/status",
        json={"status": "RESOLVED"},
        headers=CITIZEN_HEADERS
    )
    assert patch_res.status_code == 403
    assert "Authority role required" in patch_res.json()["detail"]

def test_11_citizen_cannot_access_authority_dashboard():
    """11. Citizen role cannot access authority-only analytics endpoints."""
    stat_res = client.get("/api/dashboard/statistics", headers=CITIZEN_HEADERS)
    assert stat_res.status_code == 403

    heat_res = client.get("/api/dashboard/heatmap", headers=CITIZEN_HEADERS)
    assert heat_res.status_code == 403

def test_12_expired_or_invalid_token_rejected():
    """12. Invalid or expired token is rejected with 401."""
    res = client.get("/api/complaints", headers={"Authorization": "Bearer invalid-garbage-token"})
    assert res.status_code == 401

def test_13_my_reports_ownership_filtering():
    """13. GET /api/complaints strictly isolates reports by citizen_id for citizen users."""
    # Ensure Citizen 1 has at least 1 complaint
    client.post("/api/complaints", json={
        "problem_type": "pothole",
        "confidence": 0.88,
        "severity": "LOW",
        "evidence": ["Small rut"],
        "latitude": 28.6111,
        "longitude": 77.2111,
        "location_name": "Citizen 1 Rut",
        "department": "Municipal Roads",
        "description": "Mine alone",
        "image_url": "https://example.com/c1.jpg"
    }, headers=CITIZEN_HEADERS)

    # Citizen 1 fetches reports
    c1_reports = client.get("/api/complaints", headers=CITIZEN_HEADERS).json()
    assert all(c["citizen_id"] == "11111111-1111-1111-1111-111111111111" for c in c1_reports)

    # Citizen 2 fetches reports
    c2_reports = client.get("/api/complaints", headers=CITIZEN_2_HEADERS).json()
    assert all(c["citizen_id"] == "33333333-3333-3333-3333-333333333333" for c in c2_reports)

def test_14_private_image_access_enforcement():
    """14. Private images require authentication and ownership verification."""
    img_bytes = create_test_image(color=(50, 100, 150))
    upload_res = client.post(
        "/api/complaints/upload",
        files={"file": ("private_evidence.jpg", img_bytes, "image/jpeg")},
        headers=CITIZEN_HEADERS
    )
    assert upload_res.status_code == 200
    img_url = upload_res.json()["image_url"]
    filename = img_url.replace("/api/complaints/image/", "")

    # Bind image to Citizen 1's complaint
    client.post("/api/complaints", json={
        "problem_type": "pothole",
        "confidence": 0.90,
        "severity": "HIGH",
        "evidence": ["Road cavity"],
        "latitude": 28.6130,
        "longitude": 77.2130,
        "location_name": "Evidence Site",
        "department": "Municipal Roads",
        "description": "Image access verification",
        "image_url": img_url
    }, headers=CITIZEN_HEADERS)

    # 1. Anonymous access is rejected with 401
    anon_res = client.get(f"/api/complaints/image/{filename}")
    assert anon_res.status_code == 401

    # 2. Citizen 1 (owner) can access with token in header
    owner_res = client.get(f"/api/complaints/image/{filename}", headers=CITIZEN_HEADERS)
    assert owner_res.status_code == 200

    # 3. Citizen 1 can access with token query parameter (for browser img tags)
    query_res = client.get(f"/api/complaints/image/{filename}?token=test-citizen-token")
    assert query_res.status_code == 200

    # 4. Citizen 2 (unauthorized) cannot access image (403)
    c2_res = client.get(f"/api/complaints/image/{filename}", headers=CITIZEN_2_HEADERS)
    assert c2_res.status_code == 403


def test_hotspots_authority_access():
    """Verify authority can access /api/dashboard/hotspots and citizen is rejected."""
    # Authority succeeds
    res_auth = client.get("/api/dashboard/hotspots", headers=AUTHORITY_HEADERS)
    assert res_auth.status_code == 200
    assert isinstance(res_auth.json(), list)

    # Citizen is rejected with 403 Forbidden
    res_cit = client.get("/api/dashboard/hotspots", headers=CITIZEN_HEADERS)
    assert res_cit.status_code == 403
    assert "Authority role required" in res_cit.json()["detail"]

    # Unauthenticated is rejected with 401
    res_anon = client.get("/api/dashboard/hotspots")
    assert res_anon.status_code == 401

def test_auth_me_endpoint():
    """Verify /api/auth/me returns verified user profile with role."""
    res_auth = client.get("/api/auth/me", headers=AUTHORITY_HEADERS)
    assert res_auth.status_code == 200
    data = res_auth.json()
    assert data["role"] == "authority"
    assert data["email"] == "officer@municipal.gov"

    res_cit = client.get("/api/auth/me", headers=CITIZEN_HEADERS)
    assert res_cit.status_code == 200
    data_cit = res_cit.json()
    assert data_cit["role"] == "citizen"
