"""
Candidate Application Profile API routes.

Endpoints:
- POST  /v1/candidate-profile   → create the profile (V1: one profile only)
- GET   /v1/candidate-profile   → get the profile
- PATCH /v1/candidate-profile   → update any subset of profile fields
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services.candidate_profile_service import (
    create_candidate_profile,
    get_candidate_profile,
    update_candidate_profile,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CreateCandidateProfileRequest(BaseModel):
    # label is the only required field
    label: str

    # Optional link to a stored resume
    resume_id: int | None = None

    # Identity
    first_name: str | None = None
    last_name: str | None = None
    preferred_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location_city: str | None = None
    location_region: str | None = None
    country: str | None = None

    # Education
    school: str | None = None
    program: str | None = None
    degree: str | None = None
    graduation_month: int | None = Field(default=None, ge=1, le=12)
    graduation_year: int | None = Field(default=None, ge=1900, le=2100)
    gpa_optional: str | None = None

    # Links
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    personal_website_url: str | None = None
    other_links_json: str | None = None

    # Work authorization / availability
    work_authorization_country: str | None = None
    authorized_to_work: str | None = None
    requires_sponsorship: bool | None = None
    available_start_date: str | None = None
    available_end_date: str | None = None
    preferred_work_location: str | None = None
    open_to_remote: bool | None = None

    # Reusable application answer context
    default_why_interested: str | None = None
    default_relevant_project: str | None = None
    default_additional_info: str | None = None
    default_cover_note: str | None = None

    # Technical highlights
    top_skills_json: str | None = None
    top_projects_json: str | None = None


class UpdateCandidateProfileRequest(BaseModel):
    # All fields optional — only supplied fields are written
    label: str | None = None
    resume_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    preferred_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location_city: str | None = None
    location_region: str | None = None
    country: str | None = None
    school: str | None = None
    program: str | None = None
    degree: str | None = None
    graduation_month: int | None = Field(default=None, ge=1, le=12)
    graduation_year: int | None = Field(default=None, ge=1900, le=2100)
    gpa_optional: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    personal_website_url: str | None = None
    other_links_json: str | None = None
    work_authorization_country: str | None = None
    authorized_to_work: str | None = None
    requires_sponsorship: bool | None = None
    available_start_date: str | None = None
    available_end_date: str | None = None
    preferred_work_location: str | None = None
    open_to_remote: bool | None = None
    default_why_interested: str | None = None
    default_relevant_project: str | None = None
    default_additional_info: str | None = None
    default_cover_note: str | None = None
    top_skills_json: str | None = None
    top_projects_json: str | None = None


# ---------------------------------------------------------------------------
# Response helper
# ---------------------------------------------------------------------------

def _profile_to_dict(profile) -> dict:
    """Convert a CandidateProfile ORM object to a JSON-friendly dict."""
    return {
        "id": profile.id,
        "label": profile.label,
        "resume_id": profile.resume_id,
        # Identity
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "preferred_name": profile.preferred_name,
        "email": profile.email,
        "phone": profile.phone,
        "location_city": profile.location_city,
        "location_region": profile.location_region,
        "country": profile.country,
        # Education
        "school": profile.school,
        "program": profile.program,
        "degree": profile.degree,
        "graduation_month": profile.graduation_month,
        "graduation_year": profile.graduation_year,
        "gpa_optional": profile.gpa_optional,
        # Links
        "linkedin_url": profile.linkedin_url,
        "github_url": profile.github_url,
        "portfolio_url": profile.portfolio_url,
        "personal_website_url": profile.personal_website_url,
        "other_links_json": profile.other_links_json,
        # Work authorization / availability
        "work_authorization_country": profile.work_authorization_country,
        "authorized_to_work": profile.authorized_to_work,
        "requires_sponsorship": profile.requires_sponsorship,
        "available_start_date": profile.available_start_date,
        "available_end_date": profile.available_end_date,
        "preferred_work_location": profile.preferred_work_location,
        "open_to_remote": profile.open_to_remote,
        # Reusable answers
        "default_why_interested": profile.default_why_interested,
        "default_relevant_project": profile.default_relevant_project,
        "default_additional_info": profile.default_additional_info,
        "default_cover_note": profile.default_cover_note,
        # Technical highlights
        "top_skills_json": profile.top_skills_json,
        "top_projects_json": profile.top_projects_json,
        # Timestamps
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("")
async def create_candidate_profile_endpoint(
    request: CreateCandidateProfileRequest,
    db: Session = Depends(get_db),
):
    """Create the candidate profile. V1 supports only one profile."""
    fields = request.model_dump(exclude_none=True)
    try:
        profile = create_candidate_profile(db, **fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _profile_to_dict(profile)


@router.get("")
async def get_candidate_profile_endpoint(db: Session = Depends(get_db)):
    """Return the candidate profile, or 404 if none exists."""
    profile = get_candidate_profile(db)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No candidate profile found. Create one with POST /v1/candidate-profile.",
        )
    return _profile_to_dict(profile)


@router.patch("")
async def update_candidate_profile_endpoint(
    request: UpdateCandidateProfileRequest,
    db: Session = Depends(get_db),
):
    """Update any subset of profile fields. Unspecified fields are not changed."""
    update_fields = request.model_dump(exclude_none=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    profile = update_candidate_profile(db, **update_fields)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No candidate profile found. Create one with POST /v1/candidate-profile.",
        )
    return _profile_to_dict(profile)
