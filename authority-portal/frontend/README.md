# NagarDrishti AI Authority — Municipal Civic Intelligence

> **Important:** This repository contains the **Authority Portal frontend only**.
> All business logic, Gemini AI vision analysis, severity scoring, hotspot clustering, and Supabase database / storage access are managed by the shared **NagarDrishti AI FastAPI backend**.

---

## 🏛️ Overview

**NagarDrishti AI Authority** is the administrative command center for municipal officials and urban local bodies. It delivers spatial civic intelligence, geographic hotspot analysis, complaint queue triage, and issue lifecycle tracking.

### Key Capabilities

* **Command Center Dashboard (`/dashboard`)**: Live KPI metrics (total reports, critical/high severity, active in-progress, resolved issues), category breakdown, and 7-day inflow trends.
* **Map Intelligence (`/map`)**: Full-screen GIS mapping supporting interactive markers, clustered points, and canvas-rendered heatmaps.
* **Hotspot Intelligence (`/hotspots`)**: Automated corridor clustering, dominant issue detection, unresolved severity ratios, and actionable municipal interventions.
* **Complaint Queue (`/reports`)**: Searchable, sortable, and multi-criteria filterable complaint ledger with deep inspection drawer.
* **Complaint Inspection Drawer**: Verified citizen evidence, Gemini visual confidence, severity ratings, suggested department routing, duplicate warnings, and status lifecycle updates (`REPORTED` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED`).

---

## 🏗️ Architecture

```text
┌──────────────────────────────────────┐       ┌─────────────────────────────────────┐
│ NagarDrishti AI Citizen Website      │       │ NagarDrishti AI Authority Portal    │
│ (Independent Frontend)               │       │ (This Independent Frontend Repo)    │
└──────────────────┬───────────────────┘       └──────────────────┬──────────────────┘
                   │                                              │
                   │              HTTP / REST API                 │
                   └─────────────────────┬────────────────────────┘
                                         ▼
                   ┌──────────────────────────────────────────────┐
                   │ Shared FastAPI Backend Service               │
                   │ • Gemini 3.5 Multimodal Vision Engine        │
                   │ • SeverityEngine & DepartmentResolver        │
                   │ • Spatial Hotspot Clustering                 │
                   │ • Duplicate Report Detection                 │
                   └─────────────────────┬────────────────────────┘
                                         ▼
                   ┌──────────────────────────────────────────────┐
                   │ Supabase Cloud                               │
                   │ • PostgreSQL (Complaints & Departments)      │
                   │ • Controlled Private Evidence Storage Bucket │
                   └──────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

* Node.js 18+
* npm or pnpm
* Running instance of the **NagarDrishti AI FastAPI backend** (default: `http://localhost:8000`)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional for local dev)
cp .env.example .env

# 3. Start local development server (Port 5174)
npm run dev
```

The portal will be accessible at:
👉 **http://localhost:5174**

---

## ⚙️ Environment Variables

Configure via `.env` or your hosting provider dashboard (e.g., Vercel):

| Variable | Description | Local Default | Production Example |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Public URL of the FastAPI backend | *(empty, uses Vite proxy)* | `https://your-backend.example.com` |

> 🔒 **Security Notice:** Do **NOT** add `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or database credentials to this frontend repository. Privileged credentials remain strictly secured within the FastAPI backend service.

---

## 🌐 Routes

* `/` — Authority landing overview & system capability highlights
* `/dashboard` — Municipal Command Center (KPIs, Central Map, Top Hotspots, Recent Queue)
* `/reports` — Comprehensive Complaints Queue with detailed inspection drawer
* `/map` — Geographic Map Intelligence with marker, cluster, and heatmap layers
* `/hotspots` — Spatial Hotspot Intelligence corridors & recommendations

---

## 🚢 Production Deployment (Vercel)

This repository is ready for zero-config Vercel deployment:

1. Import this repository in the **Vercel Dashboard**.
2. **Framework Preset**: `Vite`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variables**:
   * Set `VITE_API_BASE_URL` to your production FastAPI backend URL.
6. Click **Deploy**.

---

## 📄 License & Attribution

Designed and engineered for **NagarDrishti AI** municipal civic intelligence.
