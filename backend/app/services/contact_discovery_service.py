"""Contact discovery orchestration service.

This stage supports only a mock provider. It does not call external contact
APIs, scrape sites, send messages, or store API keys.
"""

import json
import re

from sqlalchemy.orm import Session

from app.database.models import Job, OutreachContact
from app.extractors.job_extractor import extract_job_profile
from app.parsers.text_parser import normalize_text
from app.services.contact_providers import MockContactProvider
from app.services.outreach_service import create_contact


class ContactDiscoveryError(ValueError):
    """Base error for contact discovery failures."""


class UnsupportedContactProviderError(ContactDiscoveryError):
    """Raised when a requested provider is not available."""


class ContactDiscoveryJobNotFoundError(ContactDiscoveryError):
    """Raised when discovery is requested for a missing job."""


def discover_contacts_for_job(
    db: Session,
    job_id: int,
    provider: str = "mock",
    max_results: int = 8,
    target_titles: list[str] | None = None,
) -> dict:
    """Discover ranked likely outreach contacts for a saved job."""
    if provider != "mock":
        raise UnsupportedContactProviderError("Provider not supported yet.")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ContactDiscoveryJobNotFoundError(f"Job with id {job_id} not found.")

    max_results = _clamp_max_results(max_results)
    job_profile = _load_job_profile(job)
    role_title = job.title or job_profile.get("title") or "Open Role"
    company = _resolve_company(job, job_profile, role_title)

    provider_impl = MockContactProvider()
    contacts = provider_impl.search(
        company=company,
        role_title=role_title,
        location=job.location or job_profile.get("location") or "",
        employment_type=job.employment_type or job_profile.get("employment_type") or "",
        job_profile=job_profile,
        max_results=max_results,
        target_titles=target_titles,
    )

    return {
        "job_id": job.id,
        "provider": provider_impl.provider_name,
        "company": company,
        "role_title": role_title,
        "contacts": contacts,
    }


def save_discovered_contact(
    db: Session,
    job_id: int,
    contact: dict,
) -> OutreachContact:
    """Save a selected discovered contact as an OutreachContact."""
    source = contact.get("source") or "mock"
    if source != "mock":
        raise UnsupportedContactProviderError("Provider not supported yet.")

    return create_contact(
        db,
        job_id=job_id,
        name=contact.get("name") or "",
        title=contact.get("title"),
        company=contact.get("company"),
        email=_safe_email(contact.get("email")),
        linkedin_url=contact.get("linkedin_url"),
        source=source,
        confidence_score=contact.get("confidence_score"),
        notes=contact.get("notes"),
    )


def _load_job_profile(job: Job) -> dict:
    if job.parsed_profile_json:
        try:
            return json.loads(job.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return extract_job_profile(normalize_text(job.raw_text))


def _clamp_max_results(max_results: int | None) -> int:
    try:
        value = int(max_results or 8)
    except (TypeError, ValueError):
        value = 8
    return max(1, min(value, 20))


def _resolve_company(job: Job, job_profile: dict, role_title: str) -> str:
    """Resolve the best company name without falling back to mock names."""
    for candidate in (job.company, job_profile.get("company")):
        company = _clean_company(candidate)
        if company:
            return company

    inferred = _infer_company_from_title(role_title)
    if inferred:
        return inferred

    return "Unknown Company"


def _clean_company(value: str | None) -> str | None:
    if value is None:
        return None
    company = str(value).strip()
    if not company:
        return None

    generic_values = {
        "company",
        "example company",
        "unknown",
        "unknown company",
        "n/a",
        "na",
        "none",
        "not specified",
    }
    if company.lower() in generic_values:
        return None
    return company


def _infer_company_from_title(role_title: str | None) -> str | None:
    if not role_title:
        return None

    title = str(role_title).strip()
    if not title:
        return None

    match = re.match(r"^(.+?)\s+-\s+(.+)$", title)
    if not match:
        return None

    company = _clean_company(match.group(1))
    role = match.group(2).strip()
    if not company or not role:
        return None

    return company


def _safe_email(email: str | None) -> str | None:
    if not email:
        return None
    email = email.strip()
    if email.endswith("@example.com") or email.endswith("@no-email.example.com"):
        return email
    return None
