from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ARRAY, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    weight = Column(Integer, default=1)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String, default="open")  # open, assigned, submitted, approved, rejected
    payout = Column(Float, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    pricing_type = Column(String, default="fixed")  # fixed, hourly
    hourly_rate = Column(Float, nullable=True)
    estimated_hours = Column(Integer, nullable=True)
    required_skills = Column(ARRAY(String), default=[])
    auto_assign = Column(Boolean, default=False)
    application_window_minutes = Column(Integer, default=60)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id])


# Add relationship to User model
from app.models.user import User
User.assigned_tasks = relationship("Task", foreign_keys=[Task.assignee_id])