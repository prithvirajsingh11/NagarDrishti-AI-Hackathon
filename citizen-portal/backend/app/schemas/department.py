from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class DepartmentBase(BaseModel):
    name: str
    category: str
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
