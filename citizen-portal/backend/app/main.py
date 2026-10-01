import os
import sys
from pathlib import Path

# Ensure backend root is always on sys.path
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api import analyze, complaints, dashboard, departments, nearby, notifications

# Ensure local upload dir exists (with fallback for serverless read-only environments)
upload_path = Path(settings.UPLOAD_DIR)
try:
    upload_path.mkdir(parents=True, exist_ok=True)
except Exception:
    upload_path = Path("/tmp/uploads")
    try:
        upload_path.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

if not upload_path.exists():
    upload_path = Path("/tmp/uploads")
    try:
        upload_path.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Civic Intelligence - Decision-Support Platform for Citizens & Municipal Authorities",
    version=settings.VERSION,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.0\.2\.2)(:\d+)?|capacitor://localhost)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local upload directory for image serving if available
if upload_path.exists():
    app.mount("/storage", StaticFiles(directory=str(upload_path)), name="storage")

# Include API Routers under /api prefix
app.include_router(analyze.router, prefix=settings.API_V1_PREFIX)
app.include_router(complaints.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
app.include_router(nearby.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "tagline": "AI-Powered Civic Intelligence",
        "version": settings.VERSION,
        "status": "online",
        "ai_provider": settings.AI_PROVIDER,
        "docs": "/api/docs"
    }

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "provider": settings.AI_PROVIDER
    }

from typing import Dict
from fastapi import Depends
from app.core.auth import get_current_user

@app.get("/api/auth/me")
async def get_authenticated_user_profile(user: Dict = Depends(get_current_user)):
    """
    Returns verified caller profile with role directly validated by backend/Supabase.
    """
    return user
