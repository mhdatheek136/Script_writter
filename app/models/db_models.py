"""
Database models for Script Writer application.
Designed to be PostgreSQL-compatible while working with SQLite.
"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, 
    ForeignKey, Text, Enum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

from app.database import Base


def generate_uuid():
    """Generate a UUID string for primary keys."""
    return str(uuid.uuid4())


class UserRole(str, PyEnum):
    """User role enumeration."""
    ADMIN = "admin"
    USER = "user"


class FileType(str, PyEnum):
    """File type enumeration for stored files."""
    ORIGINAL_PPT = "original_ppt"
    GENERATED_PPTX = "generated_pptx"
    GENERATED_DOCX = "generated_docx"
    GENERATED_TXT = "generated_txt"
    GENERATED_JSON = "generated_json"
    SLIDE_IMAGE = "slide_image"


class User(Base):
    """User model for authentication and authorization."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"


class Project(Base):
    """Project model for organizing user's work."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="projects")
    files = relationship("FileRecord", back_populates="project", cascade="all, delete-orphan")
    ai_outputs = relationship("AIOutput", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.name}>"


class FileRecord(Base):
    """File record model for tracking S3-stored files."""
    __tablename__ = "file_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_type = Column(Enum(FileType), nullable=False)
    s3_key = Column(String(512), nullable=False, unique=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="files")

    def __repr__(self):
        return f"<FileRecord {self.original_filename}>"


class AIOutput(Base):
    """AI output model for storing generated content versions."""
    __tablename__ = "ai_outputs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    slides_data = Column(JSON, nullable=False)  # Full slide output data
    config_used = Column(JSON, nullable=True)   # Tone, style, etc.
    is_approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="ai_outputs")

    def __repr__(self):
        return f"<AIOutput project={self.project_id} v{self.version}>"
