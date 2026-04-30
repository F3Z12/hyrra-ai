"""
Resume storage service.

Handles CRUD operations for resumes in the database.
Extracts and caches resume profiles on creation.
"""

import json

from sqlalchemy.orm import Session

from app.database.models import Resume
from app.parsers.text_parser import normalize_text
from app.extractors.resume_extractor import extract_resume_profile


def create_resume(db: Session, name: str, raw_text: str) -> Resume:
    """Create and store a new resume, extracting profile immediately."""
    normalized = normalize_text(raw_text)
    profile = extract_resume_profile(normalized)

    resume = Resume(
        name=name,
        raw_text=raw_text,
        parsed_profile_json=json.dumps(profile),
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def list_resumes(db: Session) -> list[Resume]:
    """Return all stored resumes, newest first."""
    return db.query(Resume).order_by(Resume.created_at.desc()).all()


def get_resume(db: Session, resume_id: int) -> Resume | None:
    """Get a single resume by ID, or None if not found."""
    return db.query(Resume).filter(Resume.id == resume_id).first()


def delete_resume(db: Session, resume_id: int) -> bool:
    """Delete a resume by ID. Returns True if deleted, False if not found."""
    resume = get_resume(db, resume_id)
    if not resume:
        return False
    db.delete(resume)
    db.commit()
    return True
