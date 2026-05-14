"""
Manual outreach CRM API routes.

Provides database-backed CRUD for outreach contacts and messages,
plus AI-assisted draft generation. No contact discovery, scraping,
or sending occurs here.
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import (
    Job,
    MatchResult,
    OutreachMessage,
    Resume,
    VALID_OUTREACH_MESSAGE_TYPES,
)
from app.extractors.job_extractor import extract_job_profile
from app.extractors.resume_extractor import extract_resume_profile
from app.parsers.text_parser import normalize_text
from app.services.contact_discovery_service import (
    ContactDiscoveryJobNotFoundError,
    UnsupportedContactProviderError,
    discover_contacts_for_job,
    save_discovered_contact,
)
from app.services.outreach_ai_service import generate_outreach_message
from app.services.outreach_service import (
    create_contact,
    create_message,
    delete_contact,
    delete_message,
    get_contact,
    get_message,
    list_contacts_for_job,
    list_messages_for_contact,
    list_messages_for_job,
    update_contact,
    update_message,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CreateContactRequest(BaseModel):
    job_id: int
    name: str
    title: str | None = None
    company: str | None = None
    email: str | None = None
    linkedin_url: str | None = None
    source: str | None = None
    confidence_score: int | None = None
    notes: str | None = None


class UpdateContactRequest(BaseModel):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    email: str | None = None
    linkedin_url: str | None = None
    source: str | None = None
    confidence_score: int | None = None
    notes: str | None = None


class CreateMessageRequest(BaseModel):
    job_id: int
    contact_id: int | None = None
    message_type: str = "email"
    subject: str | None = None
    body: str
    status: str = "draft"
    follow_up_date: datetime | None = None
    sent_at: datetime | None = None


class UpdateMessageRequest(BaseModel):
    contact_id: int | None = None
    message_type: str | None = None
    subject: str | None = None
    body: str | None = None
    status: str | None = None
    follow_up_date: datetime | None = None
    sent_at: datetime | None = None


class GenerateOutreachMessageRequest(BaseModel):
    job_id: int
    contact_id: int | None = None
    resume_id: int | None = None
    match_id: int | None = None
    message_type: str
    api_key: str = ""
    save_as_draft: bool = True
    extra_context: str | None = None


class DiscoverContactsRequest(BaseModel):
    job_id: int
    provider: str = "mock"
    max_results: int = 8
    target_titles: list[str] | None = None
    save_selected: bool = False


class DiscoveredContactPayload(BaseModel):
    name: str
    title: str | None = None
    company: str | None = None
    email: str | None = None
    linkedin_url: str | None = None
    source: str | None = "mock"
    confidence_score: int | None = None
    notes: str | None = None


class SaveDiscoveredContactRequest(BaseModel):
    job_id: int
    contact: DiscoveredContactPayload


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _dump_unset(model: BaseModel) -> dict:
    """Return explicitly provided fields, including nulls."""
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=True)
    return model.dict(exclude_unset=True)


def _dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _safe_json_loads(json_str: str | None) -> list:
    """Safely parse a JSON string to a list, returning empty list on failure."""
    if not json_str:
        return []
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return []


def _load_job_profile(job: Job) -> dict:
    """Load job profile from stored JSON, or re-extract from raw text."""
    if job.parsed_profile_json:
        try:
            return json.loads(job.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return extract_job_profile(normalize_text(job.raw_text))


def _load_resume_profile(resume: Resume) -> dict:
    """Load resume profile from stored JSON, or extract from raw text."""
    if resume.parsed_profile_json:
        try:
            return json.loads(resume.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return extract_resume_profile(normalize_text(resume.raw_text))


def _match_to_summary(match: MatchResult) -> dict:
    """Convert a stored MatchResult to compact AI context."""
    return {
        "match_score": match.match_score,
        "recommendation": match.recommendation,
        "matched_skills": _safe_json_loads(match.matched_skills_json),
        "missing_required_skills": _safe_json_loads(match.missing_required_skills_json),
        "missing_preferred_skills": _safe_json_loads(match.missing_preferred_skills_json),
        "keyword_overlap": _safe_json_loads(match.keyword_overlap_json),
        "reasoning": match.reasoning,
        "suggested_angle": match.suggested_angle,
    }


def _has_prior_sent_message(db: Session, job_id: int, contact_id: int | None) -> bool:
    """Check whether the app has a sent outreach message for this job/contact."""
    query = db.query(OutreachMessage).filter(
        OutreachMessage.job_id == job_id,
        OutreachMessage.status == "sent",
    )
    if contact_id is not None:
        query = query.filter(OutreachMessage.contact_id == contact_id)
    return query.first() is not None


def _generation_response(
    *,
    job: Job,
    contact,
    resume,
    message_type: str,
    subject: str | None,
    body: str,
    saved_message=None,
) -> dict:
    """Build response for generated outreach output."""
    return {
        "message_id": saved_message.id if saved_message else None,
        "job_id": job.id,
        "contact_id": contact.id if contact else None,
        "message_type": message_type,
        "subject": subject,
        "body": body,
        "status": saved_message.status if saved_message else "draft",
        "created_at": _dt(saved_message.created_at) if saved_message else None,
        "job_title": job.title,
        "job_company": job.company,
        "contact_name": contact.name if contact else None,
        "contact_title": contact.title if contact else None,
        "resume_name": resume.name if resume else None,
    }


def _contact_to_dict(contact) -> dict:
    """Convert an OutreachContact ORM object to a JSON-friendly dict."""
    return {
        "id": contact.id,
        "job_id": contact.job_id,
        "name": contact.name,
        "title": contact.title,
        "company": contact.company,
        "email": contact.email,
        "linkedin_url": contact.linkedin_url,
        "source": contact.source,
        "confidence_score": contact.confidence_score,
        "notes": contact.notes,
        "created_at": _dt(contact.created_at),
        "updated_at": _dt(contact.updated_at),
    }


def _message_to_dict(message) -> dict:
    """Convert an OutreachMessage ORM object to a JSON-friendly dict."""
    return {
        "id": message.id,
        "job_id": message.job_id,
        "contact_id": message.contact_id,
        "message_type": message.message_type,
        "subject": message.subject,
        "body": message.body,
        "status": message.status,
        "follow_up_date": _dt(message.follow_up_date),
        "sent_at": _dt(message.sent_at),
        "created_at": _dt(message.created_at),
        "updated_at": _dt(message.updated_at),
        "contact_name": message.contact.name if message.contact else None,
    }


# ---------------------------------------------------------------------------
# Discovery endpoints
# ---------------------------------------------------------------------------

@router.post("/discover")
async def discover_contacts_endpoint(
    request: DiscoverContactsRequest,
    db: Session = Depends(get_db),
):
    """Return ranked mock contact candidates for a saved job."""
    if request.save_selected:
        raise HTTPException(
            status_code=400,
            detail="Use /v1/outreach/discovered/save to save selected contacts.",
        )

    try:
        return discover_contacts_for_job(
            db,
            job_id=request.job_id,
            provider=request.provider,
            max_results=request.max_results,
            target_titles=request.target_titles,
        )
    except UnsupportedContactProviderError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ContactDiscoveryJobNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/discovered/save")
async def save_discovered_contact_endpoint(
    request: SaveDiscoveredContactRequest,
    db: Session = Depends(get_db),
):
    """Save one selected discovered contact into the manual outreach CRM."""
    contact_payload = _dump_unset(request.contact)
    try:
        contact = save_discovered_contact(db, request.job_id, contact_payload)
    except ValueError as e:
        detail = str(e)
        status_code = 404 if "not found" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail)
    return _contact_to_dict(contact)


# ---------------------------------------------------------------------------
# Contact endpoints
# ---------------------------------------------------------------------------

@router.post("/contacts")
async def create_contact_endpoint(
    request: CreateContactRequest,
    db: Session = Depends(get_db),
):
    """Create a manually entered outreach contact for a job."""
    try:
        contact = create_contact(db, **_dump_unset(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _contact_to_dict(contact)


@router.get("/jobs/{job_id}/contacts")
async def list_contacts_for_job_endpoint(job_id: int, db: Session = Depends(get_db)):
    """List outreach contacts for a job."""
    try:
        contacts = list_contacts_for_job(db, job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"contacts": [_contact_to_dict(c) for c in contacts]}


@router.get("/contacts/{contact_id}")
async def get_contact_endpoint(contact_id: int, db: Session = Depends(get_db)):
    """Get a single outreach contact by ID."""
    contact = get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail=f"Contact with id {contact_id} not found.")
    return _contact_to_dict(contact)


@router.patch("/contacts/{contact_id}")
async def update_contact_endpoint(
    contact_id: int,
    request: UpdateContactRequest,
    db: Session = Depends(get_db),
):
    """Update outreach contact fields."""
    update_fields = _dump_unset(request)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    try:
        contact = update_contact(db, contact_id, **update_fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not contact:
        raise HTTPException(status_code=404, detail=f"Contact with id {contact_id} not found.")
    return _contact_to_dict(contact)


@router.delete("/contacts/{contact_id}")
async def delete_contact_endpoint(contact_id: int, db: Session = Depends(get_db)):
    """Delete an outreach contact and its linked messages."""
    deleted = delete_contact(db, contact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Contact with id {contact_id} not found.")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Message endpoints
# ---------------------------------------------------------------------------

@router.post("/messages")
async def create_message_endpoint(
    request: CreateMessageRequest,
    db: Session = Depends(get_db),
):
    """Create an outreach message draft/status record."""
    try:
        message = create_message(db, **_dump_unset(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _message_to_dict(message)


@router.post("/messages/generate")
async def generate_outreach_message_endpoint(
    request: GenerateOutreachMessageRequest,
    db: Session = Depends(get_db),
):
    """Generate a personalized outreach message and optionally save it as a draft."""
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(status_code=400, detail="api_key is required.")
    if request.message_type not in VALID_OUTREACH_MESSAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid message_type '{request.message_type}'. Must be one of: "
                f"{', '.join(sorted(VALID_OUTREACH_MESSAGE_TYPES))}"
            ),
        )

    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with id {request.job_id} not found.")

    contact = None
    if request.contact_id is not None:
        contact = get_contact(db, request.contact_id)
        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact with id {request.contact_id} not found.")
        if contact.job_id != request.job_id:
            raise HTTPException(
                status_code=400,
                detail=f"Contact with id {request.contact_id} does not belong to job {request.job_id}.",
            )

    match = None
    if request.match_id is not None:
        match = db.query(MatchResult).filter(MatchResult.id == request.match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail=f"Match with id {request.match_id} not found.")
        if match.job_id != request.job_id:
            raise HTTPException(
                status_code=400,
                detail=f"Match with id {request.match_id} does not belong to job {request.job_id}.",
            )
        if request.resume_id is not None and match.resume_id != request.resume_id:
            raise HTTPException(
                status_code=400,
                detail=f"Match with id {request.match_id} does not belong to resume {request.resume_id}.",
            )

    resume = None
    resume_id = request.resume_id if request.resume_id is not None else (match.resume_id if match else None)
    if resume_id is not None:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise HTTPException(status_code=404, detail=f"Resume with id {resume_id} not found.")

    job_profile = _load_job_profile(job)
    resume_profile = _load_resume_profile(resume) if resume else None
    match_summary = _match_to_summary(match) if match else None

    prior_sent = _has_prior_sent_message(db, request.job_id, request.contact_id)
    context_parts = []
    if request.extra_context:
        context_parts.append(request.extra_context.strip())
    if prior_sent:
        context_parts.append("Outreach history: A prior sent outreach message exists for this job/contact.")
    else:
        context_parts.append("Outreach history: No prior sent outreach message is recorded for this job/contact.")
    grounded_extra_context = "\n".join(part for part in context_parts if part)

    try:
        generated = generate_outreach_message(
            job_profile=job_profile,
            job_raw_text=job.raw_text,
            contact=contact,
            resume_profile=resume_profile,
            match_summary=match_summary,
            message_type=request.message_type,
            api_key=request.api_key,
            extra_context=grounded_extra_context,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=500, detail="AI outreach generation failed.")

    saved_message = None
    if request.save_as_draft:
        try:
            saved_message = create_message(
                db,
                job_id=request.job_id,
                contact_id=request.contact_id,
                message_type=request.message_type,
                subject=generated["subject"],
                body=generated["body"],
                status="draft",
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return _generation_response(
        job=job,
        contact=contact,
        resume=resume,
        message_type=request.message_type,
        subject=generated["subject"],
        body=generated["body"],
        saved_message=saved_message,
    )


@router.get("/jobs/{job_id}/messages")
async def list_messages_for_job_endpoint(job_id: int, db: Session = Depends(get_db)):
    """List outreach messages for a job."""
    try:
        messages = list_messages_for_job(db, job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"messages": [_message_to_dict(m) for m in messages]}


@router.get("/contacts/{contact_id}/messages")
async def list_messages_for_contact_endpoint(contact_id: int, db: Session = Depends(get_db)):
    """List outreach messages for a contact."""
    try:
        messages = list_messages_for_contact(db, contact_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"messages": [_message_to_dict(m) for m in messages]}


@router.get("/messages/{message_id}")
async def get_message_endpoint(message_id: int, db: Session = Depends(get_db)):
    """Get a single outreach message by ID."""
    message = get_message(db, message_id)
    if not message:
        raise HTTPException(status_code=404, detail=f"Message with id {message_id} not found.")
    return _message_to_dict(message)


@router.patch("/messages/{message_id}")
async def update_message_endpoint(
    message_id: int,
    request: UpdateMessageRequest,
    db: Session = Depends(get_db),
):
    """Update outreach message fields."""
    update_fields = _dump_unset(request)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    try:
        message = update_message(db, message_id, **update_fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not message:
        raise HTTPException(status_code=404, detail=f"Message with id {message_id} not found.")
    return _message_to_dict(message)


@router.delete("/messages/{message_id}")
async def delete_message_endpoint(message_id: int, db: Session = Depends(get_db)):
    """Delete an outreach message by ID."""
    deleted = delete_message(db, message_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Message with id {message_id} not found.")
    return {"deleted": True}
