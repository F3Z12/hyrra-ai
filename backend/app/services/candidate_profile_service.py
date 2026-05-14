"""
Candidate Application Profile service.

Manages the single candidate profile used by Apply Agent to source field
suggestions before falling back to resume extraction or AI.

V1 supports one profile per instance. Use PATCH to update it after creation.
"""

from sqlalchemy.orm import Session

from app.database.models import CandidateProfile


def create_candidate_profile(
    db: Session,
    label: str,
    resume_id: int | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    preferred_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    location_city: str | None = None,
    location_region: str | None = None,
    country: str | None = None,
    school: str | None = None,
    program: str | None = None,
    degree: str | None = None,
    graduation_month: int | None = None,
    graduation_year: int | None = None,
    gpa_optional: str | None = None,
    linkedin_url: str | None = None,
    github_url: str | None = None,
    portfolio_url: str | None = None,
    personal_website_url: str | None = None,
    other_links_json: str | None = None,
    work_authorization_country: str | None = None,
    authorized_to_work: str | None = None,
    requires_sponsorship: bool | None = None,
    available_start_date: str | None = None,
    available_end_date: str | None = None,
    preferred_work_location: str | None = None,
    open_to_remote: bool | None = None,
    default_why_interested: str | None = None,
    default_relevant_project: str | None = None,
    default_additional_info: str | None = None,
    default_cover_note: str | None = None,
    top_skills_json: str | None = None,
    top_projects_json: str | None = None,
) -> CandidateProfile:
    """
    Create the candidate profile.

    Raises:
        ValueError: If a profile already exists (V1 allows only one).
    """
    if db.query(CandidateProfile).first():
        raise ValueError(
            "A candidate profile already exists. "
            "Use PATCH /v1/candidate-profile to update it."
        )

    profile = CandidateProfile(
        label=label,
        resume_id=resume_id,
        first_name=first_name,
        last_name=last_name,
        preferred_name=preferred_name,
        email=email,
        phone=phone,
        location_city=location_city,
        location_region=location_region,
        country=country,
        school=school,
        program=program,
        degree=degree,
        graduation_month=graduation_month,
        graduation_year=graduation_year,
        gpa_optional=gpa_optional,
        linkedin_url=linkedin_url,
        github_url=github_url,
        portfolio_url=portfolio_url,
        personal_website_url=personal_website_url,
        other_links_json=other_links_json,
        work_authorization_country=work_authorization_country,
        authorized_to_work=authorized_to_work,
        requires_sponsorship=requires_sponsorship,
        available_start_date=available_start_date,
        available_end_date=available_end_date,
        preferred_work_location=preferred_work_location,
        open_to_remote=open_to_remote,
        default_why_interested=default_why_interested,
        default_relevant_project=default_relevant_project,
        default_additional_info=default_additional_info,
        default_cover_note=default_cover_note,
        top_skills_json=top_skills_json,
        top_projects_json=top_projects_json,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_candidate_profile(db: Session) -> CandidateProfile | None:
    """Return the single candidate profile, or None if it does not exist."""
    return db.query(CandidateProfile).first()


def update_candidate_profile(db: Session, **update_fields) -> CandidateProfile | None:
    """
    Update the candidate profile with only the supplied fields.

    Returns:
        The updated profile, or None if no profile exists.
    """
    profile = db.query(CandidateProfile).first()
    if not profile:
        return None

    for field, value in update_fields.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile
