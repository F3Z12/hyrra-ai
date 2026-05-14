"""
Section extraction — detect headings and extract structured content.

Identifies section boundaries in job postings using heading heuristics,
then classifies sections as responsibilities, qualifications, or preferred.
Returns both bullet-item lists and raw zone text for downstream skill extraction.
"""

import re

RESPONSIBILITY_HEADERS = [
    "responsibilities", "what you'll do", "what you will do",
    "job duties", "key responsibilities", "role responsibilities",
    "your role", "about the role", "the role",
    "what you'll work on", "day to day", "job responsibilities",
]

QUALIFICATION_HEADERS = [
    "qualifications", "requirements", "what we're looking for",
    "what you'll need", "what you will need", "minimum qualifications",
    "required qualifications", "who you are", "about you",
    "must have", "what you bring", "required skills",
]

PREFERRED_HEADERS = [
    "preferred", "nice to have", "bonus", "preferred qualifications",
    "desired", "assets", "good to have", "additional qualifications",
    "preferred skills", "bonus points", "nice-to-have",
]


def _find_sections(lines: list[str]) -> list[dict]:
    """Identify section boundaries based on heading-like lines."""
    sections = []
    current_heading = "__preamble__"
    current_start = 0
    current_lines: list[str] = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        is_heading = False
        if stripped and len(stripped) < 120:
            if stripped.endswith(":") and len(stripped) > 3:
                is_heading = True
            elif stripped.isupper() and len(stripped) > 3 and " " in stripped:
                is_heading = True
            elif re.match(r"^[A-Z][A-Za-z\s/&,]+:$", stripped):
                is_heading = True

        if is_heading:
            if current_lines or current_heading == "__preamble__":
                sections.append({"heading": current_heading, "start": current_start, "lines": current_lines})
            current_heading = stripped.rstrip(":").strip()
            current_start = i
            current_lines = []
        else:
            current_lines.append(stripped)

    sections.append({"heading": current_heading, "start": current_start, "lines": current_lines})
    return sections


def _match_section(heading: str, patterns: list[str]) -> bool:
    """Check if a section heading matches any of the given pattern phrases."""
    heading_lower = heading.lower().strip()
    return any(p in heading_lower for p in patterns)


def _extract_bullet_items(lines: list[str]) -> list[str]:
    """Extract meaningful items from section lines, stripping bullet prefixes."""
    items = []
    for line in lines:
        cleaned = re.sub(r"^[\-\*\u2022\u25cf\u25e6\u25aa\u25b8\u25ba\u2192\d.)\]]+\s*", "", line).strip()
        cleaned = re.sub(r"^[\-\*\u2022\u25cf\u25e6\u25aa\u25b8\u25ba\u2192]+", "", cleaned).strip()
        if cleaned and len(cleaned) > 5:
            items.append(cleaned)
    return items


def extract_sections(job_text: str) -> dict:
    """
    Extract structured sections from job posting text.

    Returns:
        {
            "responsibilities": list[str],
            "qualifications": list[str],
            "preferred_qualifications": list[str],
            "required_zone_text": str,
            "preferred_zone_text": str,
            "warnings": list[str]
        }
    """
    lines = job_text.split("\n")
    sections = _find_sections(lines)

    responsibilities: list[str] = []
    qualifications: list[str] = []
    preferred_qualifications: list[str] = []
    required_zone_text = ""
    preferred_zone_text = ""
    warnings: list[str] = []

    for section in sections:
        heading = section["heading"]
        section_lines = section["lines"]
        section_text = "\n".join(section_lines)

        if _match_section(heading, RESPONSIBILITY_HEADERS):
            responsibilities.extend(_extract_bullet_items(section_lines))
        elif _match_section(heading, QUALIFICATION_HEADERS):
            qualifications.extend(_extract_bullet_items(section_lines))
            required_zone_text += " " + section_text
        elif _match_section(heading, PREFERRED_HEADERS):
            preferred_qualifications.extend(_extract_bullet_items(section_lines))
            preferred_zone_text += " " + section_text

    if not responsibilities and not qualifications:
        warnings.append("no structured sections detected")

    return {
        "responsibilities": responsibilities,
        "qualifications": qualifications,
        "preferred_qualifications": preferred_qualifications,
        "required_zone_text": required_zone_text,
        "preferred_zone_text": preferred_zone_text,
        "warnings": warnings,
    }
