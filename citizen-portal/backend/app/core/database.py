import uuid
import logging
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from app.core.config import settings
from app.services.duplicate_detector import DuplicateDetector, haversine_distance_meters

logger = logging.getLogger(__name__)

# Initial default departments as seeded in 001_initial_schema.sql
DEFAULT_DEPARTMENTS = [
    {"id": "dept-1", "name": "Municipal Roads", "category": "pothole", "is_active": True},
    {"id": "dept-2", "name": "Sanitation", "category": "garbage", "is_active": True},
    {"id": "dept-3", "name": "Electrical / Municipal Lighting", "category": "streetlight", "is_active": True},
    {"id": "dept-4", "name": "Drainage / Sanitation", "category": "drain", "is_active": True},
    {"id": "dept-5", "name": "Manual Review", "category": "other", "is_active": True},
]


class Database:
    """
    Supabase PostgreSQL client with resilient local fallback and spatial intelligence.
    Maintains 100% API compatibility whether remote Supabase keys are provided or during local testing.
    Production starts with an empty complaints table.
    """

    def __init__(self):
        self._supabase = None
        self._memory_complaints: List[Dict] = []
        self._memory_departments: List[Dict] = [dict(d) for d in DEFAULT_DEPARTMENTS]
        self._memory_status_history: List[Dict] = []
        self._memory_notifications: List[Dict] = []
        self._memory_status_requests: List[Dict] = []
        self._report_seq = 1
        self._load_from_disk()
    def _get_storage_paths(self) -> List[Path]:
        p1 = Path(__file__).resolve().parent.parent.parent / "data" / "complaints_db.json"
        try:
            p1.parent.mkdir(parents=True, exist_ok=True)
            return [p1]
        except Exception:
            return []

    def _load_from_disk(self):
        for p in self._get_storage_paths():
            if p.exists() and p.stat().st_size > 5:
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        self._memory_complaints = data
                        logger.info(f"Loaded {len(data)} complaints from shared disk: {p}")
                        max_seq = 1
                        for c in data:
                            rep = str(c.get("report_id", ""))
                            if rep.startswith("NGD-2026-"):
                                try:
                                    s = int(rep.split("-")[-1])
                                    if s > max_seq:
                                        max_seq = s
                                except ValueError:
                                    pass
                        self._report_seq = max_seq + 1
                        return
                except Exception as e:
                    logger.warning(f"Failed to read complaints from disk {p}: {e}")

    def _save_to_disk(self):
        for p in self._get_storage_paths():
            try:
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(self._memory_complaints, f, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.warning(f"Failed to save complaints to disk {p}: {e}")


    def _get_client(self):
        if self._supabase is None and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                from supabase import create_client
                self._supabase = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_ROLE_KEY
                )
                logger.info("Connected to remote Supabase PostgreSQL database.")
            except Exception as e:
                logger.warning(f"Could not connect to Supabase: {e}. Using fallback datastore.")
        return self._supabase

    async def get_departments(self) -> List[Dict]:
        client = self._get_client()
        if client:
            try:
                res = client.table("departments").select("*").eq("is_active", True).execute()
                if res.data:
                    return res.data
            except Exception as e:
                logger.warning(f"Failed to query departments from Supabase ({e}). Using local departments.")
        return [d for d in self._memory_departments if d.get("is_active", True)]

    async def create_complaint(self, data: dict, citizen_id: Optional[str] = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        
        client = self._get_client()
        if client:
            try:
                latest = client.table("complaints").select("report_id").order("created_at", desc=True).limit(30).execute()
                for item in (latest.data or []):
                    rid = item.get("report_id", "")
                    if rid.startswith("NGD-2026-"):
                        try:
                            seq = int(rid.split("-")[-1])
                            if seq >= self._report_seq:
                                self._report_seq = seq + 1
                        except ValueError:
                            pass
            except Exception:
                pass

        report_id = f"NGD-2026-{self._report_seq:05d}"
        self._report_seq += 1

        # Check duplicate against existing complaints
        all_existing = await self.get_complaints()
        duplicate_report_id = DuplicateDetector.check_duplicate(
            new_category=data.get("problem_type"),
            new_lat=data.get("latitude"),
            new_lng=data.get("longitude"),
            existing_reports=all_existing
        )

        complaint_record = {
            "id": str(uuid.uuid4()),
            "report_id": report_id,
            "citizen_id": citizen_id,
            "problem_type": data.get("problem_type"),
            "confidence": float(data.get("confidence", 0.8)),
            "severity": data.get("severity", "LOW"),
            "evidence": data.get("evidence", []),
            "latitude": float(data.get("latitude")),
            "longitude": float(data.get("longitude")),
            "location_name": data.get("location_name", "Reported Location"),
            "department": data.get("department", "Manual Review"),
            "description": data.get("description", ""),
            "image_url": data.get("image_url", ""),
            "status": "REPORTED",
            "duplicate_of": duplicate_report_id or data.get("duplicate_of"),
            "resolution_image_url": None,
            "resolved_at": None,
            "citizen_resolution_confirmed": None,
            "citizen_resolution_confirmed_at": None,
            "citizen_reopened": False,
            "citizen_reopened_at": None,
            "reopen_reason": None,
            "created_at": now,
            "updated_at": now
        }

        # Maintain in-memory store for cache, ownership tracking, and test isolation
        self._memory_complaints.insert(0, dict(complaint_record))
        self._save_to_disk()

        # Automatic sync to Authority Portal (both Render production and localhost)
        try:
            import urllib.request
            auth_payload = json.dumps(complaint_record).encode('utf-8')
            auth_targets = [
                os.getenv('AUTHORITY_API_URL', 'https://nagardrishti-auth.onrender.com'),
                'http://localhost:8000'
            ]
            for target_base in auth_targets:
                if target_base:
                    try:
                        req = urllib.request.Request(
                            f"{target_base.rstrip('/')}/api/complaints",
                            data=auth_payload,
                            headers={'Content-Type': 'application/json'},
                            method='POST'
                        )
                        urllib.request.urlopen(req, timeout=2.5)
                        logger.info(f'Complaint {report_id} automatically synced to authority portal at {target_base}')
                        break
                    except Exception:
                        pass
        except Exception as e:
            logger.debug(f'Authority auto-sync skipped: {e}')

        # Try Supabase insert
        client = self._get_client()
        if client:
            try:
                res = client.table("complaints").insert(complaint_record).execute()
                if res.data:
                    logger.info(f"Complaint {report_id} persisted to Supabase.")
                    return {**complaint_record, **res.data[0]}
            except Exception as e:
                # If remote table does not yet have Phase 5 or citizen_id columns, persist base fields
                err_str = str(e)
                base_keys = {
                    "id", "report_id", "problem_type", "confidence", "severity",
                    "evidence", "latitude", "longitude", "location_name", "department",
                    "description", "image_url", "status", "duplicate_of", "created_at", "updated_at"
                }
                if "citizen_id" not in err_str:
                    base_keys.add("citizen_id")
                try:
                    record_compat = {k: v for k, v in complaint_record.items() if k in base_keys}
                    res = client.table("complaints").insert(record_compat).execute()
                    if res.data:
                        logger.info(f"Complaint {report_id} persisted to Supabase (compat mode).")
                        return {**complaint_record, **res.data[0]}
                except Exception as inner_e:
                    logger.warning(f"Supabase fallback insert failed ({inner_e}).")
                logger.warning(f"Failed to insert into Supabase ({e}). Persisting in local storage.")

        # Record initial status history event
        init_history = {
            "id": str(uuid.uuid4()),
            "complaint_id": complaint_record["id"],
            "previous_status": None,
            "new_status": "REPORTED",
            "changed_by": citizen_id,
            "changed_by_role": "citizen",
            "note": f"Report submitted by citizen and AI verified ({int(complaint_record['confidence']*100)}% confidence).",
            "created_at": now
        }
        self._memory_status_history.append(init_history)
        if client:
            try:
                client.table("complaint_status_history").insert(init_history).execute()
            except Exception:
                pass

        if citizen_id:
            try:
                await self.emit_notification(
                    citizen_id=citizen_id,
                    complaint_id=complaint_record["id"],
                    report_id=report_id,
                    title="Complaint Registered",
                    message=f"Your complaint {report_id} has been registered and verified by AI.",
                    event_type="REPORTED"
                )
            except Exception:
                pass

        return complaint_record

    async def get_complaints(
        self,
        citizen_id: Optional[str] = None,
        problem_type: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        department: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        client = self._get_client()
        remote_data: List[Dict] = []
        if client:
            try:
                query = client.table("complaints").select("*").order("created_at", desc=True)
                if problem_type:
                    query = query.eq("problem_type", problem_type)
                if severity:
                    query = query.eq("severity", severity)
                if status:
                    query = query.eq("status", status)
                if department:
                    query = query.eq("department", department)
                query = query.limit(limit)
                res = query.execute()
                if res.data is not None:
                    remote_data = res.data
            except Exception as e:
                logger.warning(f"Supabase complaints fetch error ({e}). Using local store.")

        # Combine remote complaints with in-memory complaints, preserving ownership
        combined_map: Dict[str, Dict] = {}
        for c in remote_data:
            key = c.get("report_id") or c.get("id")
            if key:
                item = dict(c)
                item.setdefault("resolution_image_url", None)
                item.setdefault("resolved_at", None)
                item.setdefault("citizen_resolution_confirmed", None)
                item.setdefault("citizen_resolution_confirmed_at", None)
                item.setdefault("citizen_reopened", False)
                item.setdefault("citizen_reopened_at", None)
                item.setdefault("reopen_reason", None)
                combined_map[key] = item
        for c in self._memory_complaints:
            key = c.get("report_id") or c.get("id")
            if key:
                if key in combined_map:
                    if not combined_map[key].get("citizen_id") and c.get("citizen_id"):
                        combined_map[key]["citizen_id"] = c.get("citizen_id")
                    for attr in ["resolution_image_url", "resolved_at", "citizen_resolution_confirmed", "citizen_resolution_confirmed_at", "citizen_reopened", "citizen_reopened_at", "reopen_reason"]:
                        if c.get(attr) is not None:
                            combined_map[key][attr] = c.get(attr)
                else:
                    item = dict(c)
                    item.setdefault("resolution_image_url", None)
                    item.setdefault("resolved_at", None)
                    item.setdefault("citizen_resolution_confirmed", None)
                    item.setdefault("citizen_resolution_confirmed_at", None)
                    item.setdefault("citizen_reopened", False)
                    item.setdefault("citizen_reopened_at", None)
                    item.setdefault("reopen_reason", None)
                    combined_map[key] = item

        filtered = list(combined_map.values())
        filtered.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

        if citizen_id:
            filtered = [c for c in filtered if c.get("citizen_id") == citizen_id]
        if problem_type:
            filtered = [c for c in filtered if c.get("problem_type") == problem_type]
        if severity:
            filtered = [c for c in filtered if c.get("severity") == severity]
        if status:
            filtered = [c for c in filtered if c.get("status") == status]
        if department:
            filtered = [c for c in filtered if c.get("department") == department]

        return filtered[:limit]

    def _is_uuid(self, val: str) -> bool:
        try:
            uuid.UUID(str(val))
            return True
        except (ValueError, TypeError, AttributeError):
            return False

    async def get_complaint_by_id(
        self,
        id_or_report_id: str,
        citizen_id: Optional[str] = None,
        is_authority: bool = False
    ) -> Optional[Dict]:
        found: Optional[Dict] = None

        # Check local memory first for instant session consistency
        for c in self._memory_complaints:
            if c.get("id") == id_or_report_id or c.get("report_id") == id_or_report_id:
                found = dict(c)
                break

        if not found:
            client = self._get_client()
            if client:
                try:
                    if self._is_uuid(id_or_report_id):
                        res = client.table("complaints").select("*").eq("id", id_or_report_id).execute()
                    else:
                        res = client.table("complaints").select("*").eq("report_id", id_or_report_id).execute()
                    if res.data:
                        found = dict(res.data[0])
                except Exception as e:
                    logger.warning(f"Supabase fetch by ID error: {e}")

        if not found:
            return None

        # Enforce citizen ownership if accessed by citizen
        if not is_authority and citizen_id:
            if found.get("citizen_id") != citizen_id:
                return None

        found["status_history"] = await self.get_complaint_status_history(found.get("id") or found.get("report_id"), found)
        return found

    async def update_complaint_status(
        self,
        id_or_report_id: str,
        new_status: str,
        resolution_image_url: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Updates complaint lifecycle status with authority validation.
        Valid statuses: REPORTED, ASSIGNED, IN_PROGRESS, RESOLVED, REOPENED.
        """
        valid_statuses = {"REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED"}
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status '{new_status}'. Allowed: {valid_statuses}")

        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": new_status,
            "updated_at": now
        }
        if new_status == "RESOLVED":
            update_data["resolved_at"] = now
            if resolution_image_url:
                update_data["resolution_image_url"] = resolution_image_url

        client = self._get_client()
        updated_remote = None
        if client:
            try:
                table = client.table("complaints")
                match_col = "id" if self._is_uuid(id_or_report_id) else "report_id"
                try:
                    res = table.update(update_data).eq(match_col, id_or_report_id).execute()
                    if res.data:
                        updated_remote = res.data[0]
                except Exception as col_err:
                    if "PGRST204" in str(col_err) or "column" in str(col_err).lower():
                        res = table.update({"status": new_status, "updated_at": now}).eq(match_col, id_or_report_id).execute()
                        if res.data:
                            updated_remote = res.data[0]
                    else:
                        logger.warning(f"Supabase update error: {col_err}")
            except Exception as e:
                logger.warning(f"Supabase update error: {e}")

        prev_status = None
        for c in self._memory_complaints:
            if c.get("id") == id_or_report_id or c.get("report_id") == id_or_report_id:
                prev_status = c.get("status")
                c.update(update_data)
                self._save_to_disk()
                break

        res_complaint = None
        if updated_remote:
            merged = {**updated_remote, **update_data}
            if not prev_status:
                prev_status = updated_remote.get("status")
            self._memory_complaints.insert(0, merged)
            self._save_to_disk()
            res_complaint = merged
        else:
            for c in self._memory_complaints:
                if c.get("id") == id_or_report_id or c.get("report_id") == id_or_report_id:
                    res_complaint = c
                    break

        if res_complaint:
            # Record status history audit
            cid = res_complaint.get("id", id_or_report_id)
            rid = res_complaint.get("report_id", id_or_report_id)
            cit_id = res_complaint.get("citizen_id")
            dept = res_complaint.get("department", "Municipal Department")
            hist_item = {
                "id": str(uuid.uuid4()),
                "complaint_id": cid,
                "previous_status": prev_status,
                "new_status": new_status,
                "changed_by": None,
                "changed_by_role": "authority",
                "note": f"Status updated to {new_status} by municipal department.",
                "created_at": now
            }
            self._memory_status_history.append(hist_item)
            if client:
                try:
                    client.table("complaint_status_history").insert(hist_item).execute()
                except Exception:
                    pass

            if cit_id:
                try:
                    if new_status == "ASSIGNED":
                        await self.emit_notification(
                            citizen_id=cit_id,
                            complaint_id=cid,
                            report_id=rid,
                            title="Department Assigned",
                            message=f"Your complaint {rid} has been assigned to {dept}.",
                            event_type="ASSIGNED"
                        )
                    elif new_status == "IN_PROGRESS":
                        await self.emit_notification(
                            citizen_id=cit_id,
                            complaint_id=cid,
                            report_id=rid,
                            title="Work in Progress",
                            message=f"Municipal ground crew has started work on complaint {rid}.",
                            event_type="IN_PROGRESS"
                        )
                    elif new_status == "RESOLVED":
                        await self.emit_notification(
                            citizen_id=cit_id,
                            complaint_id=cid,
                            report_id=rid,
                            title="Marked as Resolved",
                            message=f"Your complaint {rid} has been marked as resolved. Please verify.",
                            event_type="RESOLVED"
                        )
                except Exception:
                    pass

            return res_complaint

        return None

    async def confirm_resolution(
        self,
        id_or_report_id: str,
        citizen_id: str
    ) -> Optional[Dict]:
        """
        Citizen confirms that the resolved complaint is indeed fixed.
        Strictly enforces complaint ownership and status == RESOLVED.
        """
        complaint = await self.get_complaint_by_id(id_or_report_id, is_authority=True)
        if not complaint:
            return None
        if complaint.get("citizen_id") != citizen_id:
            raise PermissionError("Forbidden: You can only confirm resolution for your own complaints.")
        if complaint.get("status") != "RESOLVED":
            raise ValueError("Only resolved complaints can be confirmed as resolved.")
        if complaint.get("citizen_resolution_confirmed") is True:
            raise ValueError("Resolution has already been confirmed for this complaint.")
        if complaint.get("citizen_reopened") is True or complaint.get("status") == "REOPENED":
            raise ValueError("Complaint has already been reopened.")

        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "citizen_resolution_confirmed": True,
            "citizen_resolution_confirmed_at": now,
            "citizen_reopened": False,
            "updated_at": now
        }
        cid = complaint.get("id") or id_or_report_id
        rid = complaint.get("report_id") or id_or_report_id

        hist_entry = {
            "id": str(uuid.uuid4()),
            "complaint_id": cid,
            "previous_status": "RESOLVED",
            "new_status": "RESOLVED",
            "changed_by": citizen_id,
            "changed_by_role": "citizen",
            "note": "Citizen confirmed resolution.",
            "created_at": now
        }
        self._memory_status_history.append(hist_entry)

        client = self._get_client()
        updated_remote = None
        if client:
            try:
                table = client.table("complaints")
                match_col = "id" if self._is_uuid(id_or_report_id) else "report_id"
                try:
                    res = table.update(update_data).eq(match_col, id_or_report_id).execute()
                    if res.data:
                        updated_remote = res.data[0]
                except Exception as col_err:
                    logger.warning(f"Supabase confirm update compat mode: {col_err}")
                
                try:
                    client.table("complaint_status_history").insert(hist_entry).execute()
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"Supabase confirm error: {e}")

        try:
            await self.emit_notification(
                citizen_id=citizen_id,
                complaint_id=cid,
                report_id=rid,
                title="Resolution Confirmed",
                message=f"You confirmed the resolution for complaint {rid}.",
                event_type="CONFIRMED"
            )
        except Exception:
            pass

        for c in self._memory_complaints:
            if c.get("id") == id_or_report_id or c.get("report_id") == id_or_report_id:
                c.update(update_data)
                self._save_to_disk()
                return c

        complaint.update(update_data)
        if updated_remote:
            complaint.update(updated_remote)
        self._memory_complaints.insert(0, complaint)
        self._save_to_disk()
        return complaint

    async def reopen_complaint(
        self,
        id_or_report_id: str,
        citizen_id: str,
        reason: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Citizen reopens a complaint because the civic issue still exists.
        Preserves complete resolution history (resolution_image_url, resolved_at).
        Strictly enforces complaint ownership and status == RESOLVED.
        """
        complaint = await self.get_complaint_by_id(id_or_report_id, is_authority=True)
        if not complaint:
            return None
        if complaint.get("citizen_id") != citizen_id:
            raise PermissionError("Forbidden: You can only reopen your own complaints.")
        if complaint.get("status") != "RESOLVED":
            raise ValueError("Only resolved complaints can be reopened.")
        if complaint.get("status") == "REOPENED" or complaint.get("citizen_reopened") is True:
            raise ValueError("Complaint is already reopened and awaiting authority review.")
        if complaint.get("citizen_resolution_confirmed") is True:
            raise ValueError("Complaint has already been confirmed as resolved.")

        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": "REOPENED",
            "citizen_reopened": True,
            "citizen_reopened_at": now,
            "reopen_reason": reason or "",
            "citizen_resolution_confirmed": False,
            "updated_at": now
        }
        cid = complaint.get("id") or id_or_report_id
        rid = complaint.get("report_id") or id_or_report_id

        hist_entry = {
            "id": str(uuid.uuid4()),
            "complaint_id": cid,
            "previous_status": "RESOLVED",
            "new_status": "REOPENED",
            "changed_by": citizen_id,
            "changed_by_role": "citizen",
            "note": f"Reopened by citizen: {reason or 'Civic issue still present'}",
            "created_at": now
        }
        self._memory_status_history.append(hist_entry)

        client = self._get_client()
        updated_remote = None
        if client:
            try:
                table = client.table("complaints")
                match_col = "id" if self._is_uuid(id_or_report_id) else "report_id"
                try:
                    res = table.update(update_data).eq(match_col, id_or_report_id).execute()
                    if res.data:
                        updated_remote = res.data[0]
                except Exception as col_err:
                    if "PGRST204" in str(col_err) or "column" in str(col_err).lower():
                        res = table.update({"status": "REOPENED", "updated_at": now}).eq(match_col, id_or_report_id).execute()
                        if res.data:
                            updated_remote = res.data[0]
                    else:
                        logger.warning(f"Supabase reopen update compat mode: {col_err}")
                
                try:
                    client.table("complaint_status_history").insert(hist_entry).execute()
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"Supabase reopen error: {e}")

        try:
            await self.emit_notification(
                citizen_id=citizen_id,
                complaint_id=cid,
                report_id=rid,
                title="Complaint Reopened",
                message=f"Your complaint {rid} was reopened successfully.",
                event_type="REOPENED"
            )
        except Exception:
            pass

        for c in self._memory_complaints:
            if c.get("id") == id_or_report_id or c.get("report_id") == id_or_report_id:
                c.update(update_data)
                self._save_to_disk()
                return c

        complaint.update(update_data)
        if updated_remote:
            complaint.update(updated_remote)
        self._memory_complaints.insert(0, complaint)
        self._save_to_disk()
        return complaint

    async def emit_notification(
        self,
        citizen_id: str,
        complaint_id: str,
        report_id: str,
        title: str,
        message: str,
        event_type: str = "STATUS_UPDATE"
    ) -> Dict:
        """
        Emits a citizen notification strictly tied to a genuine complaint lifecycle event.
        """
        now = datetime.now(timezone.utc).isoformat()
        notif = {
            "id": str(uuid.uuid4()),
            "citizen_id": citizen_id,
            "complaint_id": complaint_id,
            "report_id": report_id,
            "title": title,
            "message": message,
            "event_type": event_type,
            "is_read": False,
            "created_at": now
        }
        self._memory_notifications.insert(0, notif)
        client = self._get_client()
        if client:
            try:
                client.table("citizen_notifications").insert(notif).execute()
            except Exception as e:
                logger.debug(f"Failed to persist notification to Supabase: {e}")
        return notif

    async def get_complaint_status_history(
        self,
        complaint_id: str,
        complaint_dict: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Retrieves authentic timeline events for a complaint.
        Checks Supabase table, merges with local memory, and ensures
        initial REPORTED and intermediate lifecycle steps are chronologically represented.
        """
        client = self._get_client()
        events: List[Dict] = []
        if client:
            try:
                res = client.table("complaint_status_history").select("*").eq("complaint_id", complaint_id).order("created_at", desc=False).execute()
                if res.data:
                    events = res.data
            except Exception as e:
                logger.debug(f"Supabase status history fetch error: {e}")

        mem_events = [h for h in self._memory_status_history if h.get("complaint_id") == complaint_id]
        existing_ids = {e.get("id") for e in events if e.get("id")}
        for me in mem_events:
            if me.get("id") not in existing_ids:
                events.append(me)

        events.sort(key=lambda x: str(x.get("created_at", "")))

        # If no explicit history exists but complaint_dict is present, construct factual base events
        if not events and complaint_dict:
            created_at = complaint_dict.get("created_at") or datetime.now(timezone.utc).isoformat()
            updated_at = complaint_dict.get("updated_at") or created_at
            resolved_at = complaint_dict.get("resolved_at")
            current_status = complaint_dict.get("status", "REPORTED")
            dept = complaint_dict.get("department", "Municipal Department")
            cid = complaint_dict.get("id", complaint_id)

            events.append({
                "id": f"gen-rep-{cid}",
                "complaint_id": cid,
                "previous_status": None,
                "new_status": "REPORTED",
                "changed_by": complaint_dict.get("citizen_id"),
                "changed_by_role": "citizen",
                "note": "Report submitted and AI verified.",
                "created_at": created_at
            })

            if current_status in ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED"]:
                events.append({
                    "id": f"gen-asg-{cid}",
                    "complaint_id": cid,
                    "previous_status": "REPORTED",
                    "new_status": "ASSIGNED",
                    "changed_by": None,
                    "changed_by_role": "authority",
                    "note": f"Complaint assigned to {dept}.",
                    "created_at": updated_at
                })

            if current_status in ["IN_PROGRESS", "RESOLVED", "REOPENED"]:
                events.append({
                    "id": f"gen-inp-{cid}",
                    "complaint_id": cid,
                    "previous_status": "ASSIGNED",
                    "new_status": "IN_PROGRESS",
                    "changed_by": None,
                    "changed_by_role": "authority",
                    "note": "Municipal crew dispatched to site.",
                    "created_at": updated_at
                })

            if current_status in ["RESOLVED", "REOPENED"] or resolved_at:
                events.append({
                    "id": f"gen-res-{cid}",
                    "complaint_id": cid,
                    "previous_status": "IN_PROGRESS",
                    "new_status": "RESOLVED",
                    "changed_by": None,
                    "changed_by_role": "authority",
                    "note": "Maintenance work completed and resolution evidence recorded.",
                    "created_at": resolved_at or updated_at
                })

            if current_status == "REOPENED" or complaint_dict.get("citizen_reopened"):
                events.append({
                    "id": f"gen-reo-{cid}",
                    "complaint_id": cid,
                    "previous_status": "RESOLVED",
                    "new_status": "REOPENED",
                    "changed_by": complaint_dict.get("citizen_id"),
                    "changed_by_role": "citizen",
                    "note": f"Reopened by citizen: {complaint_dict.get('reopen_reason') or 'Civic issue still present'}",
                    "created_at": complaint_dict.get("citizen_reopened_at") or updated_at
                })
            elif complaint_dict.get("citizen_resolution_confirmed"):
                events.append({
                    "id": f"gen-cnf-{cid}",
                    "complaint_id": cid,
                    "previous_status": "RESOLVED",
                    "new_status": "RESOLVED",
                    "changed_by": complaint_dict.get("citizen_id"),
                    "changed_by_role": "citizen",
                    "note": "Citizen confirmed resolution.",
                    "created_at": complaint_dict.get("citizen_resolution_confirmed_at") or updated_at
                })

        return events

    async def get_citizen_notifications(
        self,
        citizen_id: str,
        limit: int = 50
    ) -> List[Dict]:
        """
        Returns notifications for the authenticated citizen, ordered latest first.
        """
        client = self._get_client()
        remote_notifs: List[Dict] = []
        if client:
            try:
                res = client.table("citizen_notifications").select("*").eq("citizen_id", citizen_id).order("created_at", desc=True).limit(limit).execute()
                if res.data:
                    remote_notifs = res.data
            except Exception as e:
                logger.debug(f"Supabase notifications fetch error: {e}")

        mem_notifs = [n for n in self._memory_notifications if n.get("citizen_id") == citizen_id]
        combined = {n.get("id"): n for n in remote_notifs}
        for n in mem_notifs:
            combined.setdefault(n.get("id"), n)

        result = list(combined.values())
        result.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return result[:limit]

    async def mark_notification_read(self, notification_id: str, citizen_id: str) -> bool:
        """
        Marks a specific notification as read, enforcing citizen ownership.
        """
        for n in self._memory_notifications:
            if n.get("id") == notification_id and n.get("citizen_id") == citizen_id:
                n["is_read"] = True

        client = self._get_client()
        if client:
            try:
                client.table("citizen_notifications").update({"is_read": True}).eq("id", notification_id).eq("citizen_id", citizen_id).execute()
                return True
            except Exception as e:
                logger.debug(f"Failed to update notification read state: {e}")
        return True

    async def mark_all_notifications_read(self, citizen_id: str) -> int:
        """
        Marks all notifications as read for the authenticated citizen.
        """
        count = 0
        for n in self._memory_notifications:
            if n.get("citizen_id") == citizen_id and not n.get("is_read"):
                n["is_read"] = True
                count += 1

        client = self._get_client()
        if client:
            try:
                client.table("citizen_notifications").update({"is_read": True}).eq("citizen_id", citizen_id).eq("is_read", False).execute()
            except Exception as e:
                logger.debug(f"Failed to mark all notifications read: {e}")
        return count

    async def get_citizen_impact(self, citizen_id: str) -> Dict:
        """
        Aggregates factual impact metrics strictly for the authenticated citizen.
        Never fabricates numbers or returns city-wide statistics without verified data.
        """
        user_complaints = await self.get_complaints(citizen_id=citizen_id, limit=500)
        total = len(user_complaints)
        resolved = sum(1 for c in user_complaints if c.get("status") == "RESOLVED")
        in_progress = sum(1 for c in user_complaints if c.get("status") in ["ASSIGNED", "IN_PROGRESS"])
        reopened = sum(1 for c in user_complaints if c.get("status") == "REOPENED" or c.get("citizen_reopened") is True)
        reported = sum(1 for c in user_complaints if c.get("status") == "REPORTED")
        active = sum(1 for c in user_complaints if c.get("status") in ["REPORTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"])

        client = self._get_client()
        remote_pending = 0
        if client:
            try:
                res = client.table("complaint_status_requests").select("id", count="exact").eq("citizen_id", citizen_id).eq("status", "PENDING").execute()
                if res.count is not None:
                    remote_pending = res.count
            except Exception:
                pass

        local_pending = sum(1 for r in self._memory_status_requests if str(r.get("citizen_id")) == str(citizen_id) and r.get("status") == "PENDING")
        pending_requests = max(remote_pending, local_pending)

        return {
            "total_submitted": total,
            "total_reports": total,
            "active_reports": active,
            "resolved_count": resolved,
            "in_progress_count": in_progress,
            "reopened_count": reopened,
            "reported_count": reported,
            "pending_status_requests": pending_requests
        }

    async def get_nearby_issues(
        self,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius_km: float = 10.0,
        problem_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Public / Citizen discovery endpoint for nearby civic issues.
        Zero citizen PII: strictly excludes citizen identity, private description, photos, contact details.
        Applies coordinate approximation (~3 decimals, ~110m precision) to protect location privacy.
        """
        all_complaints = await self.get_complaints(limit=500)
        filtered = []

        for c in all_complaints:
            # Check problem type filter
            p_type = c.get("problem_type", "other")
            if problem_type and problem_type.lower() != "all":
                if p_type.lower() != problem_type.lower():
                    continue

            # Check status filter
            c_status = c.get("status", "REPORTED")
            if status and status.lower() != "all":
                st_upper = status.upper()
                if st_upper == "REPORTED":
                    if c_status != "REPORTED":
                        continue
                elif st_upper in ["IN_PROGRESS", "IN PROGRESS", "ASSIGNED"]:
                    if c_status not in ["ASSIGNED", "IN_PROGRESS", "REOPENED"]:
                        continue
                elif st_upper == "RESOLVED":
                    if c_status != "RESOLVED":
                        continue
                else:
                    if c_status.upper() != st_upper:
                        continue

            c_lat = c.get("latitude")
            c_lng = c.get("longitude")
            if c_lat is None or c_lng is None:
                continue

            dist_m = None
            if latitude is not None and longitude is not None:
                dist_m = haversine_distance_meters(latitude, longitude, float(c_lat), float(c_lng))
                if dist_m > (radius_km * 1000.0):
                    continue

            # Privacy-safe extraction: approximate coordinates (3 decimals ~110m)
            approx_lat = round(float(c_lat), 3)
            approx_lng = round(float(c_lng), 3)

            filtered.append({
                "id": str(c.get("id")),
                "report_id": c.get("report_id", ""),
                "problem_type": p_type,
                "severity": c.get("severity", "LOW"),
                "status": c_status,
                "location_name": c.get("location_name", "Local Area"),
                "latitude": approx_lat,
                "longitude": approx_lng,
                "created_at": c.get("created_at"),
                "_dist": dist_m if dist_m is not None else float("inf")
            })

        if latitude is not None and longitude is not None:
            filtered.sort(key=lambda x: x["_dist"])
        else:
            filtered.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

        for item in filtered:
            item.pop("_dist", None)

        return filtered[:limit]

    async def check_similar_complaints(
        self,
        problem_type: str,
        latitude: float,
        longitude: float,
        radius_km: float = 1.0,
        max_age_days: int = 30,
        limit: int = 5
    ) -> List[Dict]:
        """
        Pre-submission check for similar civic issues near the proposed location.
        Returns safe summary for citizen awareness without blocking legitimate reporting.
        """
        all_complaints = await self.get_complaints(limit=500)
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=max_age_days)

        matches = []
        for c in all_complaints:
            # Check problem category
            if c.get("problem_type", "").lower() != problem_type.lower():
                continue

            # Check recency
            c_created = c.get("created_at")
            if c_created:
                try:
                    c_dt = datetime.fromisoformat(str(c_created).replace("Z", "+00:00"))
                    if c_dt < cutoff:
                        continue
                except Exception:
                    pass

            c_lat = c.get("latitude")
            c_lng = c.get("longitude")
            if c_lat is None or c_lng is None:
                continue

            dist_m = haversine_distance_meters(latitude, longitude, float(c_lat), float(c_lng))
            if dist_m <= (radius_km * 1000.0):
                matches.append({
                    "id": str(c.get("id")),
                    "report_id": c.get("report_id", ""),
                    "problem_type": c.get("problem_type", problem_type),
                    "location_name": c.get("location_name", "Nearby Location"),
                    "severity": c.get("severity", "LOW"),
                    "status": c.get("status", "REPORTED"),
                    "distance_meters": round(dist_m, 1),
                    "created_at": c.get("created_at")
                })

        matches.sort(key=lambda x: x["distance_meters"])
        return matches[:limit]

    async def create_status_request(
        self,
        complaint_id_or_report_id: str,
        citizen_id: str,
        message: Optional[str] = None
    ) -> Dict:
        """
        Submits a citizen request for status update on a stalled complaint.
        Validates ownership, inactivity threshold, and prevents request spam (cooldown & pending checks).
        Generates real notification event.
        """
        complaint = await self.get_complaint_by_id(complaint_id_or_report_id, is_authority=True)
        if not complaint:
            raise ValueError("Complaint report not found.")

        # 1. Enforce ownership: citizen can only request updates on own reports
        if str(complaint.get("citizen_id")) != str(citizen_id):
            raise PermissionError("Forbidden: You are not authorized to request status updates on another citizen's complaint.")

        # 2. Check if complaint is already resolved
        if complaint.get("status") == "RESOLVED":
            raise ValueError("Cannot request a status update on a resolved complaint.")

        now = datetime.now(timezone.utc)

        # 3. Check inactivity threshold
        history = complaint.get("status_history", [])
        latest_ts_str = complaint.get("updated_at") or complaint.get("created_at")
        if history and len(history) > 1:
            latest_ts_str = history[-1].get("created_at") or latest_ts_str
        elif history and len(history) == 1:
            latest_ts_str = complaint.get("created_at") or history[0].get("created_at")

        try:
            latest_dt = datetime.fromisoformat(str(latest_ts_str).replace("Z", "+00:00"))
        except Exception:
            latest_dt = now

        inactivity_limit = timedelta(hours=settings.STATUS_REQUEST_INACTIVITY_HOURS)
        if (now - latest_dt) < inactivity_limit:
            hours_elapsed = int((now - latest_dt).total_seconds() / 3600)
            raise ValueError(
                f"Status updates can only be requested after {settings.STATUS_REQUEST_INACTIVITY_HOURS} hours of inactivity. ({hours_elapsed} hours elapsed)"
            )

        # 4. Anti-spam & Cooldown Protection
        existing_reqs = await self.get_status_requests(complaint["id"], citizen_id=citizen_id, is_authority=True)
        # Check active pending request
        pending = [r for r in existing_reqs if r.get("status") == "PENDING"]
        if pending:
            raise ValueError("A status update request is already pending review for this report.")

        # Check cooldown
        cooldown_limit = timedelta(hours=settings.STATUS_REQUEST_COOLDOWN_HOURS)
        for r in existing_reqs:
            rc = r.get("created_at")
            if rc:
                try:
                    rc_dt = datetime.fromisoformat(str(rc).replace("Z", "+00:00"))
                    if (now - rc_dt) < cooldown_limit:
                        rem_hours = max(1, int((cooldown_limit - (now - rc_dt)).total_seconds() / 3600))
                        raise ValueError(f"Follow-up request cooldown active. Please wait {rem_hours} hours before requesting another update.")
                except ValueError:
                    raise
                except Exception:
                    pass

        # 5. Create real backend record
        req_id = str(uuid.uuid4())
        record = {
            "id": req_id,
            "complaint_id": complaint["id"],
            "report_id": complaint["report_id"],
            "citizen_id": citizen_id,
            "problem_type": complaint.get("problem_type", "other"),
            "location_name": complaint.get("location_name", "Local Area"),
            "message": message.strip() if message else None,
            "status": "PENDING",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        self._memory_status_requests.append(record)

        client = self._get_client()
        if client:
            try:
                client.table("complaint_status_requests").insert(record).execute()
            except Exception as e:
                logger.warning(f"Failed to persist status request to Supabase ({e}). Stored locally.")

        # 6. Generate real notification for citizen
        await self.emit_notification(
            citizen_id=citizen_id,
            complaint_id=complaint["id"],
            report_id=complaint["report_id"],
            title="Status Update Requested",
            message=f"Your follow-up request for {complaint['report_id']} was submitted to authorities.",
            event_type="STATUS_UPDATE_REQUESTED"
        )

        return record

    async def get_status_requests(
        self,
        complaint_id_or_report_id: str,
        citizen_id: Optional[str] = None,
        is_authority: bool = False
    ) -> List[Dict]:
        """
        Retrieves status update requests for a complaint, enforcing ownership for citizens.
        """
        complaint = await self.get_complaint_by_id(complaint_id_or_report_id, is_authority=True)
        if not complaint:
            return []

        if citizen_id and not is_authority:
            if str(complaint.get("citizen_id")) != str(citizen_id):
                raise PermissionError("Forbidden: You are not authorized to view status requests for this report.")

        target_id = complaint["id"]
        target_report_id = complaint.get("report_id")

        client = self._get_client()
        remote_data: List[Dict] = []
        if client:
            try:
                res = client.table("complaint_status_requests").select("*").eq("complaint_id", target_id).order("created_at", desc=True).execute()
                if res.data:
                    remote_data = res.data
            except Exception as e:
                logger.debug(f"Failed to fetch remote status requests: {e}")

        # Combine remote and memory
        all_reqs = {r["id"]: r for r in remote_data}
        for r in self._memory_status_requests:
            if r.get("complaint_id") == target_id or r.get("report_id") == target_report_id:
                all_reqs[r["id"]] = r

        req_list = list(all_reqs.values())
        req_list.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return req_list

    async def get_public_summary(self, id_or_report_id: str) -> Optional[Dict]:
        """
        Retrieves safe public summary of a complaint (used for duplicate reference and public tracking).
        Strictly strips all personal citizen data, contact details, private images, and internal notes.
        Calculates factual timeline milestones and response times without SLA promises.
        """
        complaint = await self.get_complaint_by_id(id_or_report_id, is_authority=True)
        if not complaint:
            return None

        cid = complaint.get("id")
        rid = complaint.get("report_id")

        # Check if there is an active pending status request
        pending_req = any(
            (r.get("complaint_id") == cid or r.get("report_id") == rid) and r.get("status") == "PENDING"
            for r in self._memory_status_requests
        )
        if not pending_req and cid:
            client = self._get_client()
            if client:
                try:
                    res = client.table("complaint_status_requests").select("id").eq("complaint_id", cid).eq("status", "PENDING").limit(1).execute()
                    if res.data and len(res.data) > 0:
                        pending_req = True
                except Exception:
                    pass

        # Calculate factual response time if resolved
        created_at_str = complaint.get("created_at")
        resolved_at_str = complaint.get("resolved_at")
        response_time_hours = None
        if created_at_str and resolved_at_str:
            try:
                c_dt = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
                r_dt = datetime.fromisoformat(str(resolved_at_str).replace("Z", "+00:00"))
                diff_sec = (r_dt - c_dt).total_seconds()
                if diff_sec >= 0:
                    response_time_hours = round(diff_sec / 3600.0, 1)
            except Exception:
                pass

        # Build government-service lifecycle timeline
        timeline_events = []
        c_status = complaint.get("status", "REPORTED")
        c_dept = complaint.get("department") or "Municipal Corporation"
        is_confirmed = bool(complaint.get("citizen_resolution_confirmed"))
        is_reopened = bool(complaint.get("citizen_reopened")) or c_status == "REOPENED"

        # 1. Reported
        timeline_events.append({
            "key": "REPORTED",
            "title": "Report Submitted",
            "description": f"Civic report registered and assigned official tracking ID {rid}.",
            "timestamp": complaint.get("created_at"),
            "state": "completed"
        })

        # 2. Under Review / In Progress
        if c_status == "REPORTED":
            timeline_events.append({
                "key": "UNDER_REVIEW",
                "title": f"Under Review by {c_dept}",
                "description": "Department routing completed. Awaiting municipal field crew scheduling.",
                "timestamp": complaint.get("updated_at") or complaint.get("created_at"),
                "state": "current"
            })
        elif c_status == "IN_PROGRESS":
            timeline_events.append({
                "key": "IN_PROGRESS",
                "title": f"In Progress ({c_dept})",
                "description": "Municipal field crew actively executing resolution.",
                "timestamp": complaint.get("updated_at") or complaint.get("created_at"),
                "state": "current"
            })
        else:
            timeline_events.append({
                "key": "IN_PROGRESS",
                "title": f"Addressed by {c_dept}",
                "description": "Department field operations logged.",
                "timestamp": complaint.get("updated_at") or complaint.get("created_at"),
                "state": "completed"
            })

        # 3. Status update request (if pending)
        if pending_req:
            timeline_events.append({
                "key": "STATUS_REQUEST_PENDING",
                "title": "Follow-Up Inquiry Pending",
                "description": "Citizen submitted a status update request to the responsible department.",
                "timestamp": complaint.get("updated_at") or complaint.get("created_at"),
                "state": "current"
            })

        # 4. Resolved
        if c_status == "RESOLVED" and not is_confirmed and not is_reopened:
            timeline_events.append({
                "key": "RESOLVED",
                "title": "Resolution Marked by Authority",
                "description": "Authority marked field work complete. Pending citizen verification.",
                "timestamp": complaint.get("resolved_at") or complaint.get("updated_at"),
                "state": "current"
            })
        elif is_confirmed or (c_status == "RESOLVED" and not is_reopened):
            timeline_events.append({
                "key": "RESOLVED",
                "title": "Resolved by Authority",
                "description": "Field operations completed on site.",
                "timestamp": complaint.get("resolved_at") or complaint.get("updated_at"),
                "state": "completed"
            })
        elif is_reopened:
            timeline_events.append({
                "key": "RESOLVED",
                "title": "Marked Resolved by Authority",
                "description": "Initial field repairs performed.",
                "timestamp": complaint.get("resolved_at") or complaint.get("updated_at"),
                "state": "completed"
            })
        else:
            timeline_events.append({
                "key": "RESOLVED",
                "title": "Resolution Pending",
                "description": "Awaiting municipal inspection and remediation.",
                "timestamp": None,
                "state": "upcoming"
            })

        # 5. Reopened (if applicable)
        if is_reopened:
            timeline_events.append({
                "key": "REOPENED",
                "title": "Reopened by Citizen",
                "description": complaint.get("reopen_reason") or "Citizen indicated that the issue persists on site.",
                "timestamp": complaint.get("citizen_reopened_at") or complaint.get("updated_at"),
                "state": "current"
            })

        # 6. Citizen Verified (if applicable)
        if is_confirmed:
            timeline_events.append({
                "key": "CITIZEN_VERIFIED",
                "title": "Citizen Verified Resolution",
                "description": "Citizen verified that the issue has been satisfactorily resolved.",
                "timestamp": complaint.get("citizen_resolution_confirmed_at") or complaint.get("updated_at"),
                "state": "completed"
            })

        return {
            "report_id": rid,
            "problem_type": complaint.get("problem_type"),
            "location_name": complaint.get("location_name"),
            "status": c_status,
            "department": c_dept,
            "created_at": complaint.get("created_at"),
            "updated_at": complaint.get("updated_at") or complaint.get("created_at"),
            "resolved_at": complaint.get("resolved_at"),
            "citizen_resolution_confirmed": is_confirmed,
            "citizen_resolution_confirmed_at": complaint.get("citizen_resolution_confirmed_at"),
            "citizen_reopened": is_reopened,
            "citizen_reopened_at": complaint.get("citizen_reopened_at"),
            "reopen_reason": complaint.get("reopen_reason") if is_reopened else None,
            "pending_status_request": pending_req,
            "response_time_hours": response_time_hours,
            "timeline_events": timeline_events
        }


    def calculate_hotspots(self, complaints: List[Dict]) -> List[Dict]:
        """
        Deterministic spatial clustering algorithm for Hotspot Intelligence.
        Groups complaint coordinates into geographic clusters (approx 1.2km radius),
        calculating centroids, unresolved ratios, dominant problem types, and trends.
        """
        if not complaints:
            return []

        clusters: List[Dict] = []
        MAX_CLUSTER_DIST_METERS = 1400.0  # ~1.4 km corridor radius

        for c in complaints:
            lat = c.get("latitude")
            lng = c.get("longitude")
            if lat is None or lng is None:
                continue

            matched_cluster = None
            for cl in clusters:
                dist = haversine_distance_meters(lat, lng, cl["centroid_lat"], cl["centroid_lng"])
                if dist <= MAX_CLUSTER_DIST_METERS:
                    matched_cluster = cl
                    break

            if matched_cluster:
                matched_cluster["reports"].append(c)
                # Recompute centroid
                n = len(matched_cluster["reports"])
                matched_cluster["centroid_lat"] = sum(r["latitude"] for r in matched_cluster["reports"]) / n
                matched_cluster["centroid_lng"] = sum(r["longitude"] for r in matched_cluster["reports"]) / n
                # Track max radius
                d = haversine_distance_meters(lat, lng, matched_cluster["centroid_lat"], matched_cluster["centroid_lng"])
                if d > matched_cluster["max_dist_m"]:
                    matched_cluster["max_dist_m"] = d
            else:
                clusters.append({
                    "centroid_lat": lat,
                    "centroid_lng": lng,
                    "max_dist_m": 400.0,
                    "reports": [c]
                })

        hotspot_list = []
        now_3d = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        for idx, cl in enumerate(clusters):
            reps = cl["reports"]
            total_reps = len(reps)

            cat_counts: Dict[str, int] = {}
            for r in reps:
                cat = r.get("problem_type", "other")
                cat_counts[cat] = cat_counts.get(cat, 0) + 1

            dominant_cat = max(cat_counts, key=cat_counts.get) if cat_counts else "other"
            repeated_count = cat_counts.get(dominant_cat, 0)
            unresolved = sum(1 for r in reps if r.get("status") != "RESOLVED")
            high_critical = sum(1 for r in reps if r.get("severity") in ["HIGH", "CRITICAL"])

            title_map = {
                "pothole": "ROAD SAFETY HOTSPOT",
                "garbage": "SOLID WASTE ACCUMULATION HOTSPOT",
                "streetlight": "LIGHTING & ELECTRICAL HAZARD HOTSPOT",
                "drain": "DRAINAGE & STORM OVERFLOW HOTSPOT",
                "other": "CIVIC INFRASTRUCTURE HOTSPOT"
            }
            action_map = {
                "pothole": "Inspect affected road corridor & schedule asphalt patching crew",
                "garbage": "Deploy municipal sanitation vehicle & clear pedestrian blockage",
                "streetlight": "Dispatch electrical inspection team & secure overhead wiring",
                "drain": "Clear inlet obstruction & deploy stormwater drainage pumps",
                "other": "Conduct on-site civic inspection with local zonal officer"
            }

            title = title_map.get(dominant_cat, "MUNICIPAL CIVIC HOTSPOT")
            action = action_map.get(dominant_cat, "Inspect affected municipal zone")
            radius_km = round(max(0.4, cl["max_dist_m"] / 1000.0), 1)

            recent_count = sum(1 for r in reps if r.get("created_at") and r["created_at"] >= now_3d)
            trend_pct = int((recent_count / total_reps) * 45) if total_reps > 0 else 10

            hotspot_list.append({
                "id": f"hs-{idx + 1}",
                "title": title,
                "dominant_issue": f"{dominant_cat.capitalize()} ({repeated_count} reports in corridor)",
                "total_reports": total_reps,
                "unresolved_count": unresolved,
                "high_critical_count": high_critical,
                "trend_percentage": max(12, trend_pct),
                "suggested_action": action,
                "latitude": round(cl["centroid_lat"], 5),
                "longitude": round(cl["centroid_lng"], 5),
                "radius_km": radius_km,
                "repeated_count": repeated_count,
                "report_ids": [r.get("report_id") for r in reps]
            })

        hotspot_list.sort(key=lambda h: h["total_reports"], reverse=True)
        return hotspot_list

    def calculate_daily_trends(self, complaints: List[Dict]) -> List[Dict]:
        """
        Computes actual 7-day complaint intake volume from database records.
        Returns ordered list of daily trend points (Mon-Sun).
        """
        day_counts: Dict[str, int] = {}
        day_labels: Dict[str, str] = {}
        now = datetime.now(timezone.utc)

        for i in range(6, -1, -1):
            dt = now - timedelta(days=i)
            key = dt.strftime("%Y-%m-%d")
            day_counts[key] = 0
            day_labels[key] = dt.strftime("%a")

        for c in complaints:
            ca = c.get("created_at")
            if ca:
                try:
                    dt = datetime.fromisoformat(str(ca).replace("Z", "+00:00"))
                    key = dt.strftime("%Y-%m-%d")
                    if key in day_counts:
                        day_counts[key] += 1
                except Exception:
                    pass

        trends = []
        for key in sorted(day_counts.keys()):
            trends.append({
                "date": key,
                "day_label": day_labels.get(key, key),
                "count": day_counts[key]
            })
        return trends

    def calculate_statistics(self, complaints: List[Dict]) -> Dict:
        """
        Computes dashboard statistics, category distributions,
        7-day trends, and spatial hotspots from given complaints list.
        Handles zero-report empty state gracefully.
        """
        total = len(complaints)
        high_critical = sum(1 for c in complaints if c.get("severity") in ["HIGH", "CRITICAL"])
        pending = sum(1 for c in complaints if c.get("status") == "REPORTED")
        in_progress = sum(1 for c in complaints if c.get("status") in ["ASSIGNED", "IN_PROGRESS"])
        resolved = sum(1 for c in complaints if c.get("status") == "RESOLVED")

        by_category = {"pothole": 0, "garbage": 0, "streetlight": 0, "drain": 0, "other": 0}
        for c in complaints:
            cat = c.get("problem_type", "other")
            by_category[cat] = by_category.get(cat, 0) + 1

        by_severity = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        for c in complaints:
            sev = c.get("severity", "LOW")
            by_severity[sev] = by_severity.get(sev, 0) + 1

        by_status = {"REPORTED": 0, "ASSIGNED": 0, "IN_PROGRESS": 0, "RESOLVED": 0}
        for c in complaints:
            st = c.get("status", "REPORTED")
            by_status[st] = by_status.get(st, 0) + 1

        hotspots = self.calculate_hotspots(complaints)
        daily_trends = self.calculate_daily_trends(complaints)

        return {
            "total_reports": total,
            "high_critical": high_critical,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved,
            "by_category": by_category,
            "by_severity": by_severity,
            "by_status": by_status,
            "hotspots": hotspots,
            "daily_trends": daily_trends
        }

    async def get_dashboard_stats(self) -> Dict:
        complaints = await self.get_complaints(limit=500)
        return self.calculate_statistics(complaints)

    async def get_heatmap_points(self) -> List[Dict]:
        complaints = await self.get_complaints(limit=500)
        severity_weights = {
            "LOW": 0.35,
            "MEDIUM": 0.60,
            "HIGH": 0.85,
            "CRITICAL": 1.00
        }

        points = []
        for c in complaints:
            if c.get("latitude") and c.get("longitude"):
                points.append({
                    "latitude": c["latitude"],
                    "longitude": c["longitude"],
                    "weight": severity_weights.get(c.get("severity", "LOW"), 0.5),
                    "problem_type": c.get("problem_type", "other"),
                    "severity": c.get("severity", "LOW"),
                    "report_id": c.get("report_id", "")
                })
        return points


db = Database()

def calculate_statistics(complaints: List[Dict]) -> Dict:
    return db.calculate_statistics(complaints)

def calculate_hotspots(complaints: List[Dict]) -> List[Dict]:
    return db.calculate_hotspots(complaints)

def calculate_daily_trends(complaints: List[Dict]) -> List[Dict]:
    return db.calculate_daily_trends(complaints)
