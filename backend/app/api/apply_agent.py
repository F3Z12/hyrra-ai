"""
Apply Agent API routes.

Endpoints:
- POST   /v1/apply-agent/sessions                                           → create session + suggestions
- GET    /v1/apply-agent/sessions/{session_id}                              → get session with suggestions
- PATCH  /v1/apply-agent/sessions/{session_id}                              → update session status
- PATCH  /v1/apply-agent/sessions/{session_id}/suggestions/{field_key}      → resolve a field
- POST   /v1/apply-agent/sessions/{session_id}/actions                      → log a user action
- GET    /v1/apply-agent/sessions/{session_id}/log                          → get full action log
- GET    /v1/apply-agent/sessions/{session_id}/fill-plan                    → OpenClaw V2 fill plan
- POST   /v1/apply-agent/sessions/{session_id}/run-openclaw-fill            → trigger local OpenClaw run (dev only)
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import ENABLE_LOCAL_OPENCLAW_RUNNER, OPENCLAW_MAX_TIMEOUT
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
from app.services.apply_agent_fill_plan_service import build_fill_plan
from app.services.openclaw_runner_service import run_openclaw_fill
from app.services.openclaw_task_service import generate_openclaw_prompt

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class FormFieldInput(BaseModel):
    field_key:  str
    label:      str
    field_type: str
    selector:   str | None = None   # CSS selector on the target page (used by OpenClaw V2)


class CreateApplyAgentSessionRequest(BaseModel):
    candidate_profile_id: int
    job_id:               int
    resume_id:            int | None    = None
    api_key:              str | None    = None
    target_url:           str | None    = None   # URL of the external application page
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


class RunOpenClawFillRequest(BaseModel):
    timeout_seconds: int | None = None   # if omitted, OPENCLAW_MAX_TIMEOUT is used


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
        "target_url":            session.target_url,
        # Denormalised for frontend convenience
        "job_title":     session.job.title               if session.job               else None,
        "job_company":   session.job.company             if session.job               else None,
        "profile_label": session.candidate_profile.label if session.candidate_profile else None,
        "resume_name":   session.resume.name             if session.resume            else None,
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
        target_url=request.target_url,
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


@router.get("/sessions/{session_id}/fill-plan")
async def get_fill_plan_endpoint(session_id: int, db: Session = Depends(get_db)):
    """
    Return the OpenClaw V2 fill plan for a session.

    Classifies each field suggestion into 'fillable' (safe for OpenClaw auto-fill)
    or 'blocked' (requires human review or has no safe value).

    Fillable criteria (all must be met):
    - confidence >= 80
    - needs_review == False
    - source in ("profile", "deterministic")
    - a non-null value exists (final_value if resolved, otherwise suggested_value)
    - resolved_status is not "skipped"
    """
    session = get_apply_agent_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    suggestions = get_field_suggestions(db, session_id)
    plan = build_fill_plan(session, suggestions)
    result = plan.model_dump()
    # Include the generated task prompt so callers can copy it for debug/fallback use
    result["openclaw_prompt"] = generate_openclaw_prompt(plan)
    return result


# ---------------------------------------------------------------------------
# OpenClaw runner  (dev/local only — guarded by ENABLE_LOCAL_OPENCLAW_RUNNER)
# ---------------------------------------------------------------------------

_RUNNER_MIN_TIMEOUT = 30   # floor: never pass less than 30s to OpenClaw


@router.post("/sessions/{session_id}/run-openclaw-fill")
async def run_openclaw_fill_endpoint(
    session_id: int,
    request:    RunOpenClawFillRequest,
    db: Session = Depends(get_db),
):
    """
    Trigger a local OpenClaw subprocess to auto-fill the application form.

    Dev/local only — requires ENABLE_LOCAL_OPENCLAW_RUNNER=true in .env.

    The backend generates the OpenClaw prompt entirely from the session's trusted
    fill plan; no prompt or command text is accepted from the caller.

    Prerequisites:
    - OpenClaw gateway running         (openclaw gateway start)
    - OpenClaw managed browser started (openclaw browser start)
    - Private-network access enabled:
        openclaw config set browser.ssrfPolicy.dangerouslyAllowPrivateNetwork true --strict-json
    - ENABLE_LOCAL_OPENCLAW_RUNNER=true in .env
    """
    if not ENABLE_LOCAL_OPENCLAW_RUNNER:
        raise HTTPException(
            status_code=403,
            detail=(
                "Local OpenClaw runner is disabled. "
                "Set ENABLE_LOCAL_OPENCLAW_RUNNER=true in .env and restart the backend."
            ),
        )

    session = get_apply_agent_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    # Clamp timeout: [_RUNNER_MIN_TIMEOUT, OPENCLAW_MAX_TIMEOUT]
    raw = request.timeout_seconds if request.timeout_seconds is not None else OPENCLAW_MAX_TIMEOUT
    timeout = max(_RUNNER_MIN_TIMEOUT, min(raw, OPENCLAW_MAX_TIMEOUT))

    suggestions = get_field_suggestions(db, session_id)
    plan = build_fill_plan(session, suggestions)
    result = run_openclaw_fill(plan, timeout)

    # --- Post-run action logging (best-effort) ---
    # Parse structured JSON output from OpenClaw and write immutable audit entries.
    # Failures here must NOT affect the API response — the run result is returned regardless.
    if result.openclaw_json and isinstance(result.openclaw_json, dict):
        oc = result.openclaw_json
        try:
            for entry in oc.get("filled") or []:
                fk = entry.get("field_key") or ""
                if not fk:
                    continue
                log_apply_agent_action(
                    db,
                    session_id=session_id,
                    field_key=fk,
                    action_type="agent_filled",
                    agent_suggestion=None,
                    final_value=entry.get("value_entered"),
                )
        except Exception:
            pass  # logging failure must not surface to the caller

        try:
            for entry in oc.get("failed") or []:
                fk = entry.get("field_key") or ""
                if not fk or fk == "__page_verification__":
                    continue
                log_apply_agent_action(
                    db,
                    session_id=session_id,
                    field_key=fk,
                    action_type="agent_failed",
                    agent_suggestion=entry.get("error"),
                    final_value=None,
                )
        except Exception:
            pass

    return {
        "session_id":          session_id,
        "status":              result.status,
        "duration_ms":         result.duration_ms,
        "command":             result.command,
        "openclaw_json":       result.openclaw_json,
        "final_text":          result.final_text,
        "stdout":              result.stdout,
        "stderr":              result.stderr,
        "error":               result.error,
        # Debug fields — safe to expose; prompt itself is never returned
        "prompt_length":         result.prompt_length,
        "prompt_preview":        result.prompt_preview,
        "resolved_command":      result.resolved_command,
        "argv_without_prompt":   result.argv_without_prompt,
        "timeout_used":          result.timeout_used,
        "codex_bin_configured":  result.codex_bin_configured,
    }
