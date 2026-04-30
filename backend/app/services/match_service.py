"""
Match service — stateless and database-backed matching.

Coordinates resume extraction, job profile loading, and match scoring.
"""

import json

from sqlalchemy.orm import Session

from app.parsers.text_parser import normalize_text
from app.extractors.job_extractor import extract_job_profile
from app.extractors.resume_extractor import extract_resume_profile
from app.matching.scorer import score_job_resume_match
from app.database.models import Job, Resume, MatchResult


# ---------------------------------------------------------------------------
# Stateless matching
# ---------------------------------------------------------------------------

def match_texts(job_text: str, resume_text: str) -> dict:
    """
    Match job text against resume text without database involvement.

    Normalizes both texts, extracts profiles, and scores the match.

    Returns:
        {
            "job_profile": dict,
            "resume_profile": dict,
            "match_result": dict
        }
    """
    norm_job = normalize_text(job_text)
    norm_resume = normalize_text(resume_text)

    job_profile = extract_job_profile(norm_job)
    resume_profile = extract_resume_profile(norm_resume)
    match_result = score_job_resume_match(job_profile, resume_profile)

    return {
        "job_profile": job_profile,
        "resume_profile": resume_profile,
        "match_result": match_result,
    }


# ---------------------------------------------------------------------------
# Database-backed matching
# ---------------------------------------------------------------------------

def _load_job_profile(job: Job) -> dict:
    """Load job profile from stored JSON, or re-extract from raw text."""
    if job.parsed_profile_json:
        try:
            return json.loads(job.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    # Fallback: re-extract
    return extract_job_profile(normalize_text(job.raw_text))


def _load_resume_profile(resume: Resume, db: Session) -> dict:
    """Load resume profile from stored JSON, or extract and cache it."""
    if resume.parsed_profile_json:
        try:
            return json.loads(resume.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass

    # Extract and cache
    profile = extract_resume_profile(normalize_text(resume.raw_text))
    resume.parsed_profile_json = json.dumps(profile)
    db.commit()
    db.refresh(resume)
    return profile


def create_match_result(db: Session, job_id: int, resume_id: int) -> MatchResult:
    """
    Score a saved job against a saved resume and store the result.

    Validates that both job and resume exist. Loads or extracts their
    profiles, scores the match, and stores a MatchResult row.

    Raises:
        ValueError: If job or resume not found.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with id {job_id} not found.")

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise ValueError(f"Resume with id {resume_id} not found.")

    job_profile = _load_job_profile(job)
    resume_profile = _load_resume_profile(resume, db)
    result = score_job_resume_match(job_profile, resume_profile)

    match = MatchResult(
        job_id=job_id,
        resume_id=resume_id,
        match_score=result["match_score"],
        recommendation=result["recommendation"],
        matched_skills_json=json.dumps(result["matched_skills"]),
        missing_required_skills_json=json.dumps(result["missing_required_skills"]),
        missing_preferred_skills_json=json.dumps(result["missing_preferred_skills"]),
        keyword_overlap_json=json.dumps(result["keyword_overlap"]),
        reasoning=result["reasoning"],
        suggested_angle=result["suggested_angle"],
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


def list_match_results(db: Session) -> list[MatchResult]:
    """Return all stored match results, newest first."""
    return db.query(MatchResult).order_by(MatchResult.created_at.desc()).all()


def get_match_result(db: Session, match_id: int) -> MatchResult | None:
    """Get a single match result by ID, or None if not found."""
    return db.query(MatchResult).filter(MatchResult.id == match_id).first()


def delete_match_result(db: Session, match_id: int) -> bool:
    """Delete a match result by ID. Returns True if deleted, False if not found."""
    match = get_match_result(db, match_id)
    if not match:
        return False
    db.delete(match)
    db.commit()
    return True
