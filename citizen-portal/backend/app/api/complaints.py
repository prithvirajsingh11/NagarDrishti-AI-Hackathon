import logging
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth import get_current_user, get_optional_user, require_authority, security, TEST_TOKENS
from app.core.config import settings
from app.core.database import db
from app.schemas.complaint import (
    CitizenImpactSummary,
    CitizenReopenRequest,
    ComplaintCreate,
    ComplaintPublicSummary,
    ComplaintResponse,
    ComplaintStatus,
    ComplaintStatusHistoryItem,
    ComplaintUpdateStatus,
    SimilarComplaintSummary,
    StatusRequestCreate,
    StatusRequestResponse
)
from app.services.storage_service import storage_service

router = APIRouter(prefix="/complaints", tags=["Complaints"])
logger = logging.getLogger(__name__)

SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


async def _resolve_user_from_request(
    credentials: Optional[HTTPAuthorizationCredentials],
    token_param: Optional[str]
) -> Dict:
    """Helper to authenticate user via Authorization header or token query parameter."""
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials.strip()
    elif token_param:
        raw_token = token_param.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view complaint evidence."
        )

    # Automated testing fast path
    if raw_token in TEST_TOKENS:
        return TEST_TOKENS[raw_token]

    # Supabase Auth verification
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            from supabase import create_client
            client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            user_response = client.auth.get_user(raw_token)
            if not user_response or not user_response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired session."
                )
            u = user_response.user
            uid = str(u.id)
            email = u.email or ""
            role = "citizen"
            try:
                prof = client.table("profiles").select("role").eq("user_id", uid).execute()
                if prof.data:
                    role = prof.data[0].get("role", "citizen")
            except Exception:
                pass
            return {"id": uid, "email": email, "role": role}
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Image auth failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed."
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required."
    )


@router.post("/upload", response_model=dict)
async def upload_complaint_image(
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user)
):
    """
    Upload complaint photograph to private Supabase Storage.
    Requires authenticated user. Returns controlled backend reference URL.
    """
    content_type = file.content_type or "image/jpeg"
    if content_type.lower() not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Allowed: JPG, PNG, WEBP."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty image file received.")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE),
            detail="Image file too large. Maximum supported size is 10 MB."
        )

    image_url = await storage_service.upload_image(file_bytes, mime_type=content_type)
    return {"image_url": image_url}


@router.get("/image/{filename}")
async def get_complaint_image(
    filename: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Controlled image retrieval from private storage.
    Enforces that citizens can only access images for complaints they own.
    Authorities can access all images.
    """
    user = await _resolve_user_from_request(credentials, token)

    # If citizen, verify ownership of complaint referencing this filename
    if user.get("role") != "authority":
        citizen_id = user.get("id")
        all_reports = await db.get_complaints(limit=500)
        matching = [c for c in all_reports if filename in (c.get("image_url") or "") or filename in (c.get("resolution_image_url") or "")]
        if matching:
            # If complaint exists, citizen MUST own it
            owns = any(c.get("citizen_id") == citizen_id for c in matching)
            if not owns:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: You can only view images for your own complaints."
                )

    image_data = await storage_service.get_image_bytes(filename)
    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found.")

    data_bytes, mime_type = image_data
    return Response(content=data_bytes, media_type=mime_type)


@router.get("/image/{filename}/signed-url", response_model=dict)
async def get_image_signed_url(
    filename: str,
    expires_in: int = 3600,
    user: Dict = Depends(get_current_user)
):
    """
    Generates a short-lived signed URL for direct private storage access.
    """
    signed_url = await storage_service.create_signed_url(filename, expires_in)
    if not signed_url:
        return {"signed_url": f"/api/complaints/image/{filename}"}
    return {"signed_url": signed_url}


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    user: Dict = Depends(get_current_user)
):
    """
    Register a confirmed citizen complaint.
    Stores record in Supabase PostgreSQL, derives citizen_id strictly from authenticated session.
    """
    try:
        citizen_id = user["id"]
        created = await db.create_complaint(payload.model_dump(), citizen_id=citizen_id)
        return created
    except Exception as e:
        logger.error(f"Error creating complaint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register complaint. Please try again."
        )


@router.get("", response_model=List[ComplaintResponse])
async def list_complaints(
    problem_type: Optional[str] = Query(None, description="Filter by problem type"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    status: Optional[str] = Query(None, description="Filter by complaint status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    limit: int = Query(100, ge=1, le=500),
    user: Dict = Depends(get_current_user)
):
    """
    List civic complaints.
    Citizens only receive their own complaints.
    Authorities can view all complaints.
    """
    try:
        citizen_id = user["id"] if user.get("role") == "citizen" else None
        results = await db.get_complaints(
            citizen_id=citizen_id,
            problem_type=problem_type,
            severity=severity,
            status=status,
            department=department,
            limit=limit
        )
        return results
    except Exception as e:
        logger.error(f"Error listing complaints: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve complaints.")


@router.get("/my-impact", response_model=CitizenImpactSummary)
async def get_my_civic_impact(user: Dict = Depends(get_current_user)):
    """
    Aggregates authentic civic impact statistics strictly for the authenticated citizen.
    Never fabricates statistics.
    """
    citizen_id = user["id"]
    impact = await db.get_citizen_impact(citizen_id)
    impact["total_reports"] = impact["total_submitted"]
    return impact


@router.get("/similar", response_model=List[SimilarComplaintSummary])
async def find_similar_complaints(
    problem_type: str = Query(..., description="Problem category to match (e.g. pothole, garbage)"),
    latitude: float = Query(..., description="Latitude of proposed civic issue"),
    longitude: float = Query(..., description="Longitude of proposed civic issue"),
    radius_km: float = Query(default=1.0, ge=0.01, le=25.0, description="Search radius in kilometers"),
    max_age_days: int = Query(default=30, ge=1, le=180, description="Max age in days for active issues"),
    user: Dict = Depends(get_current_user)
):
    """
    Pre-submission similarity check to prevent duplicate reports.
    Returns safe public summaries of nearby matching civic issues.
    Never blocks legitimate reporting.
    """
    matches = await db.check_similar_complaints(
        problem_type=problem_type,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        max_age_days=max_age_days
    )
    return matches


@router.get("/{id}", response_model=ComplaintResponse)
async def get_complaint(
    id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Fetch complaint by unique UUID or Report ID.
    Enforces that citizens can only access their own reports.
    """
    is_authority = user.get("role") == "authority"
    citizen_id = user["id"] if not is_authority else None

    complaint = await db.get_complaint_by_id(id, citizen_id=citizen_id, is_authority=is_authority)
    if not complaint:
        # Check if complaint exists at all to return 403 vs 404
        existing = await db.get_complaint_by_id(id, is_authority=True)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to view another citizen's complaint."
            )
        raise HTTPException(status_code=404, detail="Complaint report not found.")

    return complaint


@router.get("/{id}/history", response_model=List[ComplaintStatusHistoryItem])
async def get_complaint_history(
    id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Retrieves the authentic chronological status history timeline for a complaint.
    Enforces that citizens can only access history for their own complaints.
    """
    is_authority = user.get("role") == "authority"
    citizen_id = user["id"] if not is_authority else None

    complaint = await db.get_complaint_by_id(id, citizen_id=citizen_id, is_authority=is_authority)
    if not complaint:
        existing = await db.get_complaint_by_id(id, is_authority=True)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to view this complaint's history."
            )
        raise HTTPException(status_code=404, detail="Complaint report not found.")

    return complaint.get("status_history", [])


@router.patch("/{id}/status", response_model=ComplaintResponse)
async def update_complaint_status(
    id: str,
    update: ComplaintUpdateStatus,
    user: Dict = Depends(require_authority)
):
    """
    Update complaint lifecycle status.
    Strictly authority-only. Citizens cannot update complaint status.
    """
    updated = await db.update_complaint_status(
        id,
        update.status.value,
        resolution_image_url=update.resolution_image_url
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return updated


@router.post("/{id}/confirm-resolution", response_model=ComplaintResponse)
async def confirm_resolution(
    id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Citizen confirms that a resolved complaint is fixed.
    Derives citizen identity strictly from authentication token.
    Enforces ownership and status checks server-side.
    """
    citizen_id = user["id"]
    try:
        updated = await db.confirm_resolution(id, citizen_id=citizen_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Complaint not found.")
        return updated
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post("/{id}/reopen", response_model=ComplaintResponse)
async def reopen_complaint(
    id: str,
    payload: CitizenReopenRequest = CitizenReopenRequest(),
    user: Dict = Depends(get_current_user)
):
    """
    Citizen reopens a complaint because the civic issue still exists.
    Derives citizen identity strictly from authentication token.
    Enforces ownership, preserves previous resolution history, and records reopen reason.
    """
    citizen_id = user["id"]
    try:
        updated = await db.reopen_complaint(id, citizen_id=citizen_id, reason=payload.reason)
        if not updated:
            raise HTTPException(status_code=404, detail="Complaint not found.")
        return updated
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/{id}/public-summary", response_model=ComplaintPublicSummary)
async def get_public_summary(
    id: str,
    user: Optional[Dict] = Depends(get_optional_user)
):
    """
    Safe public summary of a complaint (used for duplicate report notice and public status lookup).
    Strictly returns safe public fields with zero citizen personal info.
    """
    summary = await db.get_public_summary(id)
    if not summary:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return summary


@router.get("/{id}/similar", response_model=List[SimilarComplaintSummary])
async def find_similar_to_complaint(
    id: str,
    radius_km: float = Query(default=1.0, ge=0.01, le=25.0),
    max_age_days: int = Query(default=30, ge=1, le=180),
    user: Dict = Depends(get_current_user)
):
    """
    Find complaints similar to an existing report by ID.
    Excludes the report itself.
    """
    complaint = await db.get_complaint_by_id(id, is_authority=True)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    matches = await db.check_similar_complaints(
        problem_type=complaint.get("problem_type", "other"),
        latitude=complaint.get("latitude", 0.0),
        longitude=complaint.get("longitude", 0.0),
        radius_km=radius_km,
        max_age_days=max_age_days
    )
    return [m for m in matches if m.get("id") != complaint.get("id") and m.get("report_id") != complaint.get("report_id")]


@router.post("/{id}/status-request", response_model=StatusRequestResponse)
async def request_complaint_status_update(
    id: str,
    payload: StatusRequestCreate = StatusRequestCreate(),
    user: Dict = Depends(get_current_user)
):
    """
    Citizen requests a status update on a stalled complaint.
    Enforces ownership, inactivity threshold, and prevents spam via cooldown.
    """
    citizen_id = user["id"]
    try:
        req = await db.create_status_request(
            complaint_id_or_report_id=id,
            citizen_id=citizen_id,
            message=payload.message
        )
        return req
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/{id}/status-requests", response_model=List[StatusRequestResponse])
async def list_complaint_status_requests(
    id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Retrieves status update requests for a complaint.
    Enforces that citizens can only access their own complaint follow-ups.
    Authorities can view all status update requests.
    """
    is_authority = user.get("role") == "authority"
    citizen_id = user["id"] if not is_authority else None

    try:
        requests = await db.get_status_requests(id, citizen_id=citizen_id, is_authority=is_authority)
        return requests
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
