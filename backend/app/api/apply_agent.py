"""
Apply Agent API routes.

Endpoints:
- POST   /v1/apply-agent/sessions                                   → create session + suggestions
- GET    /v1/apply-agent/sessions/{session_id}                      → get session with suggestions
- PATCH  /v1/apply-agent/sessions/{session_id}                      → update session status
- PATCH  /v1/apply-agent/sessions/{session_id}/suggestions/{field_key} → resolve a field
- POST   /v1/apply-agent/sessions/{session_id}/actions              → log a user action
- GET    /v1/apply-agent/sessions/{session_id}/log                  → get full action log
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import (
    CandidateProfile,
    Job,
    Resume,
    VALID_APPLY_AGENT_SESSION_STATUSES,
    VALID_APPLY_AGENT_ACTION_TYPES,
    VALID_APPLY_AGENT_RESOLVED_STATUSES,
)
from app.services.apply_agent_service import (
    create_apply_agent_session,
    get_apply_agent_session,
    update_apply_agent_session_status,
    save_field_suggestions,
    get_field_suggestions,
    resolve_field_suggestion,
    log_apply_agent_action,
    get_apply_agent_action_log,
)
from app.services.apply_agent_suggestion_service import generate_all_suggestions

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class FormFieldInput(BaseModel):
    field_key:  str
    label:      str
    field_type: str


class CreateApplyAgentSessionRequest(BaseModel):
    candidate_profile_id: int
    job_id:               int
    resume_id:            int | None    = None
    api_key:              str | None    = None
    form_fields:          list[FormFieldInput]


class ResolveFieldSuggestionRequest(BaseModel):
    resolved_status: str          # accepted / edited / skipped
    final_value:     str | None = None


class LogActionRequest(BaseModel):
    field_key:        str
    action_type:      str           # accepted / edited / skipped / manual_entry
    agent_suggestion: str | None = None
    final_value:      str | None = None


class UpdateSessionStatusRequest(BaseModel):
    status: str                     # created / in_progress / completed / abandoned


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _suggestion_to_dict(s) -> dict:
    return {
        "id":               s.id,
        "session_id":       s.session_id,
        "field_key":        s.field_key,
        "label":            s.label,
        "field_type":       s.field_type,
        "suggested_value":  s.suggested_value,
        "confidence":       s.confidence,
        "needs_review":     s.needs_review,
        "source":           s.source,
        "reasoning":        s.reasoning,
        "resolved_status":  s.resolved_status,
        "final_value":      s.final_value,
        "resolved_at":      s.resolved_at.isoformat() if s.resolved_at else None,
        "created_at":       s.created_at.isoformat()  if s.created_at  else None,
    }


def _session_to_dict(session, suggestions: list) -> dict:
    return {
        "session_id":            session.id,
        "candidate_profile_id":  session.candidate_profile_id,
        "job_id":                session.job_id,
        "resume_id":             session.resume_id,
        "status":                session.status,
        # Denormalised for frontend convenience
        "job_title":     session.job.title             if session.job               else None,
        "job_company":   session.job.company           if session.job               else None,
        "profile_label": session.candidate_profile.label if session.candidate_profile else None,
        "resume_name":   session.resume.name           if session.resume            else None,
        "suggestions":   [_suggestion_to_dict(s) for s in suggestions],
        "created_at":    session.created_at.isoformat() if session.created_at else None,
        "updated_at":    session.updated_at.isoformat() if session.updated_at else None,
    }


def _action_log_to_dict(log) -> dict:
    return {
        "action_id":       log.id,
        "session_id":      log.session_id,
        "field_key":       log.field_key,
        "action_type":     log.action_type,
        "agent_suggestion": log.agent_suggestion,
        "final_value":     log.final_value,
        "logged_at":       log.logged_at.isoformat() if log.logged_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/sessions")
async def create_session_endpoint(
    request: CreateApplyAgentSessionRequest,
    db: Session = Depends(get_db),
):
    """
    Create an Apply Agent session and generate field suggestions.

    Suggestions are generated immediately using the priority cascade:
    profile → resume → deterministic → AI (BYOK, optional).
    """
    # Validate FKs
    profile = db.query(CandidateProfile).filter(
        CandidateProfile.id == request.candidate_profile_id
    ).first()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"Candidate profile {request.candidate_profile_id} not found.",
        )

    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {request.job_id} not found.")

    resume = None
    if request.resume_id is not None:
        resume = db.query(Resume).filter(Resume.id == request.resume_id).first()
        if not resume:
            raise HTTPException(
                status_code=404, detail=f"Resume {request.resume_id} not found."
            )

    if not request.form_fields:
        raise HTTPException(status_code=400, detail="form_fields must not be empty.")

    # Create session
    form_fields_list = [f.model_dump() for f in request.form_fields]
    session = create_apply_agent_session(
        db,
        candidate_profile_id=request.candidate_profile_id,
        job_id=request.job_id,
        resume_id=request.resume_id,
        form_fields_json=json.dumps(form_fields_list),
    )

    # Generate suggestions (AI failures are silently absorbed — session is still created)
    suggestions_data = generate_all_suggestions(
        form_fields=form_fields_list,
        profile=profile,
        job=job,
        resume=resume,
        api_key=request.api_key,
    )

    # Persist suggestions
    save_field_suggestions(db, session.id, suggestions_data)

    suggestions = get_field_suggestions(db, session.id)
    return _session_to_dict(session, suggestions)


@router.get("/sessions/{session_id}")
async def get_session_endpoint(session_id: int, db: Session = Depends(get_db)):
    """Return a session with all its field suggestions."""
    session = get_apply_agent_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    suggestions = get_field_suggestions(db, session_id)
    return _session_to_dict(session, suggestions)


@router.patch("/sessions/{session_id}/suggestions/{field_key}")
async def resolve_field_endpoint(
    session_id: int,
    field_key:  str,
    request:    ResolveFieldSuggestionRequest,
    db: Session = Depends(get_db),
):
    """
    Resolve a field suggestion (accept / edit / skip).

    Also call POST /sessions/{id}/actions to create the immutable audit log entry.
    """
    session = get_apply_agent_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    try:
        suggestion = resolve_field_suggestion(
            db,
            session_id=session_id,
            field_key=field_key,
            resolved_status=request.resolved_status,
            final_value=request.final_value,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not suggestion:
        raise HTTPException(
            status_code=404,
            detail=f"Field '{field_key}' not found in session {session_id}.",
        )
    return _suggestion_to_dict(suggestion)


@router.post("/sessions/{session_id}/actions")
async def log_action_endpoint(
    session_id: int,
    request:    LogActionRequest,
    db: Session = Depends(get_db),
):
    """
    Create an immutable action log entry for a field decision.

    Call this alongside PATCH /suggestions/{field_key} for every Accept/Edit/Skip.
    """
    session = get_apply_agent_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    try:
        log = log_apply_agent_action(
            db,
            session_id=session_id,
            field_key=request.field_key,
            action_type=request.action_type,
            agent_suggestion=request.agent_suggestion,
            final_value=request.final_value,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _action_log_to_dict(log)


@router.get("/sessions/{session_id}/log")
async def get_action_log_endpoint(session_id: int, db: Session = Depends(get_db)):
    """Return all action log entries for a session in chronological order."""
    session = get_apply_agent_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    logs = get_apply_agent_action_log(db, session_id)
    return {
        "session_id": session_id,
        "actions": [_action_log_to_dict(log) for log in logs],
    }


@router.patch("/sessions/{session_id}")
async def update_session_status_endpoint(
    session_id: int,
    request:    UpdateSessionStatusRequest,
    db: Session = Depends(get_db),
):
    """Update session status (e.g. mark as completed or abandoned)."""
    try:
        session = update_apply_agent_session_status(db, session_id, request.status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    suggestions = get_field_suggestions(db, session_id)
    return _session_to_dict(session, suggestions)
