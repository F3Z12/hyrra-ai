"""
Application tracking service.

Handles CRUD operations for job applications in the database.
Validates status values and foreign key references.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.database.models import Application, Job, Resume, VALID_APPLICATION_STATUSES


def create_application(
    db: Session,
    job_id: int,
    resume_id: int | None = None,
    status: str = "saved",
    notes: str | None = None,
    date_applied: datetime | None = None,
    deadline: datetime | None = None,
) -> Application:
    """
    Create a new application entry.

    Validates that the referenced job exists and that
    the resume exists if provided. Validates status value.

    Raises:
        ValueError: If job not found, resume not found, or invalid status.
    """
    # Validate status
    if status not in VALID_APPLICATION_STATUSES:
        raise ValueError(
            f"Invalid status '{status}'. Must be one of: {', '.join(sorted(VALID_APPLICATION_STATUSES))}"
        )

    # Validate job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with id {job_id} not found.")

    # Validate resume exists if provided
    if resume_id is not None:
        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise ValueError(f"Resume with id {resume_id} not found.")

    application = Application(
        job_id=job_id,
        resume_id=resume_id,
        status=status,
        notes=notes,
        date_applied=date_applied,
        deadline=deadline,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def list_applications(db: Session) -> list[Application]:
    """Return all applications, newest first."""
    return db.query(Application).order_by(Application.created_at.desc()).all()


def get_application(db: Session, application_id: int) -> Application | None:
    """Get a single application by ID, or None if not found."""
    return db.query(Application).filter(Application.id == application_id).first()


def update_application(
    db: Session,
    application_id: int,
    **fields,
) -> Application | None:
    """
    Update an application with the provided fields.

    Only updates fields that are explicitly passed. Validates status if provided.
    Returns the updated application, or None if not found.
    """
    application = get_application(db, application_id)
    if not application:
        return None

    # Validate status if being updated
    if "status" in fields and fields["status"] is not None:
        if fields["status"] not in VALID_APPLICATION_STATUSES:
            raise ValueError(
                f"Invalid status '{fields['status']}'. Must be one of: {', '.join(sorted(VALID_APPLICATION_STATUSES))}"
            )

    # Apply updates
    allowed_fields = {"status", "notes", "date_applied", "deadline", "resume_id"}
    for key, value in fields.items():
        if key in allowed_fields and value is not None:
            setattr(application, key, value)

    db.commit()
    db.refresh(application)
    return application


def delete_application(db: Session, application_id: int) -> bool:
    """Delete an application by ID. Returns True if deleted, False if not found."""
    application = get_application(db, application_id)
    if not application:
        return False
    db.delete(application)
    db.commit()
    return True
