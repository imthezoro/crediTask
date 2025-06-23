from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class ProjectBase(BaseModel):
    title: str
    description: str
    tags: Optional[List[str]] = []
    budget: float


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    budget: Optional[float] = None
    status: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: uuid.UUID
    client_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True