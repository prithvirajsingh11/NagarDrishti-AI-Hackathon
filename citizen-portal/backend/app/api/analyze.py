import asyncio
import logging
from typing import Dict
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from app.core.auth import get_current_user
from app.core.config import settings
from app.schemas.ai import CivicDetectionResult
from app.services.vision_analyzer import VisionAnalyzer
from app.services.gemini_provider import GeminiVisionProvider
from app.services.local_provider import LocalVisionProvider

router = APIRouter(prefix="/analyze", tags=["AI Vision Analysis"])
logger = logging.getLogger(__name__)

SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

def get_vision_analyzer() -> VisionAnalyzer:
    if settings.AI_PROVIDER == "gemini":
        return GeminiVisionProvider()
    elif settings.AI_PROVIDER == "local":
        return LocalVisionProvider()
    else:
        if settings.GEMINI_API_KEY:
            return GeminiVisionProvider()
        return LocalVisionProvider()

@router.post("", response_model=CivicDetectionResult)
@router.post("/", response_model=CivicDetectionResult)
async def analyze_civic_image(
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user)
):
    """
    Analyze citizen photograph using AI Vision.
    Routes to configured VisionAnalyzer (Gemini or Local model).
    Never exposes API keys or cloud credentials to clients.
    """
    content_type = file.content_type or ""
    if content_type.lower() not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image format '{content_type}'. Please upload JPG, PNG, or WEBP."
        )

    try:
        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file received. Please capture or upload a valid photo."
            )
        if len(image_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image file too large. Maximum supported size is 10 MB."
            )

        analyzer = get_vision_analyzer()
        result = await analyzer.analyze(image_bytes, mime_type=content_type, filename=file.filename)
        return result

    except HTTPException:
        raise

    except (TimeoutError, asyncio.TimeoutError):
        logger.warning("AI analysis timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI analysis timed out. Please try again."
        )

    except RuntimeError as re_err:
        err_msg = str(re_err)
        logger.warning(f"AI rate limit or quota issue: {err_msg}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI analysis is temporarily unavailable. Please try again."
        )

    except Exception as e:
        logger.error(f"Error analyzing image: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI analysis is temporarily unavailable. Please try again."
        )
