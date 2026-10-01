import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from main import app
from app.services.store import (
    data_store,
    calculate_governance_outcomes,
    calculate_time_analytics,
    calculate_department_performance,
)
from app.models.schemas import Complaint, StatusHistoryItem


class TestPhase8GovernanceReporting(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_governance_outcomes_calculation_real_data(self):
        """Test evidence-based governance outcome calculations against active complaints."""
        stats = data_store.get_statistics()
        self.assertIsNotNone(stats.governance_outcomes)
        outcomes = stats.governance_outcomes

        self.assertGreater(outcomes.total_complaints, 0)
        self.assertGreaterEqual(outcomes.active_complaints, 0)
        self.assertGreaterEqual(outcomes.resolved_complaints, 0)
        self.assertGreaterEqual(outcomes.reopened_complaints, 0)
        self.assertEqual(outcomes.total_complaints, len(data_store.complaints))
        self.assertGreater(outcomes.active_complaints, 0)
        self.assertGreater(outcomes.resolved_complaints, 0)
        self.assertIn("%", outcomes.resolution_rate_label)
        self.assertIsNotNone(outcomes.resolution_rate_pct)

    def test_insufficient_data_empty_baseline(self):
        """When 0 complaints exist, metric labels must be 'Insufficient data' and never misleading 0s."""
        empty_outcomes = calculate_governance_outcomes([], 0)
        self.assertEqual(empty_outcomes.total_complaints, 0)
        self.assertEqual(empty_outcomes.active_complaints, 0)
        self.assertIsNone(empty_outcomes.resolution_rate_pct)
        self.assertEqual(empty_outcomes.resolution_rate_label, "Insufficient data")
        self.assertIsNone(empty_outcomes.avg_response_hours)
        self.assertEqual(empty_outcomes.response_time_label, "Insufficient data")
        self.assertIsNone(empty_outcomes.avg_resolution_hours)
        self.assertEqual(
            empty_outcomes.resolution_time_label,
            "Insufficient data (no resolved complaints in period)"
        )

    def test_department_workload_metrics(self):
        """Department workload area must compute assigned and active_workload without arbitrary scores."""
        dept_perf = data_store.get_department_performance()
        self.assertGreater(len(dept_perf), 0)
        for d in dept_perf:
            self.assertGreaterEqual(d.total, 0)
            self.assertGreaterEqual(d.assigned, 0)
            self.assertGreaterEqual(d.active_workload, 0)
            self.assertEqual(d.active_workload, d.pending + d.in_progress + d.reopened)

    def test_time_analytics_volume_curves(self):
        """Time-based analytics must generate 7-day windows for received, resolved, reopened."""
        time_analytics = data_store.get_time_analytics()
        self.assertEqual(len(time_analytics.received_over_time), 7)
        self.assertEqual(len(time_analytics.resolved_over_time), 7)
        self.assertEqual(len(time_analytics.reopened_over_time), 7)
        total_rcv = sum(p.count for p in time_analytics.received_over_time)
        self.assertGreaterEqual(total_rcv, 0)

    def test_api_governance_outcomes_endpoint(self):
        """GET /api/dashboard/governance-outcomes returns valid structure."""
        resp = self.client.get("/api/dashboard/governance-outcomes")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("total_complaints", data)
        self.assertIn("active_complaints", data)
        self.assertIn("resolved_complaints", data)
        self.assertIn("reopened_complaints", data)
        self.assertIn("resolution_rate_pct", data)
        self.assertIn("resolution_rate_label", data)

    def test_api_time_analytics_endpoint(self):
        """GET /api/dashboard/time-analytics returns 7-day curves."""
        resp = self.client.get("/api/dashboard/time-analytics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("received_over_time", data)
        self.assertIn("resolved_over_time", data)
        self.assertIn("reopened_over_time", data)
        self.assertEqual(len(data["received_over_time"]), 7)

    def test_csv_export_requires_authority(self):
        """GET /api/complaints/export must reject unauthorized callers (401) and citizen role (403)."""
        # No token -> 401
        resp_anon = self.client.get("/api/complaints/export")
        self.assertEqual(resp_anon.status_code, 401)

        # Citizen token -> 403
        resp_citizen = self.client.get(
            "/api/complaints/export",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(resp_citizen.status_code, 403)

    def test_csv_export_authorized_and_filtered(self):
        """GET /api/complaints/export succeeds for authority and respects query filters."""
        resp = self.client.get(
            "/api/complaints/export?status=RESOLVED",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("content-type"), "text/csv; charset=utf-8")
        self.assertIn("attachment; filename=", resp.headers.get("content-disposition", ""))

        csv_text = resp.text
        lines = [line.strip() for line in csv_text.strip().split("\n") if line.strip()]
        self.assertGreater(len(lines), 1)  # Header + rows
        header = lines[0]
        self.assertIn("Report ID", header)
        self.assertIn("Category", header)
        self.assertIn("Severity", header)
        self.assertIn("Status", header)
        self.assertIn("Priority Level", header)
        self.assertIn("Department", header)
        # Verify internal confidential notes are NOT leaked
        self.assertNotIn("internal_note", header.lower())
        self.assertNotIn("confidential", header.lower())

        # Verify all rows are indeed RESOLVED
        for row in lines[1:]:
            self.assertIn("RESOLVED", row)

    def test_internal_notes_privacy_preserved(self):
        """Citizen role cannot access internal notes endpoint."""
        resp = self.client.get(
            "/api/complaints/c001/internal-notes",
            headers={"Authorization": "Bearer test-citizen-token"}
        )
        self.assertEqual(resp.status_code, 403)


if __name__ == "__main__":
    unittest.main()
