# NagarDrishti AI — Authority Portal Architecture

## 1. System Topology & Cross-Repository Boundaries

NagarDrishti is architected as two decoupled frontends interfacing with a shared municipal backend service:

```
    Citizen Web Application (NagarDrishti-AI)
                   │
                   ▼ (REST / multipart uploads)
    Shared FastAPI Backend Service (Port 8000)
         │                           ▲
         ▼                           │ (REST / RBAC Bearer Auth)
   Supabase (Auth, DB & Storage) ────┴── Authority Portal (NagarDrishti-AI-Authority)
```

- **Citizen Web App**: Public-facing civic reporting portal where citizens submit geolocated photo evidence, track lifecycle updates, and confirm or reopen resolutions.
- **Authority Portal**: Secure, authenticated administrative command center for municipal officers, dispatch teams, and city leadership.
- **Shared FastAPI Backend**: Central business logic layer enforcing RBAC, deterministic priority scoring, spatial clustering, and data sanitization.
- **Supabase**: Managed PostgreSQL database, JWT identity provider, and private storage bucket for resolution and complaint imagery.

---

## 2. Municipal Operational Workflow

Incoming civic reports transition through a rigorous, auditable operational pipeline:

```
[ Citizen Report ]
        │ (Vision AI categorization, GPS tagging, confidence score)
        ▼
[ Authority Ingestion & Triage ]
        │ (Real-time GIS mapping, India-wide coordinate bounds)
        ▼
[ Priority Intelligence ]
        │ (Deterministic multi-factor score: severity, aging, proximity, risk)
        ▼
[ Municipal Assignment ]
        │ (Designated department, officer/squad, auditable log)
        ▼
[ Operational Intervention ]
        │ (Status progression, confidential officer notes)
        ▼
[ Evidence-Based Resolution ]
        │ (Upload resolution photograph, resolution notes)
        ▼
[ Citizen Verification / Reopen ]
        │
        ├─► [ Citizen Confirms ] ──► Complete (Governance outcome logged)
        │
        └─► [ Citizen Reopens ] ──► Escalation Center (Intervention required)
```

---

## 3. Operational Logic Boundaries

To ensure governance integrity and prevent hallucination, responsibilities are strictly partitioned:

| Layer | Component | Mechanism | Guarantee |
|---|---|---|---|
| **AI-Assisted Analysis** | Defect Classification & Confidence | Computer Vision Inference | Estimates defect type (e.g. pothole, garbage) and confidence (0–100%). Never unilaterally closes cases. |
| **Deterministic Operational Logic** | Priority Scoring & Aging Buckets | Mathematical Formula | Reproducible priority score (0–100) based on severity weights, aging hours, density clustering, and reopen penalties. |
| **Human Authority Actions** | Assignment, Notes & Resolution | Authenticated Municipal Officers | Dispatches specific squads, appends confidential DLP/contract notes, and uploads verifiable post-repair photographs. |
| **Citizen Verification** | Closeout or Reopen Escalation | End-User Validation | Citizen inspects repair; if defective, reopens case with mandatory feedback, immediately triggering Escalation Center alerts. |

---

## 4. Priority Intelligence Formula

Priority is computed deterministically by the backend engine:

$$\text{Priority Score} = S_{\text{severity}} + A_{\text{aging}} + C_{\text{clustering}} + R_{\text{risk}} + E_{\text{escalation}}$$

- **Severity Weight ($S$)**: CRITICAL = 40, HIGH = 25, MEDIUM = 15, LOW = 5
- **Aging Factor ($A$)**: Up to +15 points scaling with days unresolved
- **Spatial Density ($C$)**: Up to +15 points based on nearby unresolved complaints within 500m radius
- **Hazard Risk ($R$)**: +5 to +10 points for road safety hazards, arterial corridors, and high-footfall zones
- **Escalation / Reopen ($E$)**: +20 points when reopened by a citizen; +10 points for pending citizen status inquiries

---

## 5. Security & Confidentiality Boundary

1. **Role-Based Access Control (RBAC)**:
   - Authority endpoints (`/api/dashboard/escalations`, `/api/complaints/{id}/assign`, `/api/complaints/export`, etc.) enforce Supabase JWT validation requiring `role: authority`.
   - Anonymous requests return `401 Unauthorized`; citizen tokens return `403 Forbidden`.
2. **Confidential Internal Data Isolation**:
   - Internal notes (`internal_notes`) and internal operational metadata are stripped from all public/citizen API endpoints.
   - Public status trackers never receive private contractor memos, officer personnel identifiers, or internal escalation reasons.
3. **Evidence Immutability**:
   - Status updates, assignments, and resolution records append to an immutable `status_history` audit trail with ISO-8601 timestamps and actor credentials.
