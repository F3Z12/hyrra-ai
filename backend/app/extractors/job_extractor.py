"""
Job profile extraction orchestrator.

Coordinates the focused extraction modules to produce a unified job profile.
This is the single entry point that downstream code should call.

Pipeline:
    job_text → metadata_extractor → section_extractor → skill_extractor → keyword_extractor → job profile
"""

from app.extractors.metadata_extractor import extract_metadata
from app.extractors.section_extractor import extract_sections
from app.extractors.skill_extractor import extract_skills
from app.extractors.keyword_extractor import extract_keywords


def extract_job_profile(job_text: str) -> dict:
    """
    Extract a structured job profile from normalized job text.

    Orchestrates all extraction modules and merges their results into
    a single unified response shape. Input-source agnostic.

    Returns:
        {
            "title": str,
            "company": str,
            "location": str,
            "employment_type": str,
            "required_skills": list[str],
            "preferred_skills": list[str],
            "responsibilities": list[str],
            "qualifications": list[str],
            "preferred_qualifications": list[str],
            "keywords": list[str],
            "parse_warnings": list[str]
        }
    """
    # 1. Extract metadata (title, company, location, employment type)
    metadata = extract_metadata(job_text)

    # 2. Extract sections (responsibilities, qualifications, preferred)
    sections = extract_sections(job_text)

    # 3. Extract skills using section zones for required/preferred separation
    skills = extract_skills(
        full_text=job_text,
        required_zone_text=sections["required_zone_text"],
        preferred_zone_text=sections["preferred_zone_text"],
    )

    # 4. Extract keywords
    keywords = extract_keywords(job_text)

    # 5. Merge all warnings
    warnings = metadata["warnings"] + sections["warnings"]

    profile = {
        "title": metadata["title"],
        "company": metadata["company"],
        "location": metadata["location"],
        "employment_type": metadata["employment_type"],
        "required_skills": skills["required_skills"],
        "preferred_skills": skills["preferred_skills"],
        "responsibilities": sections["responsibilities"],
        "qualifications": sections["qualifications"],
        "preferred_qualifications": sections["preferred_qualifications"],
        "keywords": keywords,
        "parse_warnings": warnings,
    }

    for key in (
        "work_mode",
        "work_term",
        "application_deadline",
        "application_method",
        "application_email",
        "job_id",
    ):
        if metadata.get(key):
            profile[key] = metadata[key]

    return profile
