from pydantic import BaseModel
from datetime import datetime
import uuid


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: str
    read: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True