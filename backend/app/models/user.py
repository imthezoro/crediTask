from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ARRAY, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'client' or 'worker'
    skills = Column(ARRAY(String), default=[])
    rating = Column(Float, default=0.0)
    wallet_balance = Column(Float, default=0.0)
    avatar_url = Column(String, nullable=True)
    tier = Column(String, default="bronze")  # bronze, silver, gold, platinum
    onboarding_completed = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())