# NagarDrishti AI Authority Backend

FastAPI-powered civic intelligence backend providing spatial clustering, complaint management, analytics, and department routing.

## 🚀 Quick Start

### 1. Requirements
- Python 3.10+
- Dependencies: `fastapi`, `uvicorn`, `pydantic`

### 2. Run Backend
```bash
python3 run.py
```
Or from the root directory:
```bash
npm run dev:backend
```

Server runs by default on:
👉 **http://localhost:8000**
Interactive API Swagger Docs:
👉 **http://localhost:8000/docs**

## 📡 API Endpoints

- `GET /api/dashboard/statistics` — KPI metrics, category breakdowns, daily trends, and hotspots
- `GET /api/dashboard/heatmap` — GIS weighted points for canvas heatmap layers
- `POST /api/dashboard/reset-demo` — Restore seed demonstration dataset
- `GET /api/complaints` — Filterable complaint queue (`problem_type`, `severity`, `status`, `department`, `limit`)
- `GET /api/complaints/{id}` — Deep complaint inspection
- `PATCH /api/complaints/{id}/status` — Status lifecycle transitions (`REPORTED` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED`)
- `POST /api/complaints` — Register new civic complaint
- `GET /api/departments` — List active municipal departments
