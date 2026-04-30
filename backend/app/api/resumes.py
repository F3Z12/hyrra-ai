"""
Resume API routes.

Endpoints:
- POST   /v1/resumes              → create a resume
- GET    /v1/resumes              → list all resumes
- GET    /v1/resumes/{resume_id}  → get a single resume
- DELETE /v1/resumes/{resume_id}  → delete a resume
"""

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.parsers.pdf_parser import extract_pdf_text
from app.parsers.text_parser import normalize_text
from app.services.resume_service import (
    create_resume,
    list_resumes,
    get_resume,
    delete_resume,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CreateResumeRequest(BaseModel):
    name: str
    raw_text: str


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _resume_to_dict(resume) -> dict:
    """Convert a Resume ORM object to a JSON-friendly dict."""
    parsed_profile = None
    if resume.parsed_profile_json:
        try:
            parsed_profile = json.loads(resume.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            parsed_profile = None

    return {
        "id": resume.id,
        "name": resume.name,
        "raw_text": resume.raw_text,
        "parsed_profile": parsed_profile,
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
        "updated_at": resume.updated_at.isoformat() if resume.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("")
async def create_resume_endpoint(request: CreateResumeRequest, db: Session = Depends(get_db)):
    """Create and store a new resume."""
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="name cannot be empty.")
    if not request.raw_text or not request.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text cannot be empty.")

    resume = create_resume(db, name=request.name.strip(), raw_text=request.raw_text)
    return _resume_to_dict(resume)


@router.post("/upload-pdf")
async def upload_resume_pdf_endpoint(
    name: str = Form(""),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """Create and store a new resume from an uploaded PDF."""
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="name cannot be empty.")
    if file is None:
        raise HTTPException(status_code=400, detail="file is required.")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        extracted_text = extract_pdf_text(pdf_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF.") from exc

    raw_text = normalize_text(extracted_text)
    if not raw_text or len(raw_text) < 20:
        raise HTTPException(status_code=400, detail="Extracted PDF text is empty or too short.")

    resume = create_resume(db, name=name.strip(), raw_text=raw_text)
    return _resume_to_dict(resume)


@router.get("")
async def list_resumes_endpoint(db: Session = Depends(get_db)):
    """List all stored resumes."""
    resumes = list_resumes(db)
    return {"resumes": [_resume_to_dict(r) for r in resumes]}


@router.get("/{resume_id}")
async def get_resume_endpoint(resume_id: int, db: Session = Depends(get_db)):
    """Get a single resume by ID."""
    resume = get_resume(db, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail=f"Resume with id {resume_id} not found.")
    return _resume_to_dict(resume)


@router.delete("/{resume_id}")
async def delete_resume_endpoint(resume_id: int, db: Session = Depends(get_db)):
    """Delete a resume by ID."""
    deleted = delete_resume(db, resume_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Resume with id {resume_id} not found.")
    return {"deleted": True}
