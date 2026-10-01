# NagarDrishti AI

### **AI-Powered Civic Issue Reporting & Governance Intelligence Platform**

> A unified, closed-loop civic engagement system connecting citizens and municipal authorities.  
> **Photo → AI Analysis → Visual Severity → Location → Suggested Department → Citizen Confirmation → Complaint → Authority Priority Queue → Resolution Evidence → Citizen Verification**

---

## 1. Project Overview & Purpose

**NagarDrishti AI** is an AI-assisted civic intelligence platform engineered to eliminate opacity and delays in municipal problem resolution. 

Citizens report infrastructure and sanitation issues simply by capturing a photograph. A multimodal AI engine analyzes the image, detects the issue type, estimates visual severity, and routes it to the appropriate municipal department. Citizens review and confirm detections before filing. 

Municipal authorities manage reports through an operational command center equipped with GIS heatmaps, spatial corridor clustering, and algorithmic priority scoring. Once repairs are completed, authorities upload resolution proof photos, and citizens personally verify or reopen the issue — creating complete civic accountability.

---

## 2. Platform Workflows

### Citizen Workflow
```text
Capture/Upload Photo
       │
       ▼
AI Visual Analysis (Category + Confidence + Visual Severity + Suggested Department)
       │
       ▼
Review & Location Tagging (GPS / Interactive Leaflet Map Pin)
       │
       ▼
Submit Complaint (Unique ID e.g., NGD-2026-00238 + Encrypted Private Storage)
       │
       ▼
Track Lifecycle (My Reports + Civic Event Notifications + Public Status Tracker)
       │
       ▼
Verify Resolution (Inspect photo proof -> Confirm Resolution OR Reopen with reason)
```

### Authority Workflow
```text
Receive Complaint (Real-time feed with AI visual severity & aging indicators)
       │
       ▼
GIS Intelligence & Hotspot Clustering (Corridor detection & severity heatmap)
       │
       ▼
Priority Assessment & Assignment (Triage queue -> Assign field team)
       │
       ▼
Action & Repair (Field team completes work on site)
       │
       ▼
Resolution Evidence (Upload completion photo + technician notes)
       │
       ▼
Citizen Verification Hand-off (Audit trail logged, awaits citizen verification)
```

---

## 3. Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Citizen Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Leaflet & OpenStreetMap, Recharts |
| **Backend API Gateway** | Python 3.10+ / 3.14, FastAPI, Uvicorn, Pydantic v2 |
| **Database & Cloud Storage** | Supabase PostgreSQL with Row Level Security (RLS), Supabase Storage (`complaint-images`) |
| **Authentication** | Supabase Auth (JWT Email/Password sessions with auto-refresh) |
| **AI Vision Engine** | Google Gemini Multimodal Vision API (`gemini-2.5-flash` / `gemini-3.5-flash-lite` via `google-genai` SDK) with decoupled `VisionAnalyzer` strategy interface and offline fallback |
| **GIS & Mapping** | Leaflet, OpenStreetMap tiles, Haversine geospatial distance calculation |
| **Mobile Foundation** | Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) |

---

## 4. System Architecture

```text
       Citizen Frontend                          Authority Frontend
      (Citizen Web / Mobile)                 (Separate Dedicated Repo)
              │                                          │
              ▼                                          ▼
       React 19 + Vite                            React 19 + Vite
              │                                          │
              └────────────────────┬─────────────────────┘
                                   │
                                   ▼
                          FastAPI API Gateway
                         (Python 3.10+ / 3.14)
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
          AI Vision Engine                   Supabase Cloud
       (VisionAnalyzer ABC)            ┌─────────────────────────┐
                  │                    │ • PostgreSQL Database   │
        ┌─────────┴─────────┐          │ • Row Level Security    │
        ▼                   ▼          │ • Private Storage       │
   Gemini Provider     Local Provider  │ • Supabase Auth (JWT)   │
 (Google GenAI SDK)      (Fallback)    └─────────────────────────┘
```

> **Multi-Repository Setup:** The **Authority Command Center** is maintained as a separate, independent repository (`NagarDrishti-AI-Authority`). Both applications interface cleanly with the centralized FastAPI backend, maintaining strict role separation.

---

## 5. Security & Privacy Guarantees

1. **JWT Authentication & Server-Side Authorization:** All protected operations verify Supabase JWT tokens server-side. Citizens can only access their own private reports and notifications. Administrative actions strictly require authority roles.
2. **Private Encrypted Storage:** Citizen complaint photos are stored in private Supabase buckets. Images are streamed exclusively through authenticated backend proxy endpoints (`/api/complaints/image/{filename}`), preventing public URL enumeration.
3. **PII-Safe Public Status Tracking:** Anyone with a valid Report ID can check status via `/api/complaints/{id}/public-summary`. The endpoint strictly redacts citizen names, emails, phone numbers, precise GPS coordinates, internal notes, and authentication tokens.
4. **Zero Client Secrets:** The citizen frontend bundle contains only public anon keys (`VITE_SUPABASE_ANON_KEY`). Service-role keys and Gemini API keys are isolated to the backend environment.
5. **Strict CORS Policy:** Wildcard `*` origins are rejected for authenticated requests. The backend explicitly whitelists trusted client origins via `CORS_ORIGINS`.

---

## 6. Running Locally

### Prerequisites
- Node.js (v18+ or v20+)
- Python (v3.10+)

### 1. Environment Setup
Configure `.env` in both the project root and `backend/`:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Key environment variables:
```env
# AI Engine
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
STORAGE_BUCKET=complaint-images

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

### 2. Backend Startup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```
- Interactive API Docs: `http://localhost:8000/api/docs`
- Health Endpoint: `http://localhost:8000/api/health`

### 3. Citizen Frontend Startup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 7. Automated Testing Suite

The repository features 93 automated tests across 8 comprehensive suites:

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

### Test Coverage Summary:
- `test_api.py` — Core API contracts, severity engine, department routing, duplicate detection.
- `test_auth_flow.py` — Supabase JWT authentication, profile provisioning, ownership rules.
- `test_phase5_resolution.py` — Authority resolution proof, citizen verification, and reopen flow.
- `test_phase6_citizen_experience.py` — In-app civic notifications and impact statistics.
- `test_phase7_civic_discovery.py` — Nearby civic discovery and location privacy guards.
- `test_phase8_governance_transparency.py` — Public status tracking and PII redaction.
- `test_phase9_hardening.py` — Upload limits, rate limiting, and failure recovery.
- `test_phase10_cross_repo_lifecycle.py` — 10-step full citizen-to-authority cross-repository lifecycle.

Frontend verification:
```bash
cd frontend
npm run lint    # oxlint - 0 errors
npm run build   # tsc -b && vite build - production bundle
```

---

## 8. Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Detailed architecture diagram, decision-support boundaries, and security model.
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — 2.5-minute live hackathon presentation script with step-by-step actions.
- [docs/FEATURES.md](docs/FEATURES.md) — Comprehensive matrix of implemented Citizen and Authority features.
