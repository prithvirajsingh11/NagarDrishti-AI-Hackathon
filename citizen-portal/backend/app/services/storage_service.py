import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    """
    Secure storage service for citizen complaint photos.
    Integrates with private Supabase Storage ('complaint-images' bucket).
    Controlled image access ensures zero public bucket exposure.
    Falls back gracefully to local storage in testing/dev environments.
    """

    def __init__(self):
        self.bucket = settings.STORAGE_BUCKET
        self.local_dir = Path(settings.UPLOAD_DIR)
        try:
            self.local_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            self.local_dir = Path("/tmp/uploads")
            try:
                self.local_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
        self._supabase = None

    def _get_supabase_client(self):
        if self._supabase is None:
            if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
                try:
                    from supabase import create_client
                    self._supabase = create_client(
                        settings.SUPABASE_URL,
                        settings.SUPABASE_SERVICE_ROLE_KEY
                    )
                except Exception as e:
                    logger.warning(f"Could not initialize Supabase storage client: {e}")
        return self._supabase

    async def upload_image(self, file_bytes: bytes, mime_type: str = "image/jpeg") -> str:
        """
        Uploads image file to private storage.
        Returns controlled backend access URL (/api/complaints/image/{filename}).
        """
        ext = "jpg"
        if "png" in mime_type:
            ext = "png"
        elif "webp" in mime_type:
            ext = "webp"

        filename = f"{uuid.uuid4().hex}.{ext}"

        # 1. Try private Supabase Storage
        client = self._get_supabase_client()
        if client:
            try:
                client.storage.from_(self.bucket).upload(
                    path=filename,
                    file=file_bytes,
                    file_options={"content-type": mime_type}
                )
                logger.info(f"Uploaded photo to private Supabase Storage: {filename}")
                return f"/api/complaints/image/{filename}"
            except Exception as e:
                logger.warning(f"Supabase storage upload failed ({e}). Falling back to local storage.")

        # 2. Local fallback storage
        local_path = self.local_dir / filename
        with open(local_path, "wb") as f:
            f.write(file_bytes)

        logger.info(f"Saved photo to local storage at {local_path}")
        return f"/api/complaints/image/{filename}"

    async def get_image_bytes(self, filename: str) -> Optional[Tuple[bytes, str]]:
        """
        Retrieves image bytes and content-type from private Supabase Storage or local fallback.
        """
        # Determine content type
        content_type = "image/jpeg"
        if filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".webp"):
            content_type = "image/webp"

        # 1. Try Supabase private storage
        client = self._get_supabase_client()
        if client:
            try:
                data = client.storage.from_(self.bucket).download(filename)
                if data:
                    return data, content_type
            except Exception as e:
                logger.warning(f"Could not download {filename} from Supabase: {e}")

        # 2. Try local fallback storage
        local_path = self.local_dir / filename
        if local_path.exists():
            with open(local_path, "rb") as f:
                return f.read(), content_type

        return None

    async def create_signed_url(self, filename: str, expires_in: int = 3600) -> Optional[str]:
        """
        Generates a temporary signed URL for authorized access to the private bucket.
        """
        client = self._get_supabase_client()
        if client:
            try:
                res = client.storage.from_(self.bucket).create_signed_url(filename, expires_in)
                if hasattr(res, "signed_url") and res.signed_url:
                    return res.signed_url
                if hasattr(res, "signedURL") and res.signedURL:
                    return res.signedURL
                if isinstance(res, dict):
                    return res.get("signedURL") or res.get("signedUrl")
            except Exception as e:
                logger.warning(f"Failed to generate signed URL for {filename}: {e}")
        return None

storage_service = StorageService()
