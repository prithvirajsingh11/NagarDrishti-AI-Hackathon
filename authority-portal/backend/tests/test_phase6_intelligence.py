import unittest
from datetime import datetime, timedelta, timezone
from app.models.schemas import Complaint, Department
from app.services.store import (
    compute_priority,
    calculate_aging_analysis,
    calculate_department_performance,
    calculate_category_trends,
    calculate_hotspots,
    data_store,
)


class TestPhase6Intelligence(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)

    def test_01_deterministic_priority_scoring_factors(self):
        """Verifies deterministic priority formula weights severity, status, age, density."""
        # Fresh low severity pothole
        c_low = Complaint(
            id="test-1",
            report_id="NGD-TEST-001",
            problem_type="pothole",
            confidence=0.9,
            severity="LOW",
            evidence=[],
            latitude=23.2599,
            longitude=77.4126,
            location_name="Bhopal Junction",
            department="Municipal Roads (PWD)",
            description="Minor crack",
            image_url="http://example.com/1.jpg",
            status="REPORTED",
            created_at=self.now.isoformat(),
            updated_at=self.now.isoformat(),
        )
        score_low, level_low, exp_low = compute_priority(c_low, [c_low], self.now)
        # Low severity (5) + Untriaged intake (8) + Fresh intake (2) + Road safety risk (5) = 20 pts
        self.assertEqual(score_low, 20.0)
        self.assertEqual(level_low, "LOW")
        self.assertIn("Low severity (+5)", exp_low)

        # Critical severity pothole aged 8 days, reopened by citizen, with nearby unresolved reports
        c_crit = Complaint(
            id="test-2",
            report_id="NGD-TEST-002",
            problem_type="pothole",
            confidence=0.98,
            severity="CRITICAL",
            evidence=[],
            latitude=23.2600,
            longitude=77.4127,
            location_name="Hamidia Road",
            department="Municipal Roads (PWD)",
            description="Deep crater",
            image_url="http://example.com/2.jpg",
            status="REOPENED",
            citizen_reopened=True,
            citizen_verification_status="REOPENED",
            created_at=(self.now - timedelta(days=8)).isoformat(),
            updated_at=self.now.isoformat(),
        )
        # Add 3 nearby unresolved neighbors
        neighbors = [
            Complaint(
                id=f"n-{i}",
                report_id=f"NGD-N-{i}",
                problem_type="pothole",
                confidence=0.8,
                severity="HIGH",
                evidence=[],
                latitude=23.2601 + (i * 0.001),
                longitude=77.4128,
                location_name="Hamidia Road Sector",
                department="Municipal Roads (PWD)",
                description="Pothole cluster",
                image_url="",
                status="REPORTED",
                created_at=self.now.isoformat(),
                updated_at=self.now.isoformat(),
            )
            for i in range(3)
        ]
        all_reps = [c_crit] + neighbors
        score_crit, level_crit, exp_crit = compute_priority(c_crit, all_reps, self.now)
        # Critical severity (40) + Reopened by citizen (20) + Reopened status (10) + Aged 8 days (20) + 3 nearby (8) + Road safety (5) = 100 (capped at 100)
        self.assertGreaterEqual(score_crit, 85.0)
        self.assertEqual(level_crit, "CRITICAL")
        self.assertIn("Critical severity (+40)", exp_crit)
        self.assertIn("Reopened by citizen (+20)", exp_crit)

    def test_02_resolved_complaint_priority_clamping(self):
        """Resolved complaints must receive score 0 and not compete with active issues."""
        c_resolved = Complaint(
            id="test-res",
            report_id="NGD-TEST-RES",
            problem_type="drain",
            confidence=0.95,
            severity="CRITICAL",
            evidence=[],
            latitude=23.2599,
            longitude=77.4126,
            location_name="Bhopal Center",
            department="Delhi Jal Board (DJB)",
            description="Sewage overflow",
            image_url="",
            status="RESOLVED",
            created_at=(self.now - timedelta(days=10)).isoformat(),
            updated_at=self.now.isoformat(),
            resolved_at=self.now.isoformat(),
        )
        score, level, explanation = compute_priority(c_resolved, [c_resolved], self.now)
        self.assertEqual(score, 0.0)
        self.assertEqual(level, "LOW")
        self.assertIn("Resolved", explanation)

    def test_03_aging_analysis_distribution(self):
        """Verifies 0-24h, 1-3d, 3-7d, and 7+d time bucket distributions."""
        complaints = [
            # 0-24h
            Complaint(
                id="a1", report_id="NGD-A1", problem_type="garbage", confidence=0.9, severity="LOW",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc 1", department="Sanitation",
                description="", image_url="", status="REPORTED",
                created_at=(self.now - timedelta(hours=6)).isoformat(), updated_at=self.now.isoformat()
            ),
            # 1-3d (48 hours)
            Complaint(
                id="a2", report_id="NGD-A2", problem_type="pothole", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc 2", department="Roads",
                description="", image_url="", status="IN_PROGRESS",
                created_at=(self.now - timedelta(days=2)).isoformat(), updated_at=self.now.isoformat()
            ),
            # 3-7d (5 days)
            Complaint(
                id="a3", report_id="NGD-A3", problem_type="drain", confidence=0.9, severity="MEDIUM",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc 3", department="Drainage",
                description="", image_url="", status="REPORTED",
                created_at=(self.now - timedelta(days=5)).isoformat(), updated_at=self.now.isoformat()
            ),
            # 7+ days (9 days)
            Complaint(
                id="a4", report_id="NGD-A4", problem_type="streetlight", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc 4", department="Lighting",
                description="", image_url="", status="REPORTED",
                created_at=(self.now - timedelta(days=9)).isoformat(), updated_at=self.now.isoformat()
            ),
            # Resolved (should NOT count in unresolved aging)
            Complaint(
                id="a5", report_id="NGD-A5", problem_type="pothole", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc 5", department="Roads",
                description="", image_url="", status="RESOLVED",
                created_at=(self.now - timedelta(days=9)).isoformat(), updated_at=self.now.isoformat(),
                resolved_at=self.now.isoformat()
            ),
        ]
        aging = calculate_aging_analysis(complaints, self.now)
        self.assertEqual(aging.total_unresolved, 4)
        self.assertEqual(aging.oldest_unresolved_count, 1)

        buckets = {cat.label: cat for cat in aging.categories}
        self.assertEqual(buckets["0–24 hours"].count, 1)
        self.assertEqual(buckets["1–3 days"].count, 1)
        self.assertEqual(buckets["3–7 days"].count, 1)
        self.assertEqual(buckets["7+ days"].count, 1)
        self.assertEqual(buckets["7+ days"].percentage, 25.0)

    def test_04_department_performance_metrics(self):
        """Verifies resolution rates and average resolution turnaround times."""
        departments = [
            Department(id="d1", name="Municipal Roads (PWD)", category="Roads", is_active=True),
            Department(id="d2", name="Drainage Division", category="Drainage", is_active=True),
        ]
        complaints = [
            # Roads: 1 resolved (took 48h), 1 in-progress
            Complaint(
                id="dp1", report_id="NGD-DP1", problem_type="pothole", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc", department="Municipal Roads (PWD)",
                description="", image_url="", status="RESOLVED",
                created_at=(self.now - timedelta(days=4)).isoformat(), updated_at=self.now.isoformat(),
                resolved_at=(self.now - timedelta(days=2)).isoformat()
            ),
            Complaint(
                id="dp2", report_id="NGD-DP2", problem_type="pothole", confidence=0.9, severity="MEDIUM",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc", department="Municipal Roads (PWD)",
                description="", image_url="", status="IN_PROGRESS",
                created_at=(self.now - timedelta(days=1)).isoformat(), updated_at=self.now.isoformat()
            ),
            # Drainage: 1 reopened, 1 reported
            Complaint(
                id="dp3", report_id="NGD-DP3", problem_type="drain", confidence=0.9, severity="CRITICAL",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc", department="Drainage Division",
                description="", image_url="", status="REOPENED", citizen_reopened=True,
                created_at=(self.now - timedelta(days=3)).isoformat(), updated_at=self.now.isoformat()
            ),
        ]
        perf = calculate_department_performance(complaints, departments)
        roads_perf = next(p for p in perf if "Roads" in p.department)
        self.assertEqual(roads_perf.total, 2)
        self.assertEqual(roads_perf.resolved, 1)
        self.assertEqual(roads_perf.in_progress, 1)
        self.assertEqual(roads_perf.resolution_rate, 50.0)
        self.assertIsNotNone(roads_perf.avg_resolution_hours)
        self.assertAlmostEqual(roads_perf.avg_resolution_hours, 48.0, delta=1.0)

        drain_perf = next(p for p in perf if "Drainage" in p.department)
        self.assertEqual(drain_perf.reopened, 1)
        self.assertEqual(drain_perf.resolution_rate, 0.0)
        self.assertIsNone(drain_perf.avg_resolution_hours)

    def test_05_category_trends_with_insufficient_data_handling(self):
        """Verifies category velocity trends and explicit handling of sparse data."""
        # 3 recent potholes, 1 prior 7d pothole => +200%
        # 0 garbage complaints => Insufficient data
        complaints = [
            Complaint(
                id=f"t-{i}", report_id=f"NGD-T-{i}", problem_type="pothole", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc", department="Roads",
                description="", image_url="", status="REPORTED",
                created_at=(self.now - timedelta(days=2)).isoformat(), updated_at=self.now.isoformat()
            )
            for i in range(3)
        ] + [
            Complaint(
                id="t-prior", report_id="NGD-T-PRIOR", problem_type="pothole", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2, longitude=77.4, location_name="Loc", department="Roads",
                description="", image_url="", status="REPORTED",
                created_at=(self.now - timedelta(days=10)).isoformat(), updated_at=self.now.isoformat()
            )
        ]

        trends = calculate_category_trends(complaints, self.now)
        pothole_trend = next(t for t in trends if t.category == "pothole")
        self.assertEqual(pothole_trend.count_7d, 3)
        self.assertEqual(pothole_trend.count_prior_7d, 1)
        self.assertEqual(pothole_trend.direction, "increasing")
        self.assertEqual(pothole_trend.trend_7d_pct, 200.0)

        garbage_trend = next(t for t in trends if t.category == "garbage")
        self.assertEqual(garbage_trend.direction, "insufficient_data")
        self.assertIn("Insufficient", garbage_trend.status_label)

    def test_06_hotspot_intelligence_upgrades(self):
        """Verifies reopened count, affected department, and deterministic action recommendation."""
        cluster_reps = [
            Complaint(
                id=f"h-{i}", report_id=f"NGD-H-{i}", problem_type="pothole", confidence=0.9, severity="HIGH",
                evidence=[], latitude=23.2599 + (i * 0.0005), longitude=77.4126 + (i * 0.0005),
                location_name="Hamidia Corridor", department="Municipal Roads (PWD)",
                description="", image_url="", status="REPORTED" if i > 0 else "REOPENED",
                citizen_reopened=(i == 0),
                created_at=self.now.isoformat(), updated_at=self.now.isoformat()
            )
            for i in range(4)
        ]
        hotspots = calculate_hotspots(cluster_reps)
        self.assertGreater(len(hotspots), 0)
        hs = hotspots[0]
        self.assertEqual(hs.reopened_count, 1)
        self.assertEqual(hs.affected_department, "Municipal Roads (PWD)")
        self.assertIn("HIGH", hs.severity_distribution)
        self.assertIn("asphalt patching squad", hs.suggested_action.lower())
        self.assertIn("reopened", hs.suggested_action.lower())

    def test_07_priority_actions_queue_integration(self):
        """Dashboard statistics priority actions returns top unresolved complaints sorted by priority score."""
        stats = data_store.get_statistics()
        self.assertIsNotNone(stats.priority_actions)
        self.assertIsNotNone(stats.aging_analysis)
        self.assertIsNotNone(stats.department_performance)
        self.assertIsNotNone(stats.category_trends)

        # Check sorted order of priority actions
        for i in range(len(stats.priority_actions) - 1):
            s1 = stats.priority_actions[i].priority_score or 0.0
            s2 = stats.priority_actions[i + 1].priority_score or 0.0
            self.assertGreaterEqual(s1, s2)

    def test_08_list_complaints_priority_level_filter(self):
        """Querying complaints by priority_level correctly filters results."""
        critical_priority_complaints = data_store.list_complaints(priority_level="CRITICAL")
        for c in critical_priority_complaints:
            self.assertEqual(c.priority_level, "CRITICAL")


if __name__ == "__main__":
    unittest.main()
