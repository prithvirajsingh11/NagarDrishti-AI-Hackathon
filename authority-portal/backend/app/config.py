import os
from pathlib import Path

# Load .env file automatically
_backend_dir = Path(__file__).resolve().parent.parent
_root_dir = _backend_dir.parent

for _env_path in [_backend_dir / ".env", _root_dir / ".env"]:
    if _env_path.exists():
        try:
            with open(_env_path, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        _k = _k.strip()
                        _v = _v.strip().strip('"').strip("'")
                        if _k and _k not in os.environ:
                            os.environ[_k] = _v
        except Exception:
            pass

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://otjbonkovzciglttxfzz.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "complaint-images")

# Connection to user site (NagarDrishti-AI)
USER_SITE_API_URL = os.getenv("USER_SITE_API_URL", "").rstrip("/")
SHARED_DB_PATH = os.getenv(
    "SHARED_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "complaints_db.json")
)

# Local fallback paths
LOCAL_BACKUP_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "complaints_db.json"
)
UPLOAD_DIR = os.getenv(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
)
