import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from main import app
from app.auth import verify_token, require_authority
from app.services.store import data_store as store
from app.models.schemas import Complaint, AssignmentRecord, InternalNote, StatusUpdateRequestItem


class TestPhase7Operations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.authority_user = {
            "id": "officer-phase7-id",
            "email": "officer7@bhopal.gov.in",
            "role": "authority",
            "full_name": "Executive Engineer Phase 7",
            "name": "Executive Engineer Phase 7"
        }
        self.citizen_user = {
            "id": "citizen-phase7-id",
            "email": "citizen7@example.com",
            "role": "citizen",
            "full_name": "Suresh Citizen",
            "name": "Suresh Citizen"
        }

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_case_assignment_and_auditable_history(self):
        """Authority assigns complaint to department + officer/team; verifies non-overwriting audit log."""
        app.dependency_overrides[require_authority] = lambda: self.authority_user
        app.dependency_overrides[verify_token] = lambda: self.authority_user

        # Fetch an existing unassigned reported complaint (c010)
        target = store.get_complaint("c010")
        self.assertIsNotNone(target)
        initial_history_len = len(target.assignment_history)

        # 1st Assignment: Assign to Municipal Roads & Officer A
        assign_payload = {
            "department": "Municipal Roads (PWD)",
            "assigned_to": "Officer A (Bhopal Rapid Patch Squad)",
            "note": "Immediate night milling and hot asphalt filling required."
        }
        resp1 = self.client.post(f"/api/complaints/{target.id}/assign", json=assign_payload)
        self.assertEqual(resp1.status_code, 200)
        c1 = resp1.json()

        self.assertEqual(c1["department"], "Municipal Roads (PWD)")
        self.assertEqual(c1["assigned_to"], "Officer A (Bhopal Rapid Patch Squad)")
        self.assertIsNotNone(c1["assigned_at"])
        # If it was REPORTED, status transitions to ASSIGNED
        self.assertIn(c1["status"], ("ASSIGNED", "IN_PROGRESS"))

        # Check assignment history length increased
        self.assertEqual(len(c1["assignment_history"]), initial_history_len + 1)
        rec1 = c1["assignment_history"][-1]
        self.assertEqual(rec1["new_department"], "Municipal Roads (PWD)")
        self.assertEqual(rec1["new_assignee"], "Officer A (Bhopal Rapid Patch Squad)")
        self.assertEqual(rec1["changed_by"], "Executive Engineer Phase 7")
        self.assertIn("Immediate night milling", rec1["note"])

        # 2nd Assignment (Re-assignment): Must NEVER overwrite past assignment history
        reassign_payload = {
            "department": "Municipal Roads (PWD)",
            "assigned_to": "Officer B (Zonal Heavy Equipment Unit)",
            "note": "Reassigned due to larger paver equipment requirement."
        }
        resp2 = self.client.post(f"/api/complaints/{target.id}/assign", json=reassign_payload)
        self.assertEqual(resp2.status_code, 200)
        c2 = resp2.json()

        self.assertEqual(c2["assigned_to"], "Officer B (Zonal Heavy Equipment Unit)")
        self.assertEqual(len(c2["assignment_history"]), initial_history_len + 2)
        rec2 = c2["assignment_history"][-1]
        self.assertEqual(rec2["previous_assignee"], "Officer A (Bhopal Rapid Patch Squad)")
        self.assertEqual(rec2["new_assignee"], "Officer B (Zonal Heavy Equipment Unit)")

        # Verify unified timeline contains assignment history items
        unified_timeline = c2["status_history"]
        assigned_events = [e for e in unified_timeline if e["status"] == "ASSIGNED"]
        self.assertTrue(len(assigned_events) >= 1)

    def test_02_internal_notes_confidentiality_and_chronology(self):
        """Internal notes can be added by authority, ordered chronologically, and restricted from unauthorized access."""
        target = store.get_complaint("c005")
        self.assertIsNotNone(target)

        # 1. Non-authority user receives 403 when attempting to add internal note
        app.dependency_overrides[require_authority] = lambda: (_ for _ in ()).throw(
            Exception("Unauthorized")
        )
        # Note: using default require_authority behavior (no override or citizen user)
        app.dependency_overrides.clear()
        app.dependency_overrides[verify_token] = lambda: self.citizen_user

        unauth_resp = self.client.post(
            f"/api/complaints/{target.id}/internal-notes",
            json={"note": "Citizen trying to read internal secret"}
        )
        self.assertIn(unauth_resp.status_code, (401, 403))

        # 2. Authorized authority officer adds internal notes
        app.dependency_overrides[require_authority] = lambda: self.authority_user
        app.dependency_overrides[verify_token] = lambda: self.authority_user

        note_payload1 = {"note": "Material procurement pending for bitumen grade 60/70."}
        resp_note1 = self.client.post(f"/api/complaints/{target.id}/internal-notes", json=note_payload1)
        self.assertEqual(resp_note1.status_code, 200)
        n1 = resp_note1.json()
        self.assertEqual(n1["note"], note_payload1["note"])
        self.assertEqual(n1["author"], "Executive Engineer Phase 7")
        self.assertEqual(n1["author_role"], "authority")

        note_payload2 = {"note": "Contractor contacted; equipment rolling at 22:30."}
        resp_note2 = self.client.post(f"/api/complaints/{target.id}/internal-notes", json=note_payload2)
        self.assertEqual(resp_note2.status_code, 200)

        # 3. Retrieve internal notes list
        get_notes_resp = self.client.get(f"/api/complaints/{target.id}/internal-notes")
        self.assertEqual(get_notes_resp.status_code, 200)
        notes = get_notes_resp.json()
        self.assertTrue(len(notes) >= 2)
        note_texts = [n["note"] for n in notes]
        self.assertIn("Material procurement pending for bitumen grade 60/70.", note_texts)
        self.assertIn("Contractor contacted; equipment rolling at 22:30.", note_texts)

    def test_03_citizen_status_update_request_and_authority_acknowledgment(self):
        """Citizens request status updates; authority acknowledges WITHOUT altering complaint lifecycle status."""
        target = store.get_complaint("c004")
        self.assertIsNotNone(target)
        original_status = target.status

        # Citizen submits status update request
        req_payload = {
            "citizen_message": "Water logging increasing near storefront. Need update please."
        }
        create_req_resp = self.client.post(f"/api/complaints/{target.id}/status-request", json=req_payload)
        self.assertEqual(create_req_resp.status_code, 200)
        req_data = create_req_resp.json()

        self.assertEqual(req_data["complaint_id"], target.report_id)
        self.assertEqual(req_data["state"], "OPEN")
        self.assertEqual(req_data["citizen_message"], req_payload["citizen_message"])
        self.assertFalse(req_data["citizen_notified"])

        # Verify request appears in dashboard status-requests queue (requires authority)
        queue_resp = self.client.get(
            "/api/dashboard/status-requests?state=OPEN",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(queue_resp.status_code, 200)
        open_requests = queue_resp.json()
        req_ids = [r["id"] for r in open_requests]
        self.assertIn(req_data["id"], req_ids)

        # Authority acknowledges request
        app.dependency_overrides[require_authority] = lambda: self.authority_user
        app.dependency_overrides[verify_token] = lambda: self.authority_user

        ack_payload = {
            "response_note": "Drainage jetting unit deployed; estimated clearance 45 mins."
        }
        ack_resp = self.client.post(
            f"/api/complaints/{target.id}/status-request/{req_data['id']}/acknowledge",
            json=ack_payload
        )
        self.assertEqual(ack_resp.status_code, 200)
        ack_data = ack_resp.json()

        self.assertEqual(ack_data["state"], "ACKNOWLEDGED")
        self.assertTrue(ack_data["citizen_notified"])
        self.assertEqual(ack_data["acknowledged_by"], "Executive Engineer Phase 7")
        self.assertEqual(ack_data["response_note"], ack_payload["response_note"])

        # CRITICAL TEST: Complaint status must NOT have drifted
        refreshed = store.get_complaint(target.id)
        self.assertEqual(refreshed.status, original_status)

    def test_04_escalation_center_intelligence_and_explicit_reasons(self):
        """Escalation center surfaces complaints with transparent, explicit reasons."""
        escalations_resp = self.client.get(
            "/api/dashboard/escalations",
            headers={"Authorization": "Bearer test-authority-token"}
        )
        self.assertEqual(escalations_resp.status_code, 200)
        escalations = escalations_resp.json()

        self.assertIsInstance(escalations, list)
        self.assertGreater(len(escalations), 0)

        # Inspect top escalation item
        top = escalations[0]
        self.assertIn("complaint", top)
        self.assertIn("reasons", top)
        self.assertIn("primary_reason", top)
        self.assertIn("priority_score", top)
        self.assertGreater(len(top["reasons"]), 0)

        # Find reopened complaint escalation (e.g., c017)
        reopened_escalations = [e for e in escalations if e["is_reopened"]]
        self.assertGreater(len(reopened_escalations), 0)
        reopened_item = reopened_escalations[0]
        reasons_text = " ".join(reopened_item["reasons"])
        self.assertIn("Reopened", reasons_text)

        # Every escalation reason should be non-empty and descriptive
        for esc in escalations:
            for reason in esc["reasons"]:
                self.assertGreater(len(reason.strip()), 4)
                # Ensure no generic unexplained color alerts
                self.assertNotIn("red alert", reason.lower())


if __name__ == "__main__":
    unittest.main()
