"""
Job storage service.

Handles storing analyzed jobs in the database.
Uses the V2 analysis pipeline to extract and store parsed profiles.
"""

import json

from sqlalchemy.orm import Session

from app.database.models import Application, Job, MatchResult
from app.parsers.text_parser import normalize_text
from app.extractors.job_extractor import extract_job_profile


def create_job_from_text(
    db: Session,
    job_text: str,
    source_type: str = "text",
    source_label: str = "",
) -> Job:
    """
    Analyze job text, extract profile, and store in database.

    The raw text is normalized and analyzed through the extraction pipeline.
    Both the raw text and parsed profile JSON are stored.
    """
    normalized = normalize_text(job_text)
    profile = extract_job_profile(normalized)

    job = Job(
        title=profile["title"],
        company=profile["company"],
        location=profile["location"],
        employment_type=profile["employment_type"],
        source_type=source_type,
        source_label=source_label or None,
        raw_text=normalized,
        parsed_profile_json=json.dumps(profile),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_jobs(db: Session) -> list[Job]:
    """Return all stored jobs, newest first."""
    return db.query(Job).order_by(Job.created_at.desc()).all()


def get_job(db: Session, job_id: int) -> Job | None:
    """Get a single job by ID, or None if not found."""
    return db.query(Job).filter(Job.id == job_id).first()


def delete_job(db: Session, job_id: int) -> bool:
    """Delete a job by ID. Returns True if deleted, False if not found."""
    job = get_job(db, job_id)
    if not job:
        return False

    db.query(MatchResult).filter(MatchResult.job_id == job_id).delete(synchronize_session=False)
    db.query(Application).filter(Application.job_id == job_id).delete(synchronize_session=False)
    db.delete(job)
    db.commit()
    return True
