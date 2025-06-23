from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid


class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: str
    skills: Optional[List[str]] = []
    tier: Optional[str] = "bronze"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    skills: Optional[List[str]] = None
    avatar_url: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: uuid.UUID
    rating: float
    wallet_balance: float
    avatar_url: Optional[str] = None
    onboarding_completed: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True