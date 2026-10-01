from typing import List
from fastapi import APIRouter
from ..models.schemas import Department
from ..services.store import data_store

router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.get("", response_model=List[Department])
def get_departments():
    """Retrieve all municipal departments responsible for civic complaints."""
    return data_store.list_departments()
