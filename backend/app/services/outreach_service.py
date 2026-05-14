"""
Outreach CRM service.

Handles manual outreach contacts and message drafts/status tracking.
This layer does not discover contacts, scrape, send email, or call AI.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.database.models import (
    Job,
    OutreachContact,
    OutreachMessage,
    VALID_OUTREACH_MESSAGE_STATUSES,
    VALID_OUTREACH_MESSAGE_TYPES,
)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _require_job(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with id {job_id} not found.")
    return job


def _validate_message_type(message_type: str) -> None:
    if message_type not in VALID_OUTREACH_MESSAGE_TYPES:
        raise ValueError(
            f"Invalid message_type '{message_type}'. Must be one of: "
            f"{', '.join(sorted(VALID_OUTREACH_MESSAGE_TYPES))}"
        )


def _validate_status(status: str) -> None:
    if status not in VALID_OUTREACH_MESSAGE_STATUSES:
        raise ValueError(
            f"Invalid status '{status}'. Must be one of: "
            f"{', '.join(sorted(VALID_OUTREACH_MESSAGE_STATUSES))}"
        )


def _require_contact_for_job(db: Session, contact_id: int, job_id: int) -> OutreachContact:
    contact = get_contact(db, contact_id)
    if not contact:
        raise ValueError(f"Contact with id {contact_id} not found.")
    if contact.job_id != job_id:
        raise ValueError(f"Contact with id {contact_id} does not belong to job {job_id}.")
    return contact


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

def create_contact(
    db: Session,
    job_id: int,
    name: str,
    title: str | None = None,
    company: str | None = None,
    email: str | None = None,
    linkedin_url: str | None = None,
    source: str | None = None,
    confidence_score: int | None = None,
    notes: str | None = None,
) -> OutreachContact:
    """Create a manually entered outreach contact for a job."""
    _require_job(db, job_id)
    if not name or not name.strip():
        raise ValueError("name is required.")

    contact = OutreachContact(
        job_id=job_id,
        name=name.strip(),
        title=title,
        company=company,
        email=email,
        linkedin_url=linkedin_url,
        source=source,
        confidence_score=confidence_score,
        notes=notes,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def list_contacts_for_job(db: Session, job_id: int) -> list[OutreachContact]:
    """Return contacts for a job, newest first."""
    _require_job(db, job_id)
    return (
        db.query(OutreachContact)
        .filter(OutreachContact.job_id == job_id)
        .order_by(OutreachContact.created_at.desc())
        .all()
    )


def get_contact(db: Session, contact_id: int) -> OutreachContact | None:
    """Get a single outreach contact by ID, or None if not found."""
    return db.query(OutreachContact).filter(OutreachContact.id == contact_id).first()


def update_contact(db: Session, contact_id: int, **fields) -> OutreachContact | None:
    """Update contact fields. Nullable fields may be explicitly cleared."""
    contact = get_contact(db, contact_id)
    if not contact:
        return None

    allowed_fields = {
        "name",
        "title",
        "company",
        "email",
        "linkedin_url",
        "source",
        "confidence_score",
        "notes",
    }
    for key, value in fields.items():
        if key not in allowed_fields:
            continue
        if key == "name":
            if value is None or not str(value).strip():
                raise ValueError("name cannot be empty.")
            value = str(value).strip()
        setattr(contact, key, value)

    db.commit()
    db.refresh(contact)
    return contact


def delete_contact(db: Session, contact_id: int) -> bool:
    """Delete a contact and its linked outreach messages."""
    contact = get_contact(db, contact_id)
    if not contact:
        return False

    db.query(OutreachMessage).filter(
        OutreachMessage.contact_id == contact_id
    ).delete(synchronize_session=False)
    db.delete(contact)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def create_message(
    db: Session,
    job_id: int,
    contact_id: int | None = None,
    message_type: str = "email",
    subject: str | None = None,
    body: str = "",
    status: str = "draft",
    follow_up_date: datetime | None = None,
    sent_at: datetime | None = None,
) -> OutreachMessage:
    """Create an outreach message draft/status record."""
    _require_job(db, job_id)
    _validate_message_type(message_type)
    _validate_status(status)
    if contact_id is not None:
        _require_contact_for_job(db, contact_id, job_id)
    if body is None:
        raise ValueError("body is required.")

    message = OutreachMessage(
        job_id=job_id,
        contact_id=contact_id,
        message_type=message_type,
        subject=subject,
        body=body,
        status=status,
        follow_up_date=follow_up_date,
        sent_at=sent_at,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def list_messages_for_job(db: Session, job_id: int) -> list[OutreachMessage]:
    """Return outreach messages for a job, newest first."""
    _require_job(db, job_id)
    return (
        db.query(OutreachMessage)
        .filter(OutreachMessage.job_id == job_id)
        .order_by(OutreachMessage.created_at.desc())
        .all()
    )


def list_messages_for_contact(db: Session, contact_id: int) -> list[OutreachMessage]:
    """Return outreach messages for a contact, newest first."""
    contact = get_contact(db, contact_id)
    if not contact:
        raise ValueError(f"Contact with id {contact_id} not found.")
    return (
        db.query(OutreachMessage)
        .filter(OutreachMessage.contact_id == contact_id)
        .order_by(OutreachMessage.created_at.desc())
        .all()
    )


def get_message(db: Session, message_id: int) -> OutreachMessage | None:
    """Get a single outreach message by ID, or None if not found."""
    return db.query(OutreachMessage).filter(OutreachMessage.id == message_id).first()


def update_message(db: Session, message_id: int, **fields) -> OutreachMessage | None:
    """Update message fields. Nullable fields may be explicitly cleared."""
    message = get_message(db, message_id)
    if not message:
        return None

    if "message_type" in fields and fields["message_type"] is not None:
        _validate_message_type(fields["message_type"])
    if "status" in fields and fields["status"] is not None:
        _validate_status(fields["status"])
    if "contact_id" in fields and fields["contact_id"] is not None:
        _require_contact_for_job(db, fields["contact_id"], message.job_id)
    if "job_id" in fields and fields["job_id"] != message.job_id:
        raise ValueError("job_id cannot be changed.")

    allowed_fields = {
        "contact_id",
        "message_type",
        "subject",
        "body",
        "status",
        "follow_up_date",
        "sent_at",
    }
    for key, value in fields.items():
        if key in allowed_fields:
            if key == "body" and value is None:
                raise ValueError("body cannot be null.")
            setattr(message, key, value)

    db.commit()
    db.refresh(message)
    return message


def delete_message(db: Session, message_id: int) -> bool:
    """Delete an outreach message by ID. Returns True if deleted."""
    message = get_message(db, message_id)
    if not message:
        return False
    db.delete(message)
    db.commit()
    return True
