from typing import Dict, Optional
from app.schemas.ai import ProblemType

class DepartmentResolver:
    """
    Deterministic resolver that suggests the municipal department for a civic issue.
    Displayed in UI as 'Suggested Department'.
    """

    DEFAULT_MAPPINGS: Dict[ProblemType, str] = {
        ProblemType.POTHOLE: "Municipal Roads",
        ProblemType.GARBAGE: "Sanitation",
        ProblemType.STREETLIGHT: "Electrical / Municipal Lighting",
        ProblemType.DRAIN: "Drainage / Sanitation",
        ProblemType.OTHER: "Manual Review",
    }

    @classmethod
    def resolve(cls, problem_type: ProblemType, custom_mappings: Optional[Dict[str, str]] = None) -> str:
        if custom_mappings and problem_type.value in custom_mappings:
            return custom_mappings[problem_type.value]
        return cls.DEFAULT_MAPPINGS.get(problem_type, "Manual Review")
