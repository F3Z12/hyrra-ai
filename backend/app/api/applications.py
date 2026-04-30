"""
Application tracking API routes.

Endpoints:
- POST   /v1/applications                    → create an application
- GET    /v1/applications                    → list all applications
- GET    /v1/applications/{application_id}   → get a single application
- PATCH  /v1/applications/{application_id}   → update application fields
- DELETE /v1/applications/{application_id}   → delete an application
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services.application_service import (
    create_application,
    list_applications,
    get_application,
    update_application,
    delete_application,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CreateApplicationRequest(BaseModel):
    job_id: int
    resume_id: int | None = None
    status: str = "saved"
    notes: str | None = None
    date_applied: datetime | None = None
    deadline: datetime | None = None


class UpdateApplicationRequest(BaseModel):
    status: str | None = None
    notes: str | None = None
    date_applied: datetime | None = None
    deadline: datetime | None = None
    resume_id: int | None = None


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _application_to_dict(app) -> dict:
    """Convert an Application ORM object to a JSON-friendly dict."""
    # Get parsed job profile if available
    job_profile = None
    if app.job and app.job.parsed_profile_json:
        try:
            job_profile = json.loads(app.job.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            job_profile = None

    return {
        "id": app.id,
        "job_id": app.job_id,
        "resume_id": app.resume_id,
        "status": app.status,
        "notes": app.notes,
        "date_applied": app.date_applied.isoformat() if app.date_applied else None,
        "deadline": app.deadline.isoformat() if app.deadline else None,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
        # Include job summary for convenience
        "job_title": app.job.title if app.job else None,
        "job_company": app.job.company if app.job else None,
        "resume_name": app.resume.name if app.resume else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("")
async def create_application_endpoint(
    request: CreateApplicationRequest,
    db: Session = Depends(get_db),
):
    """Create a new application entry for a job."""
    try:
        application = create_application(
            db,
            job_id=request.job_id,
            resume_id=request.resume_id,
            status=request.status,
            notes=request.notes,
            date_applied=request.date_applied,
            deadline=request.deadline,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return _application_to_dict(application)


@router.get("")
async def list_applications_endpoint(db: Session = Depends(get_db)):
    """List all applications."""
    applications = list_applications(db)
    return {"applications": [_application_to_dict(a) for a in applications]}


@router.get("/{application_id}")
async def get_application_endpoint(application_id: int, db: Session = Depends(get_db)):
    """Get a single application by ID."""
    application = get_application(db, application_id)
    if not application:
        raise HTTPException(status_code=404, detail=f"Application with id {application_id} not found.")
    return _application_to_dict(application)


@router.patch("/{application_id}")
async def update_application_endpoint(
    application_id: int,
    request: UpdateApplicationRequest,
    db: Session = Depends(get_db),
):
    """Update application fields (status, notes, dates)."""
    # Build update dict from non-None fields
    update_fields = {}
    if request.status is not None:
        update_fields["status"] = request.status
    if request.notes is not None:
        update_fields["notes"] = request.notes
    if request.date_applied is not None:
        update_fields["date_applied"] = request.date_applied
    if request.deadline is not None:
        update_fields["deadline"] = request.deadline
    if request.resume_id is not None:
        update_fields["resume_id"] = request.resume_id

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    try:
        application = update_application(db, application_id, **update_fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not application:
        raise HTTPException(status_code=404, detail=f"Application with id {application_id} not found.")

    return _application_to_dict(application)


@router.delete("/{application_id}")
async def delete_application_endpoint(application_id: int, db: Session = Depends(get_db)):
    """Delete an application by ID."""
    deleted = delete_application(db, application_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Application with id {application_id} not found.")
    return {"deleted": True}
