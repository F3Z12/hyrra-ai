"""
Apply Agent fill-plan service.

Classifies field suggestions into two buckets:
- fillable:  safe for OpenClaw V2 to auto-fill (high confidence, not flagged, from profile/deterministic)
- blocked:   everything else — requires human review or has no safe value

The typed Pydantic response schemas (ApplyAgentFillPlanField, ApplyAgentBlockedField,
ApplyAgentFillPlanResponse) are imported by both this service and openclaw_task_service
so Commit B's /run-openclaw-fill endpoint can reuse them without re-declaring.
"""

import json

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Response schemas (reused by openclaw_task_service and future endpoints)
# ---------------------------------------------------------------------------

class ApplyAgentFillPlanField(BaseModel):
    """A single field that OpenClaw is permitted to auto-fill."""
    field_key:  str
    label:      str
    selector:   str | None   # CSS selector on the target page; None = locate by data-field-key
    value:      str          # value to type/paste into the field
    confidence: int
    source:     str          # "profile" | "deterministic"


class ApplyAgentBlockedField(BaseModel):
    """A field that OpenClaw must NOT touch."""
    field_key: str
    label:     str
    reason:    str           # human-readable explanation of why it was blocked


class ApplyAgentFillPlanResponse(BaseModel):
    """Full fill plan returned by GET /sessions/{id}/fill-plan."""
    session_id:     int
    target_url:     str | None
    fillable:       list[ApplyAgentFillPlanField]
    blocked:        list[ApplyAgentBlockedField]
    total_fields:   int
    fillable_count: int
    blocked_count:  int


# ---------------------------------------------------------------------------
# Classification logic
# ---------------------------------------------------------------------------

_SAFE_SOURCES = {"profile", "deterministic"}
_CONFIDENCE_THRESHOLD = 80


def build_fill_plan(session, suggestions: list) -> ApplyAgentFillPlanResponse:
    """
    Build a fill plan from an ApplyAgentSession and its field suggestions.

    Reads selectors from the session's form_fields_json snapshot so the caller
    does not need to pass them separately — no localStorage dependency.
    """
    # Build a selector lookup from the JSON snapshot stored at session creation
    selector_map: dict[str, str | None] = {}
    if session.form_fields_json:
        try:
            for f in json.loads(session.form_fields_json):
                selector_map[f["field_key"]] = f.get("selector")
        except (json.JSONDecodeError, TypeError):
            pass  # malformed snapshot — selectors will default to None

    fillable: list[ApplyAgentFillPlanField] = []
    blocked: list[ApplyAgentBlockedField] = []

    for s in suggestions:
        # User explicitly skipped — don't touch
        if s.resolved_status == "skipped":
            blocked.append(ApplyAgentBlockedField(
                field_key=s.field_key,
                label=s.label,
                reason="User skipped this field",
            ))
            continue

        # Determine the best available value
        # Prefer the user's resolved final_value (accepted/edited); fall back to suggestion
        if s.resolved_status in ("accepted", "edited") and s.final_value is not None:
            value = s.final_value
        elif s.suggested_value is not None:
            value = s.suggested_value
        else:
            blocked.append(ApplyAgentBlockedField(
                field_key=s.field_key,
                label=s.label,
                reason="No value available",
            ))
            continue

        # Check all three safety gates
        confidence_ok = s.confidence >= _CONFIDENCE_THRESHOLD
        review_ok = not s.needs_review
        source_ok = s.source in _SAFE_SOURCES

        if confidence_ok and review_ok and source_ok:
            fillable.append(ApplyAgentFillPlanField(
                field_key=s.field_key,
                label=s.label,
                selector=selector_map.get(s.field_key),
                value=value,
                confidence=s.confidence,
                source=s.source,
            ))
        else:
            reasons: list[str] = []
            if not confidence_ok:
                reasons.append(f"confidence {s.confidence}% < {_CONFIDENCE_THRESHOLD}%")
            if not review_ok:
                reasons.append("flagged for human review")
            if not source_ok:
                reasons.append(f"source is '{s.source}' (only profile/deterministic are auto-fillable)")
            blocked.append(ApplyAgentBlockedField(
                field_key=s.field_key,
                label=s.label,
                reason="; ".join(reasons),
            ))

    return ApplyAgentFillPlanResponse(
        session_id=session.id,
        target_url=session.target_url,
        fillable=fillable,
        blocked=blocked,
        total_fields=len(fillable) + len(blocked),
        fillable_count=len(fillable),
        blocked_count=len(blocked),
    )
