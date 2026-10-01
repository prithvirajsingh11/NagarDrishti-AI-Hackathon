import unittest
from fastapi.testclient import TestClient
from main import app
from app.services.store import (
    data_store,
    calculate_governance_outcomes,
    calculate_time_analytics,
    calculate_department_performance,
)
from app.models.schemas import Complaint, Department


class TestPhase9ProductionHardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_escalation_endpoint_rbac(self):
        """GET /api/dashboard/escalations requires authority role; rejects anon (401) and citizen (403)."""
        # Anonymous
        resp_anon = self.client.get("/api/dashboard/escalations")
        self.assertEqual(resp_anon.status_code, 401)

        # Citizen
        resp_citizen = self.client.get(
            "/api/dashboard/escalations",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(resp_citizen.status_code, 403)

        # Authority
        resp_auth = self.client.get(
            "/api/dashboard/escalations",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(resp_auth.status_code, 200)
        self.assertIsInstance(resp_auth.json(), list)

    def test_02_status_requests_endpoint_rbac(self):
        """GET /api/dashboard/status-requests requires authority role; rejects anon (401) and citizen (403)."""
        # Anonymous
        resp_anon = self.client.get("/api/dashboard/status-requests")
        self.assertEqual(resp_anon.status_code, 401)

        # Citizen
        resp_citizen = self.client.get(
            "/api/dashboard/status-requests",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(resp_citizen.status_code, 403)

        # Authority
        resp_auth = self.client.get(
            "/api/dashboard/status-requests",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(resp_auth.status_code, 200)
        self.assertIsInstance(resp_auth.json(), list)

    def test_03_reset_demo_endpoint_rbac(self):
        """POST /api/dashboard/reset-demo requires authority role; rejects anon (401) and citizen (403)."""
        # Anonymous
        resp_anon = self.client.post("/api/dashboard/reset-demo")
        self.assertEqual(resp_anon.status_code, 401)

        # Citizen
        resp_citizen = self.client.post(
            "/api/dashboard/reset-demo",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(resp_citizen.status_code, 403)

    def test_04_internal_notes_privacy_in_complaint_read(self):
        """Confidential internal notes are stripped from GET /api/complaints for anon and citizen callers."""
        # Find complaint with internal notes or add one in-memory
        complaint_with_note = None
        for c in data_store.complaints:
            if c.internal_notes and len(c.internal_notes) > 0:
                complaint_with_note = c
                break

        if not complaint_with_note:
            note = data_store.add_internal_note(
                data_store.complaints[0].id,
                note="Strictly confidential operational intelligence.",
                author="Chief Engineer",
            )
            complaint_with_note = data_store.get_complaint(data_store.complaints[0].id)

        target_id = complaint_with_note.id

        # 1. Anonymous read on single complaint -> internal_notes is empty
        resp_anon = self.client.get(f"/api/complaints/{target_id}")
        self.assertEqual(resp_anon.status_code, 200)
        self.assertEqual(resp_anon.json()["internal_notes"], [])

        # 2. Citizen read on single complaint -> internal_notes is empty
        resp_cit = self.client.get(
            f"/api/complaints/{target_id}",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(resp_cit.status_code, 200)
        self.assertEqual(resp_cit.json()["internal_notes"], [])

        # 3. Anonymous read on complaints list -> all internal_notes are empty
        resp_list_anon = self.client.get("/api/complaints")
        self.assertEqual(resp_list_anon.status_code, 200)
        for item in resp_list_anon.json():
            self.assertEqual(item["internal_notes"], [])

        # 4. Authority read on single complaint -> internal_notes are preserved
        resp_auth = self.client.get(
            f"/api/complaints/{target_id}",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(resp_auth.status_code, 200)
        self.assertGreater(len(resp_auth.json()["internal_notes"]), 0)

    def test_05_division_by_zero_safety_and_edge_cases(self):
        """Outcomes, analytics, and department performance calculations handle empty/zero edge cases safely."""
        # Empty complaints baseline
        outcomes = calculate_governance_outcomes([], escalations_count=0)
        self.assertEqual(outcomes.total_complaints, 0)
        self.assertEqual(outcomes.active_complaints, 0)
        self.assertEqual(outcomes.resolved_complaints, 0)
        self.assertIsNone(outcomes.resolution_rate_pct)
        self.assertIsNone(outcomes.avg_response_hours)
        self.assertIsNone(outcomes.avg_resolution_hours)
        self.assertEqual(outcomes.resolution_rate_label, "Insufficient data")

        # Department performance with no complaints
        dept_perf = calculate_department_performance([], [Department(id="1", name="PWD", category="pothole")])
        self.assertEqual(len(dept_perf), 1)
        self.assertEqual(dept_perf[0].total, 0)
        self.assertEqual(dept_perf[0].resolution_rate, 0.0)
        self.assertIsNone(dept_perf[0].avg_resolution_hours)

        # Time analytics with no complaints
        time_ana = calculate_time_analytics([])
        self.assertEqual(len(time_ana.received_over_time), 7)
        self.assertTrue(all(p.count == 0 for p in time_ana.received_over_time))
        self.assertIsNone(time_ana.avg_response_hours)

    def test_06_filter_consistency_on_complaints_and_export(self):
        """Query filters apply consistently across listing and CSV export."""
        # Filter by severity=HIGH
        resp_list = self.client.get(
            "/api/complaints?severity=HIGH",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(resp_list.status_code, 200)
        list_items = resp_list.json()
        for item in list_items:
            self.assertEqual(item["severity"], "HIGH")

        # CSV Export with same filter
        resp_csv = self.client.get(
            "/api/complaints/export?severity=HIGH",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(resp_csv.status_code, 200)
        lines = [ln.strip() for ln in resp_csv.text.strip().split("\n") if ln.strip()]
        header = lines[0]
        self.assertIn("Report ID", header)
        for row in lines[1:]:
            self.assertIn("HIGH", row)

    def test_07_operational_mutation_rbacs(self):
        """All operational mutation endpoints reject anonymous (401) and citizen (403) callers."""
        c_id = data_store.complaints[0].id

        # Assignment
        assign_payload = {"department": "PWD", "assigned_to": "Officer X"}
        self.assertEqual(self.client.post(f"/api/complaints/{c_id}/assign", json=assign_payload).status_code, 401)
        self.assertEqual(
            self.client.post(
                f"/api/complaints/{c_id}/assign",
                json=assign_payload,
                headers={"Authorization": "Bearer test-citizen-token"}
            ).status_code,
            403
        )

        # Status Update
        status_payload = {"status": "IN_PROGRESS"}
        self.assertEqual(self.client.patch(f"/api/complaints/{c_id}/status", json=status_payload).status_code, 401)
        self.assertEqual(
            self.client.patch(
                f"/api/complaints/{c_id}/status",
                json=status_payload,
                headers={"Authorization": "Bearer test-citizen-token"}
            ).status_code,
            403
        )

        # Resolve
        res_payload = {"resolution_image_url": "https://example.com/res.jpg", "resolution_note": "Fixed"}
        self.assertEqual(self.client.post(f"/api/complaints/{c_id}/resolve", json=res_payload).status_code, 401)
        self.assertEqual(
            self.client.post(
                f"/api/complaints/{c_id}/resolve",
                json=res_payload,
                headers={"Authorization": "Bearer test-citizen-token"}
            ).status_code,
            403
        )

        # Internal Note
        note_payload = {"note": "Test note"}
        self.assertEqual(self.client.post(f"/api/complaints/{c_id}/internal-notes", json=note_payload).status_code, 401)
        self.assertEqual(
            self.client.post(
                f"/api/complaints/{c_id}/internal-notes",
                json=note_payload,
                headers={"Authorization": "Bearer test-citizen-token"}
            ).status_code,
            403
        )


if __name__ == "__main__":
    unittest.main()
