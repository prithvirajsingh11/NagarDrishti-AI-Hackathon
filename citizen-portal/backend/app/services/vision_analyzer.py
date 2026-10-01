from abc import ABC, abstractmethod
from app.schemas.ai import CivicDetectionResult

from typing import Optional

class VisionAnalyzer(ABC):
    """
    Abstract VisionAnalyzer interface.
    Decouples the application and endpoints from any specific AI provider (Gemini, Local model, etc.)
    """

    @abstractmethod
    async def analyze(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        filename: Optional[str] = None
    ) -> CivicDetectionResult:
        """
        Analyze civic photograph and return structured CivicDetectionResult.
        
        Args:
            image_bytes: Raw bytes of the image
            mime_type: MIME type of the image (image/jpeg, image/png, image/webp)
            filename: Optional filename to assist offline demo heuristic matching
            
        Returns:
            CivicDetectionResult structured analysis
        """
        pass
