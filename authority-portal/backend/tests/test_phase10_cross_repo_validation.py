import unittest
from fastapi.testclient import TestClient
from main import app
from app.services.store import data_store


class TestPhase10CrossRepoValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.created_complaint_ids = []

    @classmethod
    def tearDownClass(cls):
        # Remove any test complaints created during this integration test run
        for cid in cls.created_complaint_ids:
            data_store.complaints = [c for c in data_store.complaints if c.id != cid and c.report_id != cid]
        data_store._save_to_storage()

    def test_01_full_citizen_authority_cross_repo_lifecycle(self):
        """Complete 18-step civic lifecycle: Report -> Triage -> Assign -> Internal Note -> Redaction -> Resolve -> Confirm -> Reopen -> Escalation."""
        # 1. Citizen creates complaint
        payload = {
            "problem_type": "pothole",
            "confidence": 0.95,
            "severity": "HIGH",
            "evidence": ["deep asphalt crater"],
            "latitude": 23.2355,
            "longitude": 77.4320,
            "location_name": "Hamidia Road, Bhopal",
            "department": "Municipal Roads (PWD)",
            "description": "Hazardous road crater causing traffic disruption",
            "image_url": "https://example.com/pothole.jpg",
        }
        res_create = self.client.post("/api/complaints", json=payload)
        self.assertEqual(res_create.status_code, 201)
        complaint = res_create.json()
        cid = complaint["id"]
        self.__class__.created_complaint_ids.append(cid)

        # 2. Authority receives and opens complaint
        res_auth_get = self.client.get(
            f"/api/complaints/{cid}",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_auth_get.status_code, 200)
        c_data = res_auth_get.json()

        # 3. Verify category
        self.assertEqual(c_data["problem_type"], "pothole")
        # 4. Verify severity
        self.assertEqual(c_data["severity"], "HIGH")
        # 5. Verify department
        self.assertEqual(c_data["department"], "Municipal Roads (PWD)")
        # 6. Verify location
        self.assertAlmostEqual(c_data["latitude"], 23.2355, places=3)
        self.assertAlmostEqual(c_data["longitude"], 77.4320, places=3)
        # 7. Verify priority score computed
        self.assertIsNotNone(c_data.get("priority_score"))
        self.assertIn(c_data.get("priority_level"), ["CRITICAL", "HIGH", "MEDIUM", "LOW"])

        # 8. Authority assigns department/officer
        assign_payload = {
            "department": "Municipal Roads (PWD)",
            "assigned_to": "Officer Ramesh Verma (Rapid Patch Squad)",
            "note": "Dispatch emergency patching crew tonight"
        }
        res_assign = self.client.post(
            f"/api/complaints/{cid}/assign",
            json=assign_payload,
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_assign.status_code, 200)
        assigned_data = res_assign.json()
        self.assertEqual(assigned_data["assigned_to"], "Officer Ramesh Verma (Rapid Patch Squad)")

        # 9. Authority adds internal note
        note_payload = {"note": "Contractor road guarantee valid until Nov 2026. Forward penalty notice."}
        res_note = self.client.post(
            f"/api/complaints/{cid}/internal-notes",
            json=note_payload,
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_note.status_code, 200)

        # Verify internal note privacy: Citizen caller receives REDACTED internal notes
        res_citizen_get = self.client.get(
            f"/api/complaints/{cid}",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(res_citizen_get.status_code, 200)
        self.assertEqual(res_citizen_get.json().get("internal_notes"), [])

        # 10. Authority changes status to IN_PROGRESS
        res_progress = self.client.patch(
            f"/api/complaints/{cid}/status",
            json={"status": "IN_PROGRESS"},
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_progress.status_code, 200)
        self.assertEqual(res_progress.json()["status"], "IN_PROGRESS")

        # 11. Authority resolves complaint with resolution evidence
        res_resolve = self.client.post(
            f"/api/complaints/{cid}/resolve",
            json={
                "resolution_image_url": "/storage/resolution_evidence_test.jpg",
                "resolution_note": "Pothole filled with cold mix asphalt and leveled."
            },
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_resolve.status_code, 200)
        resolved_data = res_resolve.json()
        self.assertEqual(resolved_data["status"], "RESOLVED")
        self.assertEqual(resolved_data["resolution_image_url"], "/storage/resolution_evidence_test.jpg")

        # 12 & 13. Citizen views status timeline
        res_history = self.client.get(
            f"/api/complaints/{cid}/history",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(res_history.status_code, 200)
        history_items = res_history.json()
        self.assertGreaterEqual(len(history_items), 3)

        # 14 & 15. Citizen confirms resolution
        res_confirm = self.client.post(
            f"/api/complaints/{cid}/confirm-resolution",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(res_confirm.status_code, 200)
        self.assertEqual(res_confirm.json()["citizen_verification_status"], "CONFIRMED")

        # 16. Citizen reopens complaint
        res_reopen = self.client.post(
            f"/api/complaints/{cid}/reopen",
            json={"reason": "Asphalt sinking after heavy rain, surface cracking visible"},
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(res_reopen.status_code, 200)
        reopened_data = res_reopen.json()
        self.assertEqual(reopened_data["status"], "REOPENED")
        self.assertTrue(reopened_data["citizen_reopened"])

        # 17 & 18. Authority sees reopened state and escalation updates
        res_auth_reopen_check = self.client.get(
            f"/api/complaints/{cid}",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_auth_reopen_check.status_code, 200)
        self.assertEqual(res_auth_reopen_check.json()["status"], "REOPENED")

        res_escalations = self.client.get(
            "/api/dashboard/escalations",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_escalations.status_code, 200)
        escalation_ids = [e["complaint"]["id"] for e in res_escalations.json() if "complaint" in e]
        self.assertIn(cid, escalation_ids)

    def test_02_citizen_status_update_request_cycle(self):
        """Citizen files status update request; authority views queue and acknowledges with progress note."""
        # Pick existing complaint
        cid = data_store.complaints[0].id
        res_req = self.client.post(
            f"/api/complaints/{cid}/status-request",
            json={"citizen_message": "Is there an update on water logging clearance?"}
        )
        self.assertEqual(res_req.status_code, 200)
        req_data = res_req.json()
        req_id = req_data["id"]

        # Authority views request queue
        res_queue = self.client.get(
            "/api/dashboard/status-requests",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_queue.status_code, 200)
        queue_ids = [r["id"] for r in res_queue.json()]
        self.assertIn(req_id, queue_ids)

        # Authority acknowledges request
        res_ack = self.client.post(
            f"/api/complaints/{cid}/status-request/{req_id}/acknowledge",
            json={"response_note": "Drain de-siltation team has arrived on site."},
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_ack.status_code, 200)
        self.assertEqual(res_ack.json()["state"], "ACKNOWLEDGED")

    def test_03_csv_export_contract_and_security(self):
        """CSV export returns attachment with content-disposition and no confidential internal notes."""
        res_export = self.client.get(
            "/api/complaints/export?severity=CRITICAL",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(res_export.status_code, 200)
        self.assertIn("text/csv", res_export.headers.get("content-type", ""))
        self.assertIn("attachment; filename=", res_export.headers.get("content-disposition", ""))
        csv_body = res_export.text
        self.assertIn("Report ID", csv_body)
        self.assertNotIn("internal_notes", csv_body)
        self.assertNotIn("Contractor road guarantee", csv_body)

    def test_04_api_contract_response_schemas(self):
        """Verify all Phase 5-9 dashboard and analytics endpoints conform to response schemas."""
        endpoints = [
            ("/api/dashboard/statistics", 200, dict),
            ("/api/dashboard/heatmap", 200, list),
            ("/api/dashboard/priority-actions", 200, list),
            ("/api/dashboard/aging", 200, dict),
            ("/api/dashboard/departments", 200, list),
            ("/api/dashboard/trends", 200, list),
            ("/api/dashboard/governance-outcomes", 200, dict),
            ("/api/dashboard/time-analytics", 200, dict),
            ("/api/departments", 200, list),
        ]
        for url, expected_status, expected_type in endpoints:
            res = self.client.get(url)
            self.assertEqual(res.status_code, expected_status, f"Endpoint {url} failed status")
            self.assertIsInstance(res.json(), expected_type, f"Endpoint {url} unexpected return type")


if __name__ == "__main__":
    unittest.main()
