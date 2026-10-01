import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NagarDrishti AI"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api"
    
    # AI Configuration
    AI_PROVIDER: str = "gemini"  # "gemini" | "local" | "mock"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    AI_CONFIDENCE_THRESHOLD: float = 0.75
    
    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    STORAGE_BUCKET: str = "complaint-images"
    
    # Local fallback image upload dir
    UPLOAD_DIR: str = "uploads"

    # Phase 7: Civic Discovery & Follow-up Configuration
    STATUS_REQUEST_INACTIVITY_HOURS: int = 48  # Minimum hours of inactivity before request can be made
    STATUS_REQUEST_COOLDOWN_HOURS: int = 24    # Minimum cooldown hours between follow-up requests
    NEARBY_DEFAULT_RADIUS_KM: float = 10.0     # Default radius for nearby issue discovery
    SIMILAR_DEFAULT_RADIUS_KM: float = 1.0     # Default radius for duplicate/similar issue detection
    SIMILAR_MAX_AGE_DAYS: int = 30             # Time window for pre-submission similar issues
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost",
        "http://127.0.0.1",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
