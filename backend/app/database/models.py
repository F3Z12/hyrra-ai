"""
SQLAlchemy ORM models.

Defines the database schema for:
- Resume: stored resume text and parsed profile
- Job: stored job posting text and parsed profile
- Application: tracks application status for a job/resume pair
- MatchResult: stores job-resume match scores and details
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship

from app.database.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Valid application statuses
# ---------------------------------------------------------------------------

VALID_APPLICATION_STATUSES = {"saved", "applied", "interviewing", "offer", "rejected"}


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    raw_text = Column(Text, nullable=False)
    parsed_profile_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    applications = relationship("Application", back_populates="resume")
    match_results = relationship("MatchResult", back_populates="resume")


# ---------------------------------------------------------------------------
# Job
# ---------------------------------------------------------------------------

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="")
    company = Column(String, default="")
    location = Column(String, default="")
    employment_type = Column(String, default="")
    source_type = Column(String, default="text")
    source_label = Column(String, nullable=True)
    raw_text = Column(Text, nullable=False)
    parsed_profile_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    applications = relationship("Application", back_populates="job")
    match_results = relationship("MatchResult", back_populates="job")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)
    status = Column(String, default="saved")
    notes = Column(Text, nullable=True)
    date_applied = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    job = relationship("Job", back_populates="applications")
    resume = relationship("Resume", back_populates="applications")


# ---------------------------------------------------------------------------
# MatchResult
# ---------------------------------------------------------------------------

class MatchResult(Base):
    __tablename__ = "match_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    match_score = Column(Integer, nullable=False)
    recommendation = Column(String, default="")
    matched_skills_json = Column(Text, nullable=True)
    missing_required_skills_json = Column(Text, nullable=True)
    missing_preferred_skills_json = Column(Text, nullable=True)
    keyword_overlap_json = Column(Text, nullable=True)
    reasoning = Column(Text, nullable=True)
    suggested_angle = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    job = relationship("Job", back_populates="match_results")
    resume = relationship("Resume", back_populates="match_results")
