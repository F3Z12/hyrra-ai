"""
Job API routes — analysis + storage.

Analysis endpoints (stateless):
- POST /v1/jobs/analyze-text        → analyze a single pasted/raw job text
- POST /v1/jobs/analyze-pdf         → analyze a single uploaded PDF job posting
- POST /v1/jobs/analyze-text-batch  → analyze multiple pasted job texts

Storage endpoints (database):
- POST   /v1/jobs                   → analyze + save a job
- GET    /v1/jobs                   → list all saved jobs
- GET    /v1/jobs/{job_id}          → get a single saved job
- DELETE /v1/jobs/{job_id}          → delete a saved job
"""

import json
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services.job_analysis_service import (
    analyze_job_text,
    analyze_job_pdf,
    analyze_job_text_batch,
)
from app.services.job_storage_service import (
    create_job_from_text,
    list_jobs,
    get_job,
    update_job,
    delete_job,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AnalyzeTextRequest(BaseModel):
    job_text: str
    source_type: str = "text"


class BatchJobItem(BaseModel):
    job_text: str
    source_type: str = "text"
    source_label: str = ""


class AnalyzeTextBatchRequest(BaseModel):
    jobs: list[BatchJobItem]


class SaveJobRequest(BaseModel):
    job_text: str
    source_type: str = "text"
    source_label: str = ""


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    source_label: Optional[str] = None
    raw_text: Optional[str] = None


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _job_to_dict(job) -> dict:
    """Convert a Job ORM object to a JSON-friendly dict."""
    parsed_profile = None
    if job.parsed_profile_json:
        try:
            parsed_profile = json.loads(job.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            parsed_profile = None

    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "employment_type": job.employment_type,
        "source_type": job.source_type,
        "source_label": job.source_label,
        "raw_text": job.raw_text,
        "parsed_profile": parsed_profile,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


# ===========================================================================
# ANALYSIS ENDPOINTS (stateless — no database)
# ===========================================================================

@router.post("/analyze-text")
async def analyze_text_endpoint(request: AnalyzeTextRequest):
    """
    Analyze a job posting from pasted/raw text (stateless).

    Returns a structured job profile without saving to database.
    """
    if not request.job_text or not request.job_text.strip():
        raise HTTPException(status_code=400, detail="job_text cannot be empty.")

    result = analyze_job_text(request.job_text, source_type=request.source_type)
    return result


@router.post("/analyze-pdf")
async def analyze_pdf_endpoint(file: UploadFile = File(...)):
    """
    Analyze a job posting from an uploaded PDF file (stateless).

    Returns a structured job profile without saving to database.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = file.filename or "unknown.pdf"
    result = analyze_job_pdf(pdf_bytes, filename)
    return result


@router.post("/analyze-text-batch")
async def analyze_text_batch_endpoint(request: AnalyzeTextBatchRequest):
    """
    Analyze multiple job postings from pasted/raw text (stateless).

    Each item is analyzed through the same single-job pipeline.
    """
    if not request.jobs:
        raise HTTPException(status_code=400, detail="jobs list cannot be empty.")

    results = analyze_job_text_batch(request.jobs)
    return {"results": results}


# ===========================================================================
# STORAGE ENDPOINTS (database-backed)
# ===========================================================================

@router.post("")
async def save_job_endpoint(request: SaveJobRequest, db: Session = Depends(get_db)):
    """
    Analyze job text and save to database.

    Runs the full V2 analysis pipeline, then stores the raw text
    and parsed profile in the database.
    """
    if not request.job_text or not request.job_text.strip():
        raise HTTPException(status_code=400, detail="job_text cannot be empty.")

    job = create_job_from_text(
        db,
        job_text=request.job_text,
        source_type=request.source_type,
        source_label=request.source_label,
    )
    return _job_to_dict(job)


@router.get("")
async def list_jobs_endpoint(db: Session = Depends(get_db)):
    """List all saved jobs."""
    jobs = list_jobs(db)
    return {"jobs": [_job_to_dict(j) for j in jobs]}


@router.get("/{job_id}")
async def get_job_endpoint(job_id: int, db: Session = Depends(get_db)):
    """Get a single saved job by ID."""
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with id {job_id} not found.")
    return _job_to_dict(job)


@router.patch("/{job_id}")
async def update_job_endpoint(job_id: int, request: JobUpdate, db: Session = Depends(get_db)):
    """Update saved job metadata, optionally re-extracting changed raw text."""
    update_data = request.dict(exclude_unset=True)
    job = update_job(db, job_id, update_data)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with id {job_id} not found.")
    return _job_to_dict(job)


@router.delete("/{job_id}")
async def delete_job_endpoint(job_id: int, db: Session = Depends(get_db)):
    """Delete a saved job by ID."""
    deleted = delete_job(db, job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Job with id {job_id} not found.")
    return {"deleted": True}
