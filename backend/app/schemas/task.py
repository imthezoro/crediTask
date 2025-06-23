from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class TaskBase(BaseModel):
    title: str
    description: str
    weight: int = 1
    payout: float
    deadline: Optional[datetime] = None
    pricing_type: str = "fixed"
    hourly_rate: Optional[float] = None
    estimated_hours: Optional[int] = None
    required_skills: Optional[List[str]] = []
    auto_assign: bool = False
    application_window_minutes: int = 60


class TaskCreate(TaskBase):
    project_id: uuid.UUID


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[int] = None
    payout: Optional[float] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    assignee_id: Optional[uuid.UUID] = None
    pricing_type: Optional[str] = None
    hourly_rate: Optional[float] = None
    estimated_hours: Optional[int] = None
    required_skills: Optional[List[str]] = None
    auto_assign: Optional[bool] = None


class TaskResponse(TaskBase):
    id: uuid.UUID
    project_id: uuid.UUID
    assignee_id: Optional[uuid.UUID] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True