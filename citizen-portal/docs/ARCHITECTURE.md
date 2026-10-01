# NagarDrishti AI: System Architecture

**AI-Powered Civic Issue Reporting and Governance Intelligence Platform**

---

## 1. High-Level Architecture Overview

```text
       CITIZEN PORTAL                          AUTHORITY COMMAND CENTER
  (Citizen Website / Mobile)                (Separate Dedicated Repository)
              │                                            │
              ▼                                            ▼
      React 19 + Vite                             React 19 + Vite
   (Public Citizen View)                       (Authenticated Officers)
              │                                            │
              └─────────────────────┬──────────────────────┘
                                    │
                                    ▼
                         FastAPI API Gateway
                        (Python 3.10+ / 3.14)
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
           AI Vision Engine                  Supabase Cloud
        (VisionAnalyzer ABC)            ┌─────────────────────────┐
                   │                    │ • PostgreSQL Database   │
         ┌─────────┴─────────┐          │ • Row Level Security    │
         ▼                   ▼          │ • Private Storage       │
    Gemini Provider     Local Provider  │ • Supabase Auth (JWT)   │
  (Google GenAI SDK)      (Fallback)    └─────────────────────────┘
```

> **Repository Boundary:** The Authority Command Center is maintained as an independent repository (`NagarDrishti-AI-Authority`). Both frontends connect to the unified FastAPI backend and shared Supabase PostgreSQL database with strict role segregation.

---

## 2. End-to-End Civic Processing Pipeline

```text
[Citizen Photo]
       │
       ▼
[AI Vision Provider] ───────────────► Multimodal feature extraction (Google Gemini / Local fallback)
       │
       ▼
[Structured Civic Analysis] ────────► Problem category, confidence score, visual evidence list
       │
       ▼
[Severity Engine] ──────────────────► Deterministic visual severity evaluation (LOW, MEDIUM, HIGH, CRITICAL)
       │
       ▼
[Department Resolver] ──────────────► Deterministic routing to municipal division (Roads, Sanitation, Electrical)
       │
       ▼
[Citizen Verification & Edit] ──────► Human-in-the-loop: citizen reviews, adjusts details, attaches GPS coordinates
       │
       ▼
[Complaint Submission] ─────────────► Unique report ID (e.g., NGD-2026-00238) generated; saved with citizen ownership
       │
       ▼
[Authority Queue & GIS] ────────────► Hotspot clustering, aging calculations, priority triage, officer assignment
       │
       ▼
[Municipal Field Action] ───────────► Field team repairs issue, uploads resolution evidence photograph
       │
       ▼
[Citizen Resolution Verification] ──► Citizen verifies completed repair or reopens issue if unsatisfactory
```

---

## 3. Core Architectural Boundaries

### A. AI-Assisted Estimation (Probabilistic)
- Multimodal visual detection via `VisionAnalyzer` strategy pattern (`backend/app/services/vision_analyzer.py`).
- Detects civic problem types: `pothole`, `garbage`, `streetlight`, `drain`, or `other`.
- Extracts observable indicators (`evidence` list, e.g., `"deep asphalt crater"`, `"overflowing municipal bin"`).
- Low-confidence detections (`< 0.75`) or ambiguous photos are flagged with `needs_retake: true` and routed to manual review rather than failing silently.
- **Safety guarantee:** AI estimates visual indicators only; it never takes unilateral municipal actions or triggers automated disciplinary actions.

### B. Decision-Support Rules (Deterministic)
- **SeverityEngine** (`backend/app/services/severity_engine.py`): Maps detected issue types and evidence severity to deterministic tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **DepartmentResolver** (`backend/app/services/department_resolver.py`): Maps confirmed issue categories to responsible municipal divisions.
- **DuplicateDetector** (`backend/app/services/duplicate_detector.py`): Uses Haversine spatial distance (≤ 100 meters) and time delta (≤ 48 hours) to detect duplicates without lossy data merges.

### C. Citizen-Confirmed Resolution (Human-in-the-Loop)
- Once an authority marks a complaint `RESOLVED` and attaches proof of work, the citizen who filed the report inspects the resolution evidence.
- The citizen either:
  1. **Confirms Resolution:** Locks the complaint as verified (`citizen_resolution_confirmed = true`).
  2. **Reopens Complaint:** If work was incomplete, logs a mandatory reopen reason (`status = REOPENED`, `citizen_reopened = true`), returning it to the authority work queue.

---

## 4. Security & Privacy Architecture

| Domain | Implementation | Security Guarantee |
|--------|----------------|-------------------|
| **Authentication** | Supabase Auth (Email/Password) | Secure JWT tokens; automatic client refresh; no insecure SMS/OTP dependencies. |
| **Authorization** | Server-side FastAPI dependencies | `get_current_citizen` verifies token and matches `citizen_id`; `require_authority` guards administrative endpoints. |
| **Public Status Privacy** | `/api/complaints/{id}/public-summary` | Zero PII: citizen name, email, phone, precise GPS coordinates, and internal authority notes are completely redacted. |
| **Media Protection** | Private Supabase Storage bucket | Images are stored privately and streamed exclusively through authenticated backend proxy (`/api/complaints/image/...`). |
| **Secrets Management** | Backend environment variables | Gemini API key and Supabase Service Role key are confined to backend `.env`. Client bundle contains only public anon keys. |
| **CORS Policy** | Explicit origin whitelist | Wildcards are blocked; credentials (`allow_credentials=True`) enforced with specific origin domain matches. |
