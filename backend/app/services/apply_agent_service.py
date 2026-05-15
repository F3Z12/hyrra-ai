"""
Apply Agent CRUD service.

Manages sessions, field suggestions, and the immutable action log.
Does not contain suggestion generation logic — see apply_agent_suggestion_service.py.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database.models import (
    ApplyAgentActionLog,
    ApplyAgentFieldSuggestion,
    ApplyAgentSession,
    VALID_APPLY_AGENT_ACTION_TYPES,
    VALID_APPLY_AGENT_RESOLVED_STATUSES,
    VALID_APPLY_AGENT_SESSION_STATUSES,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_apply_agent_session(
    db: Session,
    candidate_profile_id: int,
    job_id: int,
    form_fields_json: str,
    resume_id: int | None = None,
    target_url: str | None = None,
) -> ApplyAgentSession:
    """Create an Apply Agent session. FK validation is done in the router."""
    session = ApplyAgentSession(
        candidate_profile_id=candidate_profile_id,
        job_id=job_id,
        resume_id=resume_id,
        status="created",
        target_url=target_url,
        form_fields_json=form_fields_json,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_apply_agent_session(db: Session, session_id: int) -> ApplyAgentSession | None:
    """Return a session by ID, or None if not found."""
    return db.query(ApplyAgentSession).filter(ApplyAgentSession.id == session_id).first()


def update_apply_agent_session_status(
    db: Session,
    session_id: int,
    status: str,
) -> ApplyAgentSession | None:
    """
    Update session status.

    Returns None if the session does not exist.
    Raises ValueError for invalid status values.
    """
    if status not in VALID_APPLY_AGENT_SESSION_STATUSES:
        raise ValueError(
            f"Invalid status '{status}'. Must be one of: "
            f"{', '.join(sorted(VALID_APPLY_AGENT_SESSION_STATUSES))}"
        )
    session = get_apply_agent_session(db, session_id)
    if not session:
        return None

    session.status = status
    db.commit()
    db.refresh(session)
    return session


# ---------------------------------------------------------------------------
# Field suggestions
# ---------------------------------------------------------------------------

def save_field_suggestions(
    db: Session,
    session_id: int,
    suggestions: list[dict],
) -> list[ApplyAgentFieldSuggestion]:
    """Bulk-insert field suggestions for a session. Commits once for all rows."""
    created = []
    for s in suggestions:
        row = ApplyAgentFieldSuggestion(
            session_id=session_id,
            field_key=s["field_key"],
            label=s["label"],
            field_type=s["field_type"],
            suggested_value=s.get("suggested_value"),
            confidence=s.get("confidence", 0),
            needs_review=s.get("needs_review", True),
            source=s.get("source", "none"),
            reasoning=s.get("reasoning"),
        )
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return created


def get_field_suggestions(
    db: Session,
    session_id: int,
) -> list[ApplyAgentFieldSuggestion]:
    """Return all field suggestions for a session, preserving insertion order."""
    return (
        db.query(ApplyAgentFieldSuggestion)
        .filter(ApplyAgentFieldSuggestion.session_id == session_id)
        .order_by(ApplyAgentFieldSuggestion.id)
        .all()
    )


def resolve_field_suggestion(
    db: Session,
    session_id: int,
    field_key: str,
    resolved_status: str,
    final_value: str | None,
) -> ApplyAgentFieldSuggestion | None:
    """
    Mark a field suggestion as resolved.

    Returns None if the session/field combination is not found.
    Raises ValueError for invalid resolved_status values.
    """
    if resolved_status not in VALID_APPLY_AGENT_RESOLVED_STATUSES:
        raise ValueError(
            f"Invalid resolved_status '{resolved_status}'. Must be one of: "
            f"{', '.join(sorted(VALID_APPLY_AGENT_RESOLVED_STATUSES))}"
        )
    suggestion = (
        db.query(ApplyAgentFieldSuggestion)
        .filter(
            ApplyAgentFieldSuggestion.session_id == session_id,
            ApplyAgentFieldSuggestion.field_key == field_key,
        )
        .first()
    )
    if not suggestion:
        return None

    suggestion.resolved_status = resolved_status
    suggestion.final_value      = final_value
    suggestion.resolved_at      = _utcnow()
    db.commit()
    db.refresh(suggestion)
    return suggestion


# ---------------------------------------------------------------------------
# Action log  (immutable — rows are never updated or deleted)
# ---------------------------------------------------------------------------

def log_apply_agent_action(
    db: Session,
    session_id: int,
    field_key: str,
    action_type: str,
    agent_suggestion: str | None = None,
    final_value: str | None = None,
) -> ApplyAgentActionLog:
    """
    Create an immutable action log entry.

    Raises ValueError for invalid action_type values.
    """
    if action_type not in VALID_APPLY_AGENT_ACTION_TYPES:
        raise ValueError(
            f"Invalid action_type '{action_type}'. Must be one of: "
            f"{', '.join(sorted(VALID_APPLY_AGENT_ACTION_TYPES))}"
        )
    log = ApplyAgentActionLog(
        session_id=session_id,
        field_key=field_key,
        action_type=action_type,
        agent_suggestion=agent_suggestion,
        final_value=final_value,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_apply_agent_action_log(
    db: Session,
    session_id: int,
) -> list[ApplyAgentActionLog]:
    """Return all action log entries for a session in chronological order."""
    return (
        db.query(ApplyAgentActionLog)
        .filter(ApplyAgentActionLog.session_id == session_id)
        .order_by(ApplyAgentActionLog.logged_at)
        .all()
    )
