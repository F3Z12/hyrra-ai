"""
Job analysis service — input-source agnostic.

Provides a unified analysis pipeline for job postings regardless of
how they were ingested (PDF, pasted text, Chrome extension, scraper).

Pipeline:
1. Extract raw text (if needed, e.g. PDF)
2. Normalize text
3. Extract general job profile
4. Return structured result
"""

from app.parsers.text_parser import normalize_text
from app.parsers.pdf_parser import extract_pdf_text
from app.extractors.job_extractor import extract_job_profile


def analyze_job_text(job_text: str, source_type: str = "text") -> dict:
    """
    Analyze a job posting from raw text input.

    Works for any text source: pasted text, Chrome extension, scraper output.

    Args:
        job_text: Raw job posting text.
        source_type: Origin label (e.g. "text", "browser_extension", "scraper").

    Returns:
        Structured job analysis result.
    """
    normalized = normalize_text(job_text)
    profile = extract_job_profile(normalized)

    return {
        "source_type": source_type,
        "title": profile["title"],
        "company": profile["company"],
        "location": profile["location"],
        "employment_type": profile["employment_type"],
        "required_skills": profile["required_skills"],
        "preferred_skills": profile["preferred_skills"],
        "responsibilities": profile["responsibilities"],
        "qualifications": profile["qualifications"],
        "preferred_qualifications": profile["preferred_qualifications"],
        "keywords": profile["keywords"],
        "raw_text_length": len(normalized),
        "parse_warnings": profile["parse_warnings"],
    }


def analyze_job_pdf(pdf_bytes: bytes, filename: str) -> dict:
    """
    Analyze a job posting from a PDF file.

    Extracts text from the PDF, then feeds it through the same
    general analysis pipeline as text input.

    Args:
        pdf_bytes: Raw PDF file bytes.
        filename: Original filename of the uploaded PDF.

    Returns:
        Structured job analysis result (same shape as analyze_job_text,
        plus a 'filename' field).
    """
    raw_text = extract_pdf_text(pdf_bytes)
    result = analyze_job_text(raw_text, source_type="pdf")
    result["filename"] = filename
    return result


def analyze_job_text_batch(job_items: list) -> list[dict]:
    """
    Analyze multiple job postings through the same single-job pipeline.

    Each item should have: job_text, source_type, source_label.
    Empty job_text entries are skipped with an error marker.

    Args:
        job_items: List of objects with job_text, source_type, source_label attributes.

    Returns:
        List of structured job analysis results.
    """
    results = []
    for item in job_items:
        job_text = item.job_text
        source_type = item.source_type
        source_label = item.source_label

        if not job_text or not job_text.strip():
            results.append({
                "source_type": source_type,
                "source_label": source_label,
                "error": "empty job text, skipped",
            })
            continue

        result = analyze_job_text(job_text, source_type=source_type)
        result["source_label"] = source_label
        results.append(result)

    return results
