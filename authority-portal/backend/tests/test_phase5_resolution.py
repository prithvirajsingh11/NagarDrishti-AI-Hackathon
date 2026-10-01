import unittest
import io
from fastapi.testclient import TestClient
from main import app
from app.auth import verify_token
from app.services.store import data_store as store
from app.models.schemas import ComplaintStatus, CitizenVerificationStatus

class TestPhase5ResolutionManagement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Override auth dependency for authority officer tests
        self.authority_user = {
            "id": "officer-test-id",
            "email": "officer@bhopal.gov.in",
            "role": "authority",
            "full_name": "Superintending Engineer",
            "name": "Superintending Engineer"
        }
        self.citizen_user = {
            "id": "citizen-test-id",
            "email": "citizen@example.com",
            "role": "citizen",
            "full_name": "Ramesh Kumar",
            "name": "Ramesh Kumar"
        }

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_upload_resolution_evidence(self):
        """1. Authority can upload resolution evidence image (JPG/PNG/WEBP <= 10MB)"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        
        # Test valid JPG file
        fake_jpg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"0" * 1024)
        response = self.client.post(
            "/api/complaints/upload-resolution-evidence",
            files={"file": ("fixed_road.jpg", fake_jpg, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("image_url", "").startswith("/api/complaints/image/resolution_"))
        self.assertTrue(data.get("image_url", "").endswith(".jpg"))

    def test_01b_upload_evidence_rejects_invalid_format_and_oversize(self):
        """Rejects files that are not JPG/PNG/WEBP or exceed 10MB"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        
        # Non-image file (.pdf)
        pdf_file = io.BytesIO(b"%PDF-1.4 dummy content")
        response = self.client.post(
            "/api/complaints/upload-resolution-evidence",
            files={"file": ("document.pdf", pdf_file, "application/pdf")}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid image format", response.json().get("detail", ""))

        # Oversized file (> 10MB)
        huge_file = io.BytesIO(b"0" * (10 * 1024 * 1024 + 1024))
        response = self.client.post(
            "/api/complaints/upload-resolution-evidence",
            files={"file": ("huge.jpg", huge_file, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("10 MB limit", response.json().get("detail", ""))

    def test_02_and_03_authority_marks_complaint_resolved_with_timestamp(self):
        """2 & 3. Authority can mark complaint resolved; stores timestamp, note, image & identity"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        
        complaints = store.list_complaints()
        target = next(c for c in complaints if c.status != "RESOLVED")
        
        res_image = "/api/complaints/image/resolution_c001.jpg"
        res_note = "Asphalt resurfacing completed by Municipal Works crew."
        
        response = self.client.post(
            f"/api/complaints/{target.id}/resolve",
            json={
                "resolution_image_url": res_image,
                "resolution_note": res_note
            }
        )
        self.assertEqual(response.status_code, 200)
        resolved_c = response.json()
        
        self.assertEqual(resolved_c["status"], "RESOLVED")
        self.assertEqual(resolved_c["resolution_image_url"], res_image)
        self.assertEqual(resolved_c["resolution_note"], res_note)
        self.assertIsNotNone(resolved_c["resolved_at"])
        self.assertEqual(resolved_c["resolved_by"], "Superintending Engineer")
        self.assertEqual(resolved_c["citizen_verification_status"], "PENDING")

    def test_04_resolution_image_remains_separate_from_citizen_image(self):
        """4. Resolution image remains separate from citizen's original evidence"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        
        complaints = store.list_complaints()
        # Find complaint with citizen image
        target = next(c for c in complaints if c.image_url)
        citizen_orig_image = target.image_url
        
        res_image = "/api/complaints/image/fixed_pothole_separate.jpg"
        response = self.client.post(
            f"/api/complaints/{target.id}/resolve",
            json={
                "resolution_image_url": res_image,
                "resolution_note": "Pothole filled and sealed."
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(data["image_url"], citizen_orig_image)
        self.assertEqual(data["resolution_image_url"], res_image)
        self.assertNotEqual(data["image_url"], data["resolution_image_url"])

    def test_05_and_06_citizen_verification_flow_and_confirmation(self):
        """5 & 6. Citizen verification state defaults to PENDING and updates to CONFIRMED on confirmation"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        
        complaints = store.list_complaints()
        target = complaints[0]
        
        # Mark resolved
        self.client.post(
            f"/api/complaints/{target.id}/resolve",
            json={
                "resolution_image_url": "/api/complaints/image/res_work.jpg",
                "resolution_note": "Fixed"
            }
        )
        
        # Citizen confirms resolution
        app.dependency_overrides[verify_token] = lambda: self.citizen_user
        response = self.client.post(f"/api/complaints/{target.id}/confirm-resolution")
        self.assertEqual(response.status_code, 200)
        confirmed = response.json()
        
        self.assertEqual(confirmed["citizen_verification_status"], "CONFIRMED")
        self.assertIsNotNone(confirmed["citizen_verified_at"])

    def test_07_and_08_citizen_reopen_request_and_surfaces_to_authority(self):
        """7 & 8. Citizen reopen request sets status to REOPENED with reason and surfaces in authority stats"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        
        complaints = store.list_complaints()
        target = next(c for c in complaints if c.status != "RESOLVED")
        
        # Mark resolved first
        self.client.post(
            f"/api/complaints/{target.id}/resolve",
            json={
                "resolution_image_url": "/api/complaints/image/res_work2.jpg",
                "resolution_note": "Drain unclogged"
            }
        )
        
        # Citizen reopens
        app.dependency_overrides[verify_token] = lambda: self.citizen_user
        reopen_reason = "Water is still overflowing across the walkway."
        response = self.client.post(
            f"/api/complaints/{target.id}/reopen",
            json={"reason": reopen_reason}
        )
        self.assertEqual(response.status_code, 200)
        reopened_data = response.json()
        
        self.assertEqual(reopened_data["status"], "REOPENED")
        self.assertEqual(reopened_data["citizen_verification_status"], "REOPENED")
        self.assertEqual(reopened_data["reopen_reason"], reopen_reason)
        self.assertIsNotNone(reopened_data["reopened_at"])
        
        # Authority checks statistics and reopened filter
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        stats = self.client.get("/api/dashboard/statistics").json()
        self.assertGreaterEqual(stats.get("reopened", 0), 1)
        
        filtered = self.client.get("/api/complaints?resolution_status=reopened").json()
        reopened_ids = [c["id"] for c in filtered]
        self.assertIn(target.id, reopened_ids)

    def test_09_reopen_history_preserved(self):
        """9. Reopening preserves full auditable timeline history and prior resolution evidence"""
        app.dependency_overrides[verify_token] = lambda: self.authority_user
        complaint = store.get_complaint("c017")
        self.assertIsNotNone(complaint)
        self.assertEqual(complaint.status, "REOPENED")
        self.assertIsNotNone(complaint.resolution_image_url)
        self.assertIsNotNone(complaint.reopen_reason)
        
        # Verify via history endpoint
        response = self.client.get("/api/complaints/c017/history")
        self.assertEqual(response.status_code, 200)
        history = response.json()
        history_actions = [h["status"] for h in history]
        self.assertIn("RESOLVED", history_actions)
        self.assertIn("REOPENED", history_actions)

    def test_10_unauthorized_users_cannot_perform_authority_actions(self):
        """10. Unauthorized users / citizens receive 403 Forbidden for authority endpoints"""
        # Citizen role attempting authority resolve
        app.dependency_overrides[verify_token] = lambda: self.citizen_user
        response = self.client.post(
            "/api/complaints/c001/resolve",
            json={"resolution_image_url": "test.jpg"}
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Authority role required", response.json().get("detail", ""))

        # Citizen role attempting status patch
        response = self.client.patch(
            "/api/complaints/c001/status",
            json={"status": "IN_PROGRESS"}
        )
        self.assertEqual(response.status_code, 403)

        # Citizen role attempting upload evidence
        fake_jpg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"0" * 100)
        response = self.client.post(
            "/api/complaints/upload-resolution-evidence",
            files={"file": ("test.jpg", fake_jpg, "image/jpeg")}
        )
        self.assertEqual(response.status_code, 403)

if __name__ == "__main__":
    unittest.main()
