import asyncio
import io
import json
import logging
import re
from typing import Optional, Tuple
from PIL import Image, ImageStat
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.ai import CivicDetectionResult, ProblemType, SeverityLevel
from app.services.vision_analyzer import VisionAnalyzer
from app.services.severity_engine import SeverityEngine
from app.services.department_resolver import DepartmentResolver

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are NagarDrishti AI, an automated civic vision analyzer assisting citizens in identifying municipal infrastructure issues from photos.

Analyze the user's photograph strictly against these 5 supported categories:
1. pothole: Road-surface pothole, crater, severe asphalt depression, or significant road damage.
2. garbage: Visible accumulation, pile, or open dumping of solid municipal waste/litter.
3. streetlight: A visibly damaged, broken, leaning, fallen, or malfunctioning streetlight fixture or pole.
4. drain: Overflowing, blocked, clogged, broken, or problematic stormwater drain, open sewer, or gutter.
5. other: Image does not contain a supported civic problem, is an indoor scene, is blurry/dark/unclear, or visual confidence is insufficient.

CRITICAL RULES:
- Analyze ONLY what is visually observable in the image. Do not invent or assume hidden context.
- Choose EXACTLY ONE supported category: "pothole", "garbage", "streetlight", "drain", or "other". Do not invent any other category.
- Estimate confidence honestly (0.0 to 1.0) reflecting clear visual certainty.
- If the image does NOT contain a supported civic problem, or is ambiguous, dark, blurry, indoor, or non-civic, you MUST select "other" and set needs_retake=true.
- Provide 1 to 3 concise, objective visual evidence points in 'evidence'.
- Severity is an AI-estimated visual severity (LOW, MEDIUM, HIGH, CRITICAL). It is NOT an engineering certification or official safety rating.
- You must NOT determine: official department assignment, official government priority, complaint approval, or acceptance.
- Output ONLY a valid JSON object matching this schema:
{
  "problem_type": "pothole" | "garbage" | "streetlight" | "drain" | "other",
  "confidence": 0.94,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "evidence": ["Concise visual observation 1", "Concise visual observation 2"],
  "alternatives": [],
  "needs_retake": false
}
"""

def inspect_image_quality(image: Image.Image) -> Tuple[bool, Optional[str]]:
    """
    Pre-analysis inspection of image quality using PIL.
    Identifies obvious unusable images (extremely dark, blank, uniform, or tiny)
    before or during AI inference to prevent hallucination and conserve quota.
    """
    width, height = image.size
    if width < 50 or height < 50:
        return False, "Image resolution is too small to identify civic issues."

    # Convert to grayscale to evaluate luminance and variance
    gray = image.convert("L")
    stat = ImageStat.Stat(gray)
    mean_val = stat.mean[0]
    stddev_val = stat.stddev[0]

    # Extremely dark images (night with no light, lens capped)
    if mean_val < 15.0:
        return False, "Image is extremely dark. The civic problem is not visible."

    # Completely blank, uniform, or washed out images
    if stddev_val < 4.0:
        return False, "Image is nearly blank or lacks visual contrast."

    # Extremely overexposed images
    if mean_val > 250.0:
        return False, "Image is severely overexposed. The civic problem cannot be discerned."

    return True, None


class GeminiVisionProvider(VisionAnalyzer):
    """
    Multimodal Gemini vision provider for NagarDrishti AI.
    All calls route through the FastAPI backend to protect API keys.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured")
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize google-genai client: {e}")
                raise
        return self._client

    async def analyze(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        filename: Optional[str] = None
    ) -> CivicDetectionResult:
        logger.info(f"Analyzing civic image with Gemini Vision ({len(image_bytes)} bytes, {mime_type})")
        
        # 1. Verify decodable image bytes
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.verify()
            # Reopen for quality statistics inspection (verify() closes buffer state)
            pil_image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            logger.warning(f"Corrupted or invalid image uploaded: {e}")
            return CivicDetectionResult(
                problem_type=ProblemType.OTHER,
                confidence=0.1,
                severity=SeverityLevel.LOW,
                evidence=["The uploaded file is corrupted or not a valid image."],
                needs_retake=True,
                suggested_department=DepartmentResolver.resolve(ProblemType.OTHER),
                guidance_message="We couldn't clearly identify the civic issue. Please capture a clearer photo.",
                is_fallback=False
            )

        # 2. Quality check: Darkness, blurriness, blankness
        is_usable, quality_reason = inspect_image_quality(pil_image)
        if not is_usable:
            logger.info(f"Image rejected during quality check: {quality_reason}")
            return CivicDetectionResult(
                problem_type=ProblemType.OTHER,
                confidence=0.15,
                severity=SeverityLevel.LOW,
                evidence=[quality_reason or "Image quality is insufficient for civic problem detection."],
                alternatives=[],
                needs_retake=True,
                suggested_department=DepartmentResolver.resolve(ProblemType.OTHER),
                guidance_message="We couldn't clearly identify the civic issue. Please capture a clearer photo.",
                is_fallback=False
            )

        # 3. If no Gemini API key configured, use local fallback stub with explicit warning
        if not self.api_key:
            logger.warning("GEMINI_API_KEY is missing. Invoking local demo fallback stub.")
            from app.services.local_provider import LocalVisionProvider
            return await LocalVisionProvider().analyze(image_bytes, mime_type, filename=filename)

        # 4. Invoke Gemini multimodal API with timeout and structured parsing
        try:
            from google.genai import types
            from google.genai.errors import APIError
            client = self._get_client()

            models_to_try = []
            for m in [self.model_name, "gemini-3.5-flash-lite", "gemini-3.7-flash"]:
                if m and m not in models_to_try:
                    models_to_try.append(m)

            response = None
            last_err = None
            for m in models_to_try:
                try:
                    def _call_model(target_model=m):
                        return client.models.generate_content(
                            model=target_model,
                            contents=[
                                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                                SYSTEM_PROMPT
                            ],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                temperature=0.1,
                            )
                        )

                    response = await asyncio.wait_for(
                        asyncio.to_thread(_call_model),
                        timeout=15.0
                    )
                    if response and response.text:
                        break
                except Exception as model_err:
                    last_err = model_err
                    logger.warning(f"Gemini model {m} failed: {model_err}. Trying alternate if available...")

            if not response or not response.text:
                if last_err:
                    raise last_err
                raise RuntimeError("Empty response from Gemini Vision.")

            raw_text = response.text or "{}"
            # Extract JSON block
            json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            try:
                parsed_json = json.loads(json_match.group(0) if json_match else raw_text)
            except Exception as json_err:
                logger.warning(f"Malformed JSON from Gemini model: {json_err}. Raw text: {raw_text[:200]}")
                return CivicDetectionResult(
                    problem_type=ProblemType.OTHER,
                    confidence=0.2,
                    severity=SeverityLevel.LOW,
                    evidence=["AI model response was malformed or unstructured."],
                    alternatives=[],
                    needs_retake=True,
                    suggested_department=DepartmentResolver.resolve(ProblemType.OTHER),
                    guidance_message="We couldn't clearly identify the civic issue. Please capture a clearer photo.",
                    is_fallback=False
                )


            # Validate problem_type strictly against supported set
            problem_type_str = str(parsed_json.get("problem_type", "other")).strip().lower()
            if problem_type_str in ProblemType._value2member_map_:
                problem_type = ProblemType(problem_type_str)
            else:
                logger.warning(f"Model returned unsupported category '{problem_type_str}', mapping to 'other'")
                problem_type = ProblemType.OTHER

            # Validate confidence
            try:
                confidence = float(parsed_json.get("confidence", 0.5))
            except (ValueError, TypeError):
                confidence = 0.5
            confidence = max(0.0, min(1.0, confidence))

            raw_severity = parsed_json.get("severity", "LOW")
            evidence = parsed_json.get("evidence", [])
            if isinstance(evidence, str):
                evidence = [evidence]
            elif not isinstance(evidence, list):
                evidence = []

            alternatives = parsed_json.get("alternatives", [])
            if not isinstance(alternatives, list):
                alternatives = []

            needs_retake = bool(parsed_json.get("needs_retake", False))

            # Apply deterministic SeverityEngine based on evidence
            severity = SeverityEngine.evaluate(problem_type, evidence, raw_severity)

            # Apply Confidence Threshold safeguard
            guidance = None
            if confidence < settings.AI_CONFIDENCE_THRESHOLD or problem_type == ProblemType.OTHER:
                needs_retake = True
                guidance = "We couldn't clearly identify the civic issue. Please capture a clearer photo."
                if problem_type != ProblemType.OTHER:
                    alternatives = list(set(alternatives + [problem_type.value]))
                    problem_type = ProblemType.OTHER

            # Deterministic Department Routing (Outside Gemini)
            suggested_dept = DepartmentResolver.resolve(problem_type)

            return CivicDetectionResult(
                problem_type=problem_type,
                confidence=round(confidence, 2),
                severity=severity,
                evidence=evidence,
                alternatives=alternatives,
                needs_retake=needs_retake,
                suggested_department=suggested_dept,
                guidance_message=guidance or ("AI-estimated visual detection complete." if not needs_retake else "Please capture a clearer photo."),
                is_fallback=False
            )

        except asyncio.TimeoutError:
            logger.error("Gemini API call timed out after 15 seconds")
            raise TimeoutError("AI analysis timed out. Please try again.")

        except Exception as e:
            err_str = str(e).lower()
            logger.error(f"Gemini API request failed: {e}")

            # Specific quota/rate-limit check
            if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
                raise RuntimeError("AI analysis is temporarily unavailable. Please try again.")

            # Fall back safely to demo local provider if general network/auth error occurred
            logger.info("Falling back to demo local provider due to API error")
            from app.services.local_provider import LocalVisionProvider
            fallback_res = await LocalVisionProvider().analyze(image_bytes, mime_type, filename=filename)
            fallback_res.guidance_message = "[DEMO FALLBACK] Live Gemini unreachable; generated fallback demonstration triage. You may edit all details."
            return fallback_res
