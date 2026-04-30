"""
Match API routes.

Endpoints:
- POST   /v1/matches/score-text     → stateless text matching
- POST   /v1/matches                → database-backed matching
- GET    /v1/matches                → list all match results
- GET    /v1/matches/{match_id}     → get a single match result
- DELETE /v1/matches/{match_id}     → delete a match result
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services.match_service import (
    match_texts,
    create_match_result,
    list_match_results,
    get_match_result,
    delete_match_result,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ScoreTextRequest(BaseModel):
    job_text: str
    resume_text: str


class CreateMatchRequest(BaseModel):
    job_id: int
    resume_id: int


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _safe_json_loads(json_str: str | None) -> list:
    """Safely parse a JSON string to a list, returning empty list on failure."""
    if not json_str:
        return []
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return []


def _match_to_dict(match) -> dict:
    """Convert a MatchResult ORM object to a JSON-friendly dict."""
    return {
        "id": match.id,
        "job_id": match.job_id,
        "resume_id": match.resume_id,
        "match_score": match.match_score,
        "recommendation": match.recommendation,
        "matched_skills": _safe_json_loads(match.matched_skills_json),
        "missing_required_skills": _safe_json_loads(match.missing_required_skills_json),
        "missing_preferred_skills": _safe_json_loads(match.missing_preferred_skills_json),
        "keyword_overlap": _safe_json_loads(match.keyword_overlap_json),
        "reasoning": match.reasoning,
        "suggested_angle": match.suggested_angle,
        "created_at": match.created_at.isoformat() if match.created_at else None,
        "updated_at": match.updated_at.isoformat() if match.updated_at else None,
        # Convenience summaries
        "job_title": match.job.title if match.job else None,
        "job_company": match.job.company if match.job else None,
        "resume_name": match.resume.name if match.resume else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/score-text")
async def score_text_endpoint(request: ScoreTextRequest):
    """
    Score the match between job text and resume text (stateless).

    No data is saved to the database. Returns full profiles and match result.
    """
    if not request.job_text or not request.job_text.strip():
        raise HTTPException(status_code=400, detail="job_text cannot be empty.")
    if not request.resume_text or not request.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text cannot be empty.")

    result = match_texts(request.job_text, request.resume_text)
    return result


@router.post("")
async def create_match_endpoint(request: CreateMatchRequest, db: Session = Depends(get_db)):
    """
    Score and store a match using saved job and resume IDs.
    """
    try:
        match = create_match_result(db, job_id=request.job_id, resume_id=request.resume_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _match_to_dict(match)


@router.get("")
async def list_matches_endpoint(db: Session = Depends(get_db)):
    """List all stored match results."""
    matches = list_match_results(db)
    return {"matches": [_match_to_dict(m) for m in matches]}


@router.get("/{match_id}")
async def get_match_endpoint(match_id: int, db: Session = Depends(get_db)):
    """Get a single match result by ID."""
    match = get_match_result(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match with id {match_id} not found.")
    return _match_to_dict(match)


@router.delete("/{match_id}")
async def delete_match_endpoint(match_id: int, db: Session = Depends(get_db)):
    """Delete a match result by ID."""
    deleted = delete_match_result(db, match_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Match with id {match_id} not found.")
    return {"deleted": True}
