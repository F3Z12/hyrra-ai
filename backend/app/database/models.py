"""
SQLAlchemy ORM models.

Defines the database schema for:
- Resume: stored resume text and parsed profile
- Job: stored job posting text and parsed profile
- Application: tracks application status for a job/resume pair
- MatchResult: stores job-resume match scores and details
- OutreachContact: manually saved human contacts for a job
- OutreachMessage: outreach drafts and status tracking
- CandidateProfile: structured candidate identity/education/links for Apply Agent
- ApplyAgentSession: one Apply Agent run linking profile + job + optional resume
- ApplyAgentFieldSuggestion: per-field suggestions generated at session creation
- ApplyAgentActionLog: immutable audit log of every user field decision
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean,
)
from sqlalchemy.orm import relationship

from app.database.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Valid application statuses
# ---------------------------------------------------------------------------

VALID_APPLICATION_STATUSES = {"saved", "applied", "interviewing", "offer", "rejected"}
VALID_OUTREACH_MESSAGE_TYPES = {"email", "linkedin_dm", "follow_up", "referral_request"}
VALID_OUTREACH_MESSAGE_STATUSES = {"draft", "copied", "sent", "replied", "closed"}


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
    outreach_contacts = relationship("OutreachContact", back_populates="job")
    outreach_messages = relationship("OutreachMessage", back_populates="job")


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


# ---------------------------------------------------------------------------
# OutreachContact
# ---------------------------------------------------------------------------

class OutreachContact(Base):
    __tablename__ = "outreach_contacts"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    name = Column(String, nullable=False)
    title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    email = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    source = Column(String, nullable=True)
    confidence_score = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    job = relationship("Job", back_populates="outreach_contacts")
    messages = relationship("OutreachMessage", back_populates="contact")


# ---------------------------------------------------------------------------
# OutreachMessage
# ---------------------------------------------------------------------------

class OutreachMessage(Base):
    __tablename__ = "outreach_messages"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("outreach_contacts.id"), nullable=True)
    message_type = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    status = Column(String, default="draft")
    follow_up_date = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    job = relationship("Job", back_populates="outreach_messages")
    contact = relationship("OutreachContact", back_populates="messages")


# ---------------------------------------------------------------------------
# Apply Agent — constants
# ---------------------------------------------------------------------------

VALID_APPLY_AGENT_SESSION_STATUSES  = {"created", "in_progress", "completed", "abandoned"}
VALID_APPLY_AGENT_ACTION_TYPES      = {"accepted", "edited", "skipped", "manual_entry"}
VALID_APPLY_AGENT_RESOLVED_STATUSES = {"accepted", "edited", "skipped"}


# ---------------------------------------------------------------------------
# CandidateProfile
# ---------------------------------------------------------------------------

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id    = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False)

    # Optional link to a stored resume (supplements profile data)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)

    # Identity
    first_name     = Column(String, nullable=True)
    last_name      = Column(String, nullable=True)
    preferred_name = Column(String, nullable=True)
    email          = Column(String, nullable=True)
    phone          = Column(String, nullable=True)
    location_city  = Column(String, nullable=True)
    location_region = Column(String, nullable=True)
    country        = Column(String, nullable=True)

    # Education
    school           = Column(String,  nullable=True)
    program          = Column(String,  nullable=True)
    degree           = Column(String,  nullable=True)
    graduation_month = Column(Integer, nullable=True)
    graduation_year  = Column(Integer, nullable=True)
    gpa_optional     = Column(String,  nullable=True)

    # Links
    linkedin_url         = Column(String, nullable=True)
    github_url           = Column(String, nullable=True)
    portfolio_url        = Column(String, nullable=True)
    personal_website_url = Column(String, nullable=True)
    other_links_json     = Column(Text,   nullable=True)  # JSON: [{"label": "...", "url": "..."}]

    # Work authorization / availability
    work_authorization_country = Column(String,  nullable=True)
    authorized_to_work         = Column(String,  nullable=True)  # "yes" / "no" / "with_sponsorship"
    requires_sponsorship       = Column(Boolean, nullable=True)
    available_start_date       = Column(String,  nullable=True)  # ISO date string, user-entered
    available_end_date         = Column(String,  nullable=True)
    preferred_work_location    = Column(String,  nullable=True)
    open_to_remote             = Column(Boolean, nullable=True)

    # Reusable application answer context
    default_why_interested   = Column(Text, nullable=True)
    default_relevant_project = Column(Text, nullable=True)
    default_additional_info  = Column(Text, nullable=True)
    default_cover_note       = Column(Text, nullable=True)

    # Technical highlights
    top_skills_json   = Column(Text, nullable=True)  # JSON: ["Python", "React", ...]
    top_projects_json = Column(Text, nullable=True)  # JSON: [{"name": "...", "description": "...", "url": "..."}]

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    resume              = relationship("Resume")
    apply_agent_sessions = relationship("ApplyAgentSession", back_populates="candidate_profile")


# ---------------------------------------------------------------------------
# ApplyAgentSession
# ---------------------------------------------------------------------------

class ApplyAgentSession(Base):
    __tablename__ = "apply_agent_sessions"

    id                   = Column(Integer, primary_key=True, index=True)
    candidate_profile_id = Column(Integer, ForeignKey("candidate_profiles.id"), nullable=False)
    job_id               = Column(Integer, ForeignKey("jobs.id"),               nullable=False)
    resume_id            = Column(Integer, ForeignKey("resumes.id"),            nullable=True)
    status               = Column(String,  default="created")
    form_fields_json     = Column(Text,    nullable=True)   # JSON snapshot of field definitions at session creation
    created_at           = Column(DateTime, default=_utcnow)
    updated_at           = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    candidate_profile = relationship("CandidateProfile", back_populates="apply_agent_sessions")
    job               = relationship("Job")
    resume            = relationship("Resume")
    suggestions       = relationship("ApplyAgentFieldSuggestion", back_populates="session")
    action_logs       = relationship("ApplyAgentActionLog",       back_populates="session")


# ---------------------------------------------------------------------------
# ApplyAgentFieldSuggestion
# ---------------------------------------------------------------------------

class ApplyAgentFieldSuggestion(Base):
    __tablename__ = "apply_agent_field_suggestions"

    id             = Column(Integer, primary_key=True, index=True)
    session_id     = Column(Integer, ForeignKey("apply_agent_sessions.id"), nullable=False)
    field_key      = Column(String,  nullable=False)
    label          = Column(String,  nullable=False)
    field_type     = Column(String,  nullable=False)   # text / email / url / textarea / select
    suggested_value = Column(Text,   nullable=True)
    confidence     = Column(Integer, nullable=False, default=0)
    needs_review   = Column(Boolean, nullable=False, default=True)
    source         = Column(String,  nullable=False, default="none")  # profile/resume/deterministic/ai/none
    reasoning      = Column(Text,    nullable=True)

    # Resolution — set when user accepts / edits / skips
    resolved_status = Column(String,   nullable=True)   # accepted / edited / skipped
    final_value     = Column(Text,     nullable=True)
    resolved_at     = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=_utcnow)

    # Relationships
    session = relationship("ApplyAgentSession", back_populates="suggestions")


# ---------------------------------------------------------------------------
# ApplyAgentActionLog
# ---------------------------------------------------------------------------

class ApplyAgentActionLog(Base):
    __tablename__ = "apply_agent_action_logs"

    id               = Column(Integer, primary_key=True, index=True)
    session_id       = Column(Integer, ForeignKey("apply_agent_sessions.id"), nullable=False)
    field_key        = Column(String,  nullable=False)
    action_type      = Column(String,  nullable=False)  # accepted / edited / skipped / manual_entry
    agent_suggestion = Column(Text,    nullable=True)   # snapshot of suggestion at time of action
    final_value      = Column(Text,    nullable=True)
    logged_at        = Column(DateTime, default=_utcnow)  # no updated_at — row is immutable

    # Relationships
    session = relationship("ApplyAgentSession", back_populates="action_logs")
