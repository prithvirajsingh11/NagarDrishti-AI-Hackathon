from .complaints import router as complaints_router
from .dashboard import router as dashboard_router
from .departments import router as departments_router

__all__ = ["complaints_router", "dashboard_router", "departments_router"]
