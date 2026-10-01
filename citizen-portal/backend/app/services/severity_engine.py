from typing import List
from app.schemas.ai import ProblemType, SeverityLevel

class SeverityEngine:
    """
    Deterministic Severity Engine for civic problem assessment.
    Labels result as 'AI-estimated visual severity'.
    Does not replace engineering or certified safety evaluation.
    """

    CRITICAL_KEYWORDS = {
        "sinkhole", "cave-in", "sparking", "exposed wire", "live wire", "flooding", 
        "sewage flood", "imminent collapse", "danger", "hazardous", "completely blocked"
    }

    HIGH_KEYWORDS = {
        "large", "deep", "active lane", "traffic hazard", "overflowing", "spill", 
        "broken glass", "dangling", "heavy obstruction", "black water", "open manhole"
    }

    MEDIUM_KEYWORDS = {
        "moderate", "crack", "depressed", "accumulated", "unlit", "flickering", 
        "clogged", "standing water", "debris"
    }

    @classmethod
    def evaluate(cls, problem_type: ProblemType, evidence: List[str], raw_severity: str = None) -> SeverityLevel:
        evidence_text = " ".join(evidence).lower()

        # Check critical triggers
        if any(keyword in evidence_text for keyword in cls.CRITICAL_KEYWORDS):
            return SeverityLevel.CRITICAL
        
        # Check high triggers
        if any(keyword in evidence_text for keyword in cls.HIGH_KEYWORDS):
            return SeverityLevel.HIGH

        # Check medium triggers
        if any(keyword in evidence_text for keyword in cls.MEDIUM_KEYWORDS):
            return SeverityLevel.MEDIUM

        # Fallback to model's suggested severity if valid, else default by problem
        if raw_severity:
            norm_sev = raw_severity.strip().upper()
            if norm_sev in SeverityLevel.__members__:
                return SeverityLevel(norm_sev)

        if problem_type in [ProblemType.POTHOLE, ProblemType.DRAIN]:
            return SeverityLevel.MEDIUM
        return SeverityLevel.LOW
