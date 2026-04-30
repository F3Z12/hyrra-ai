"""
Resume profile extractor.

Extracts structured resume information from normalized text using
heuristics and section detection. Reuses the shared skill dictionary.

No LLM dependency. Fully deterministic.
"""

import re

from app.extractors.skill_extractor import detect_skills
from app.extractors.keyword_extractor import extract_keywords as _extract_keywords


# ---------------------------------------------------------------------------
# Section heading classifiers for resumes
# ---------------------------------------------------------------------------

PROJECT_HEADERS = [
    "projects", "personal projects", "technical projects",
    "selected projects", "side projects", "academic projects",
]

EXPERIENCE_HEADERS = [
    "experience", "work experience", "employment",
    "internship", "internships", "professional experience",
    "relevant experience", "work history",
]

EDUCATION_HEADERS = [
    "education", "university", "school",
    "coursework", "relevant coursework", "academic background",
    "certifications", "certificates",
]

SKILLS_HEADERS = [
    "skills", "technical skills", "technologies",
    "tools", "programming languages", "frameworks",
    "competencies", "proficiencies",
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _find_sections(lines: list[str]) -> list[dict]:
    """Identify section boundaries based on heading-like lines."""
    sections = []
    current_heading = "__preamble__"
    current_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        is_heading = False
        if stripped and len(stripped) < 100:
            if stripped.endswith(":") and len(stripped) > 3:
                is_heading = True
            elif stripped.isupper() and len(stripped) > 3 and " " in stripped:
                is_heading = True
            elif re.match(r"^[A-Z][A-Za-z\s/&,]+:?$", stripped) and len(stripped) < 40:
                is_heading = True

        if is_heading:
            if current_lines or current_heading == "__preamble__":
                sections.append({"heading": current_heading, "lines": current_lines})
            current_heading = stripped.rstrip(":").strip()
            current_lines = []
        else:
            if stripped:
                current_lines.append(stripped)

    sections.append({"heading": current_heading, "lines": current_lines})
    return sections


def _match_section(heading: str, patterns: list[str]) -> bool:
    """Check if a section heading matches any of the given pattern phrases."""
    heading_lower = heading.lower().strip()
    return any(p in heading_lower for p in patterns)


def _extract_items(lines: list[str], min_length: int = 5) -> list[str]:
    """Extract meaningful items from section lines."""
    items = []
    for line in lines:
        cleaned = re.sub(r"^[\-\*\u2022\u25cf\u25e6\d.)\]]+\s*", "", line).strip()
        if cleaned and len(cleaned) >= min_length:
            items.append(cleaned)
    return items


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_resume_profile(resume_text: str) -> dict:
    """
    Extract a structured resume profile from normalized resume text.

    Returns:
        {
            "skills": list[str],
            "projects": list[str],
            "experience_keywords": list[str],
            "education_keywords": list[str],
            "keywords": list[str],
            "parse_warnings": list[str]
        }
    """
    warnings: list[str] = []

    if len(resume_text.strip()) < 50:
        warnings.append("resume_text_too_short")

    # --- Detect skills from full text ---
    skills = detect_skills(resume_text)
    if not skills:
        warnings.append("no_skills_detected")

    # --- Section-based extraction ---
    lines = resume_text.split("\n")
    sections = _find_sections(lines)

    projects: list[str] = []
    experience_keywords: list[str] = []
    education_keywords: list[str] = []

    for section in sections:
        heading = section["heading"]
        section_lines = section["lines"]

        if _match_section(heading, PROJECT_HEADERS):
            projects.extend(_extract_items(section_lines))

        elif _match_section(heading, EXPERIENCE_HEADERS):
            experience_keywords.extend(_extract_items(section_lines))

        elif _match_section(heading, EDUCATION_HEADERS):
            education_keywords.extend(_extract_items(section_lines))

    # --- Keywords from full resume text ---
    keywords = _extract_keywords(resume_text, limit=20)

    return {
        "skills": skills,
        "projects": projects,
        "experience_keywords": experience_keywords,
        "education_keywords": education_keywords,
        "keywords": keywords,
        "parse_warnings": warnings,
    }
