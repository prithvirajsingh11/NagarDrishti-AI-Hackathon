# NagarDrishti AI — Municipal Authority Portal

> **Municipal Civic Operations & Governance Intelligence Platform**  
> *Separate administrative repository for municipal authority personnel, zonal dispatchers, and city leadership.*

---

## 🏛️ Purpose & Overview

**NagarDrishti AI Authority Portal** is the dedicated administrative command center that converts incoming citizen-reported civic defects into prioritized, auditable, and actionable municipal work orders.

### Core Operational Workflow
```
Citizen Report
      ↓
Vision AI Classification
      ↓
GIS Location & Mapping
      ↓
Priority Intelligence
      ↓
Municipal Assignment (Department & Squad)
      ↓
Operational Action & Confidential DLP Notes
      ↓
Evidence-Based Resolution (Photo Proof)
      ↓
Citizen Verification (Confirmation or Reopen)
      ↓
Escalation Center (When Required)
```

---

## 🚀 System Architecture

NagarDrishti operates as two decoupled frontend applications sharing a unified municipal backend:

```
        Citizen Website (NagarDrishti-AI)
                       │
                       ▼
        Shared FastAPI Backend Service
             │                   ▲
             ▼                   │ (RBAC Bearer Auth)
       Supabase ─────────────────┴── Authority Website (NagarDrishti-AI-Authority)
  (Auth, DB & Storage)
```

> ℹ️ **Cross-Repository Note**: This repository contains the **Authority Portal** frontend and the core municipal backend services. The Citizen reporting portal resides in its own independent repository (`NagarDrishti-AI`).

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | **React 19** + **TypeScript** | Responsive authority command center interface |
| **Build & Tooling** | **Vite** + **Tailwind CSS 4** | Sub-second HMR and modern utility styling |
| **GIS Mapping** | **Leaflet** | Interactive markers, cluster bubbles, and heatmaps |
| **Data Visualization** | **Recharts** | Inflow curves, aging distributions, workload analytics |
| **Backend API** | **FastAPI (Python 3.11+)** | High-performance asynchronous REST API |
| **Identity & Storage** | **Supabase** | JWT authentication, role enforcement, image storage |

---

## ⚡ Authority Capabilities

- **Command Center**: Real-time KPI overview, multi-horizon filters (24h/7d/30d/All), and the 6-stage Civic Lifecycle Pipeline ribbon.
- **GIS Map Intelligence**: Dynamic markers, clustering, and heatmaps with India-wide coordinate bounds (Bhopal default viewport).
- **Priority Intelligence**: Deterministic 0–100 urgency score with transparent rationale breakdowns (severity, aging, clustering, and reopen penalties).
- **Complaint Queue & Drawer**: Deep triage drawer displaying intake details, location maps, Before/After image comparisons, and immutable audit history.
- **Case Assignment**: Squad dispatch with auditable assignment history and custom dispatch instructions.
- **Confidential Internal Notes**: Officer-only notes with prominent confidentiality badges, strictly excluded from public/citizen endpoints.
- **Citizen Status Inquiries**: Dedicated queue allowing officers to acknowledge citizen requests without premature lifecycle status mutation.
- **Escalation Center**: Automated flagging for citizen-reopened cases, SLA-breached aging complaints, and unaddressed citizen requests.
- **Resolution Proof**: Mandatory repair photograph upload (JPG/PNG/WEBP ≤ 10MB) before marking cases `RESOLVED`.
- **Governance Analytics**: Evidence-based First-Time Resolution Rate, Citizen Verification Rate, and Department Workload metrics (zero fake data; explicit fallback to "Insufficient data").
- **Secure CSV Export**: Role-protected, filter-aware CSV export excluding internal notes and authentication credentials.

### 📸 Command Center Previews

#### 🏛️ Real-Time KPI Dashboard & Incident Pipeline
![Authority Command Center](docs/screenshots/authority_command_center.png)

#### 🗺️ Metropolitan Geographic Map & Hotspot Intelligence
![Authority GIS Map Intelligence](docs/screenshots/authority_gis_map.png)

---

## 🔒 Security & Privacy Guarantees

1. **Role-Based Access Control (RBAC)**: All administrative endpoints require Supabase Auth JWT tokens verifying `role: authority`.
2. **Confidential Internal Data Isolation**: Internal notes, officer personnel notes, and operational escalation internals are stripped from public responses.
3. **No Frontend Secrets**: Privileged credentials (such as `SUPABASE_SERVICE_ROLE_KEY`) remain strictly server-side in the backend environment.
4. **CORS Lockdown**: Backend enforces explicit origin whitelists in production.

---

## 💻 Quick Start & Local Development

### Prerequisites
- Node.js 18+ & npm
- Python 3.11+
- Supabase Project credentials

### 1. Start Backend Service
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python run.py
```
- API Base: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`

### 2. Start Authority Frontend
```bash
cd frontend
npm install
npm run dev
```
- Authority Portal: `http://localhost:5174`

---

## 🧪 Testing & Validation

### Run Backend Tests
```bash
cd backend
python -m unittest discover tests
```
*40 tests covering RBAC, confidential note redaction, lifecycle flow, division-by-zero safety, and CSV export.*

### Run Frontend Tests
```bash
cd frontend
npm test -- --run
```
*51 tests covering map robustness, mutation error handling, drawer states, and cross-repo validation.*

### Production Build
```bash
cd frontend
npm run build
```
*Validates TypeScript compilation (`tsc -b`) and generates production bundle via Vite.*

---

## 📚 Documentation Links
- [System Architecture](docs/ARCHITECTURE.md)
- [Hackathon Demo Script (2.5–3 min)](docs/AUTHORITY_DEMO_SCRIPT.md)
- [Comprehensive Features Guide](docs/FEATURES.md)
