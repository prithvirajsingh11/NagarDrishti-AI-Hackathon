import io
import logging
from typing import Optional
from PIL import Image
from app.schemas.ai import CivicDetectionResult, ProblemType, SeverityLevel
from app.services.vision_analyzer import VisionAnalyzer
from app.services.severity_engine import SeverityEngine
from app.services.department_resolver import DepartmentResolver

logger = logging.getLogger(__name__)

class LocalVisionProvider(VisionAnalyzer):
    """
    Local / Offline Vision Provider stub.
    Implements VisionAnalyzer to keep the AI provider replaceable without altering business logic.
    Identified explicitly as a demo fallback.
    """

    async def analyze(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        filename: Optional[str] = None
    ) -> CivicDetectionResult:
        logger.info(f"Running LocalVisionProvider fallback stub ({len(image_bytes)} bytes, filename: {filename})")
        
        # Verify image integrity
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.verify()
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return CivicDetectionResult(
                problem_type=ProblemType.OTHER,
                confidence=0.1,
                severity=SeverityLevel.LOW,
                evidence=["The uploaded file is not a valid or decodable image."],
                needs_retake=True,
                suggested_department=DepartmentResolver.resolve(ProblemType.OTHER),
                guidance_message="We couldn't clearly identify the civic issue. Please capture a clearer photo.",
                is_fallback=True
            )

        fn = (filename or "").lower()

        # Differentiate civic issue based on filename or offline demo heuristics
        if any(k in fn for k in ["garbage", "trash", "waste", "dump"]):
            problem_type = ProblemType.GARBAGE
            confidence = 0.88
            evidence = [
                "[DEMO FALLBACK] Solid municipal waste accumulation identified",
                "[DEMO FALLBACK] Dispersed roadside refuse packaging"
            ]
            alternatives = ["drain"]
            needs_retake = False
        elif any(k in fn for k in ["streetlight", "light", "lamp", "pole"]):
            problem_type = ProblemType.STREETLIGHT
            confidence = 0.90
            evidence = [
                "[DEMO FALLBACK] Streetlight luminaire structural damage identified",
                "[DEMO FALLBACK] Overhead electrical fixture defect"
            ]
            alternatives = ["other"]
            needs_retake = False
        elif any(k in fn for k in ["drain", "sewer", "gutter", "water", "overflow"]):
            problem_type = ProblemType.DRAIN
            confidence = 0.86
            evidence = [
                "[DEMO FALLBACK] Stormwater drain sediment blockage identified",
                "[DEMO FALLBACK] Water stagnation and gutter overflow risk"
            ]
            alternatives = ["pothole"]
            needs_retake = False
        elif any(k in fn for k in ["unclear", "blur", "dark", "unknown"]):
            return CivicDetectionResult(
                problem_type=ProblemType.OTHER,
                confidence=0.35,
                severity=SeverityLevel.LOW,
                evidence=["[DEMO FALLBACK] Low visual contrast or ambiguous civic subject."],
                alternatives=["pothole", "garbage"],
                needs_retake=True,
                suggested_department=DepartmentResolver.resolve(ProblemType.OTHER),
                guidance_message="We couldn't clearly identify the civic issue. Please capture a clearer photo.",
                is_fallback=True
            )
        else:
            # Default fallback detection
            problem_type = ProblemType.POTHOLE
            confidence = 0.85
            evidence = [
                "[DEMO FALLBACK] Road-surface asphalt defect identified",
                "[DEMO FALLBACK] Active traffic lane depression pattern"
            ]
            alternatives = ["drain"]
            needs_retake = False

        severity = SeverityEngine.evaluate(problem_type, evidence)
        suggested_dept = DepartmentResolver.resolve(problem_type)

        return CivicDetectionResult(
            problem_type=problem_type,
            confidence=confidence,
            severity=severity,
            evidence=evidence,
            alternatives=alternatives,
            needs_retake=needs_retake,
            suggested_department=suggested_dept,
            guidance_message="[DEMO FALLBACK] Offline demo detection. To enable live Gemini AI, set GEMINI_API_KEY in backend/.env.",
            is_fallback=True
        )
