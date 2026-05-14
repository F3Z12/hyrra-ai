"""
AI enrichment API routes.

Endpoints:
- POST /v1/ai/explain-match  → AI-powered match explanation
- POST /v1/ai/cover-letter   → AI-generated tailored cover letter

Both endpoints require a valid OpenAI API key (BYOK pattern).
They build on top of the deterministic scoring engine.
"""

import json
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Response
from fpdf import FPDF
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import Job, Resume
from app.parsers.text_parser import normalize_text
from app.extractors.job_extractor import extract_job_profile
from app.extractors.resume_extractor import extract_resume_profile
from app.matching.scorer import score_job_resume_match
from app.services.ai_enrichment_service import (
    generate_match_explanation,
    generate_tailored_cover_letter,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AIMatchRequest(BaseModel):
    job_id: int
    resume_id: int
    api_key: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_profiles_and_score(db: Session, job_id: int, resume_id: int):
    """Load job + resume from DB, extract profiles, and score match."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job with id {job_id} not found.")

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail=f"Resume with id {resume_id} not found.")

    # Load or extract job profile
    job_profile = None
    if job.parsed_profile_json:
        try:
            job_profile = json.loads(job.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    if not job_profile:
        job_profile = extract_job_profile(normalize_text(job.raw_text))

    # Load or extract resume profile
    resume_profile = None
    if resume.parsed_profile_json:
        try:
            resume_profile = json.loads(resume.parsed_profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    if not resume_profile:
        resume_profile = extract_resume_profile(normalize_text(resume.raw_text))

    # Score
    match_result = score_job_resume_match(job_profile, resume_profile)

    return job_profile, resume_profile, match_result


def _pdf_safe_text(text: str) -> str:
    """Normalize common punctuation to keep core PDF fonts reliable."""
    replacements = {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u2026": "...",
        "\u00a0": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text.encode("latin-1", "replace").decode("latin-1")


def _cover_letter_pdf_bytes(cover_letter: str) -> bytes:
    """Render cover letter text to a simple wrapped PDF document."""
    pdf = FPDF(format="Letter")
    pdf.set_margins(left=20, top=18, right=20)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)

    safe_text = _pdf_safe_text(cover_letter)
    line_height = 6
    for paragraph in safe_text.splitlines():
        if paragraph.strip():
            pdf.multi_cell(0, line_height, paragraph.strip())
        pdf.ln(2)

    output = pdf.output(dest="S")
    if isinstance(output, str):
        return output.encode("latin-1")
    if isinstance(output, bytearray):
        return bytes(output)
    if isinstance(output, BytesIO):
        return output.getvalue()
    return bytes(output)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/explain-match")
async def explain_match_endpoint(request: AIMatchRequest, db: Session = Depends(get_db)):
    """
    Generate an AI-powered explanation of a job-resume match.

    Uses the deterministic match score as input, then enriches it with
    structured career strategy insights via OpenAI.
    """
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(status_code=400, detail="api_key is required.")

    job_profile, resume_profile, match_result = _load_profiles_and_score(
        db, request.job_id, request.resume_id
    )

    try:
        explanation = generate_match_explanation(
            job_profile=job_profile,
            resume_profile=resume_profile,
            match_result=match_result,
            api_key=request.api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=500, detail="AI generation failed.")

    return {
        "match_score": match_result["match_score"],
        "recommendation": match_result["recommendation"],
        "explanation": explanation,
    }


@router.post("/cover-letter")
async def cover_letter_endpoint(request: AIMatchRequest, db: Session = Depends(get_db)):
    """
    Generate a tailored cover letter using AI + match intelligence.

    Combines the deterministic match result with OpenAI to produce
    a highly specific cover letter for the job-resume pair.
    """
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(status_code=400, detail="api_key is required.")

    job_profile, resume_profile, match_result = _load_profiles_and_score(
        db, request.job_id, request.resume_id
    )

    try:
        cover_letter = generate_tailored_cover_letter(
            job_profile=job_profile,
            resume_profile=resume_profile,
            match_result=match_result,
            api_key=request.api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=500, detail="AI generation failed.")

    pdf_bytes = _cover_letter_pdf_bytes(cover_letter)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="cover_letter.pdf"'},
    )
