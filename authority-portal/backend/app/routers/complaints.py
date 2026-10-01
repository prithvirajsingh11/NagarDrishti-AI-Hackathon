import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Depends, Response

from ..models.schemas import (
    Complaint,
    ComplaintCreate,
    StatusUpdate,
    ResolveComplaintRequest,
    ReopenComplaintRequest,
    StatusHistoryItem,
    AssignComplaintRequest,
    InternalNote,
    CreateInternalNoteRequest,
    StatusUpdateRequestItem,
    CreateStatusUpdateRequest,
    AcknowledgeStatusRequest,
)
from ..services.store import data_store
from ..auth import require_authority, verify_token, get_current_user_optional
from ..config import UPLOAD_DIR, STORAGE_BUCKET

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])


@router.get("", response_model=List[Complaint])
def get_complaints(
    problem_type: Optional[str] = Query(None, description="Filter by problem type (pothole, garbage, etc.)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    status: Optional[str] = Query(None, description="Filter by complaint lifecycle status"),
    department: Optional[str] = Query(None, description="Filter by department name substring"),
    resolution_status: Optional[str] = Query(None, description="Filter by resolution status"),
    priority_level: Optional[str] = Query(None, description="Filter by priority level (CRITICAL, HIGH, MEDIUM, LOW)"),
    aging: Optional[str] = Query(None, description="Filter by aging bucket (0-24h, 1-3d, 3-7d, 7+d)"),
    is_reopened: Optional[bool] = Query(None, description="Filter by citizen reopened flag"),
    limit: Optional[int] = Query(None, description="Limit number of returned records"),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Retrieve filtered civic complaint records for authority triage. Internal notes stripped for non-authority callers."""
    records = data_store.list_complaints(
        problem_type=problem_type,
        severity=severity,
        status=status,
        department=department,
        resolution_status=resolution_status,
        priority_level=priority_level,
        aging=aging,
        is_reopened=is_reopened,
        limit=limit,
    )
    is_authority = bool(current_user and current_user.get("role") == "authority")
    if not is_authority:
        return [c.model_copy(update={"internal_notes": []}) if c.internal_notes else c for c in records]
    return records


@router.post("/upload-resolution-evidence")
async def upload_resolution_evidence(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_authority),
):
    """Authority uploads photograph evidence demonstrating civic defect resolution."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed formats: JPG, PNG, WEBP.",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds the 10 MB limit.",
        )

    unique_filename = f"resolution_{uuid.uuid4().hex[:12]}{ext}"
    local_target = Path(UPLOAD_DIR) / unique_filename
    try:
        local_target.parent.mkdir(parents=True, exist_ok=True)
        with open(local_target, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.warning(f"Could not write resolution image locally: {e}")

    # Also upload to Supabase storage private bucket
    client = data_store._get_supabase_client()
    if client:
        try:
            content_type = file.content_type or "image/jpeg"
            client.storage.from_(STORAGE_BUCKET).upload(
                path=unique_filename,
                file=content,
                file_options={"content-type": content_type}
            )
            logger.info(f"Uploaded {unique_filename} to Supabase storage '{STORAGE_BUCKET}'")
        except Exception as se:
            logger.warning(f"Could not upload resolution image to Supabase: {se}")

    return {
        "image_url": f"/api/complaints/image/{unique_filename}",
        "filename": unique_filename,
    }


@router.get("/export")
def export_complaints_csv(
    problem_type: Optional[str] = Query(None, description="Filter by problem type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    resolution_status: Optional[str] = Query(None, description="Filter by resolution status"),
    priority_level: Optional[str] = Query(None, description="Filter by priority level"),
    aging: Optional[str] = Query(None, description="Filter by aging bucket"),
    is_reopened: Optional[bool] = Query(None, description="Filter by reopened status"),
    limit: Optional[int] = Query(None, description="Limit number of exported records"),
    current_user: dict = Depends(require_authority),
):
    """Export filtered complaint records as CSV for authenticated authority operations. Never exposes internal notes."""
    complaints = data_store.list_complaints(
        problem_type=problem_type,
        severity=severity,
        status=status,
        department=department,
        resolution_status=resolution_status,
        priority_level=priority_level,
        aging=aging,
        is_reopened=is_reopened,
        limit=limit,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Report ID",
        "Category",
        "Severity",
        "Status",
        "Priority Level",
        "Priority Score",
        "Department",
        "Assigned Officer/Team",
        "Assigned At",
        "Location",
        "Latitude",
        "Longitude",
        "Created At",
        "Updated At",
        "Resolved At",
        "Reopened",
        "Reopen Reason",
        "Citizen Verification Status",
        "Description",
    ])

    for c in complaints:
        writer.writerow([
            c.report_id or c.id,
            c.problem_type or "",
            c.severity or "",
            c.status or "",
            c.priority_level or "",
            c.priority_score if c.priority_score is not None else "",
            c.department or "",
            c.assigned_to or "Unassigned",
            c.assigned_at or "",
            c.location_name or "",
            c.latitude if c.latitude is not None else "",
            c.longitude if c.longitude is not None else "",
            c.created_at or "",
            c.updated_at or "",
            c.resolved_at or "",
            "YES" if (c.status == "REOPENED" or c.citizen_reopened) else "NO",
            c.reopen_reason or "",
            c.citizen_verification_status or "NONE",
            c.description or "",
        ])

    csv_data = output.getvalue()
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"complaints_export_{timestamp_str}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/{complaint_id}", response_model=Complaint)
def get_complaint(
    complaint_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Inspect deep detail of a specific civic complaint by ID or Report ID. Internal notes stripped for non-authority callers."""
    complaint = data_store.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    is_authority = bool(current_user and current_user.get("role") == "authority")
    if not is_authority and complaint.internal_notes:
        return complaint.model_copy(update={"internal_notes": []})
    return complaint


@router.post("/{complaint_id}/resolve", response_model=Complaint)
def resolve_complaint(
    complaint_id: str,
    payload: ResolveComplaintRequest,
    current_user: dict = Depends(require_authority),
):
    """Mark a civic complaint as RESOLVED with resolution image evidence and notes."""
    if not payload.resolution_image_url:
        raise HTTPException(
            status_code=400,
            detail="Resolution image evidence is required to mark complaint as resolved.",
        )

    complaint = data_store.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    authority_name = current_user.get("full_name") or current_user.get("email") or "Municipal Authority Officer"
    resolved = data_store.resolve_complaint(
        complaint_id=complaint_id,
        resolution_image_url=payload.resolution_image_url,
        resolution_note=payload.resolution_note,
        resolved_by=authority_name,
    )
    if not resolved:
        raise HTTPException(status_code=500, detail="Failed to resolve complaint.")
    return resolved


@router.patch("/{complaint_id}/status", response_model=Complaint)
def update_complaint_status(
    complaint_id: str,
    payload: StatusUpdate,
    current_user: dict = Depends(require_authority),
):
    """Update lifecycle status of a complaint (REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> REOPENED)."""
    authority_name = current_user.get("full_name") or "Municipal Authority Officer"
    updated = data_store.update_complaint_status(
        complaint_id=complaint_id,
        new_status=payload.status,
        resolution_image_url=payload.resolution_image_url,
        resolution_note=payload.resolution_note,
        resolved_by=authority_name,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return updated


@router.post("/{complaint_id}/confirm-resolution", response_model=Complaint)
def confirm_resolution(
    complaint_id: str,
    current_user: dict = Depends(verify_token),
):
    """Citizen confirms that the civic defect has been successfully rectified."""
    complaint = data_store.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    if complaint.status != "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Only resolved complaints can be confirmed by citizens.",
        )

    user_id = current_user.get("id")
    caller_role = current_user.get("role", "citizen")
    citizen_owner = getattr(complaint, "citizen_id", None)
    if citizen_owner and caller_role != "authority" and citizen_owner != user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to confirm this complaint.",
        )

    confirmed = data_store.confirm_resolution(complaint_id)
    if not confirmed:
        raise HTTPException(status_code=500, detail="Failed to confirm resolution.")
    return confirmed


@router.post("/{complaint_id}/reopen", response_model=Complaint)
def reopen_complaint(
    complaint_id: str,
    payload: ReopenComplaintRequest,
    current_user: dict = Depends(verify_token),
):
    """Citizen reports that the issue is still unresolved, reopening the complaint."""
    complaint = data_store.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    if complaint.status != "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Only resolved complaints can be reopened.",
        )

    user_id = current_user.get("id")
    caller_role = current_user.get("role", "citizen")
    citizen_owner = getattr(complaint, "citizen_id", None)
    if citizen_owner and caller_role != "authority" and citizen_owner != user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to reopen this complaint.",
        )

    reopened = data_store.reopen_complaint(complaint_id, reason=payload.reason or "")
    if not reopened:
        raise HTTPException(status_code=500, detail="Failed to reopen complaint.")
    return reopened


@router.get("/{complaint_id}/history", response_model=List[StatusHistoryItem])
def get_complaint_history(
    complaint_id: str,
    current_user: dict = Depends(verify_token),
):
    """Retrieve complete auditable lifecycle history for a complaint."""
    complaint = data_store.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return complaint.status_history or []


@router.post("", response_model=Complaint, status_code=201)
def create_complaint(payload: ComplaintCreate):
    """Register a new citizen civic complaint."""
    return data_store.add_complaint(payload)


@router.post("/{complaint_id}/assign", response_model=Complaint)
def assign_complaint(
    complaint_id: str,
    payload: AssignComplaintRequest,
    current_user: dict = Depends(require_authority),
):
    """Assign civic complaint to department and responsible officer/team."""
    authority_name = current_user.get("full_name") or current_user.get("email") or "Municipal Authority Officer"
    assigned = data_store.assign_complaint(
        complaint_id=complaint_id,
        department=payload.department,
        assigned_to=payload.assigned_to,
        note=payload.note,
        changed_by=authority_name,
    )
    if not assigned:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return assigned


@router.post("/{complaint_id}/internal-notes", response_model=InternalNote)
def add_internal_note(
    complaint_id: str,
    payload: CreateInternalNoteRequest,
    current_user: dict = Depends(require_authority),
):
    """Add confidential internal authority note. Never visible to citizens."""
    authority_name = current_user.get("full_name") or current_user.get("email") or "Municipal Authority Officer"
    note = data_store.add_internal_note(
        complaint_id=complaint_id,
        note=payload.note,
        author=authority_name,
        author_role="authority",
    )
    if not note:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return note


@router.get("/{complaint_id}/internal-notes", response_model=List[InternalNote])
def get_internal_notes(
    complaint_id: str,
    current_user: dict = Depends(require_authority),
):
    """Retrieve internal confidential notes for a complaint. Authority only."""
    complaint = data_store.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return data_store.get_internal_notes(complaint_id)


@router.post("/{complaint_id}/status-request", response_model=StatusUpdateRequestItem)
def create_status_update_request(
    complaint_id: str,
    payload: CreateStatusUpdateRequest,
):
    """Citizen submits a request for a status update on a reported complaint."""
    req = data_store.create_status_update_request(
        complaint_id=complaint_id,
        citizen_message=payload.citizen_message,
    )
    if not req:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return req


@router.post("/{complaint_id}/status-request/{request_id}/acknowledge", response_model=StatusUpdateRequestItem)
def acknowledge_status_update_request(
    complaint_id: str,
    request_id: str,
    payload: AcknowledgeStatusRequest,
    current_user: dict = Depends(require_authority),
):
    """Authority acknowledges citizen's status update request without altering complaint status."""
    authority_name = current_user.get("full_name") or current_user.get("email") or "Municipal Authority Officer"
    req = data_store.acknowledge_status_update_request(
        complaint_id=complaint_id,
        request_id=request_id,
        acknowledged_by=authority_name,
        response_note=payload.response_note,
    )
    if not req:
        raise HTTPException(status_code=404, detail="Complaint or status request not found.")
    return req

