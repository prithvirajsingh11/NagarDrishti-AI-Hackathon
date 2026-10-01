from typing import Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import CORS_ORIGINS, UPLOAD_DIR, STORAGE_BUCKET
from app.routers import complaints_router, dashboard_router, departments_router
from app.services.store import data_store

security = HTTPBearer(auto_error=False)

app = FastAPI(
    title="NagarDrishti AI Authority Backend",
    description="Municipal Civic Intelligence REST API for NagarDrishti AI Authority Portal.",
    version="1.0.0",
)

# Cross-Origin Resource Sharing configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure local upload directory exists
upload_path = Path(UPLOAD_DIR)
try:
    upload_path.mkdir(parents=True, exist_ok=True)
except OSError:
    upload_path = Path("/tmp/uploads")
    upload_path.mkdir(parents=True, exist_ok=True)

# Mount local upload directory for static image serving
if upload_path.exists():
    app.mount("/storage", StaticFiles(directory=str(upload_path)), name="storage")

# Mount API Routers
app.include_router(complaints_router)
app.include_router(dashboard_router)
app.include_router(departments_router)


from app.auth import verify_token, security


@app.get("/api/auth/me")
def get_auth_me(user: dict = Depends(verify_token)):
    """Verifies authority caller session against Supabase Auth and profiles table."""
    return user


@app.get("/api/complaints/image/{filename}")
def get_complaint_image(filename: str):
    """Serve complaint photograph directly from upload storage or Supabase private bucket."""
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    ext = Path(filename).suffix.lower()
    media_type = media_types.get(ext, "image/jpeg")

    file_path = upload_path / filename
    if file_path.exists():
        with open(file_path, "rb") as f:
            return Response(content=f.read(), media_type=media_type)

    # Try downloading from Supabase storage
    client = data_store._get_supabase_client()
    if client:
        try:
            data = client.storage.from_(STORAGE_BUCKET).download(filename)
            if data:
                return Response(content=data, media_type=media_type)
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="Image not found.")


@app.get("/")
def root():
    return {
        "service": "NagarDrishti AI Authority Backend",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs",
        "supabase_connected": bool(data_store._get_supabase_client()),
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
