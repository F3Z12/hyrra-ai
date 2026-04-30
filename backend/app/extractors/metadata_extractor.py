"""
Job metadata extraction: title, company, location, employment type.

Uses conservative, deterministic rules. For metadata, missing is better than
wrong, especially for location.
"""

import re


# ---------------------------------------------------------------------------
# Metadata labels and validation patterns
# ---------------------------------------------------------------------------

TITLE_LABELS = ("title", "job title", "position", "role")
COMPANY_LABELS = ("company", "organization", "employer", "company name", "org")
LOCATION_LABELS = ("location", "office", "work location", "workplace")
EMPLOYMENT_TYPE_LABELS = ("employment type", "job type", "type")
WORK_MODE_LABELS = ("work mode", "location type", "workplace type", "work model", "work type")
ALL_METADATA_LABELS = TITLE_LABELS + COMPANY_LABELS + LOCATION_LABELS + EMPLOYMENT_TYPE_LABELS + WORK_MODE_LABELS + (
    "department",
    "team",
    "source",
    "url",
    "page title",
)

COMPENSATION_LOCATION_BLOCKLIST = (
    "salary",
    "pay",
    "wage",
    "compensation",
    "hourly",
    "range",
    "estimated",
    "benefits",
    "equity",
    "bonus",
    "ca$",
    "$",
    "usd",
    "cad",
    "per hour",
    "annually",
    "yearly",
)

RESPONSIBILITY_LOCATION_BLOCKLIST = (
    "write",
    "build",
    "develop",
    "implement",
    "design",
    "collaborate",
    "maintain",
    "improve",
    "ship",
    "create",
)

VALID_LOCATION_WORD_PATTERNS = (
    r"\bremote\b",
    r"\bhybrid\b",
    r"\bon[-\s]?site\b",
    r"\bonsite\b",
    r"\bwaterloo\b",
    r"\btoronto\b",
    r"\bvancouver\b",
    r"\bmontreal\b",
    r"\bottawa\b",
    r"\bcalgary\b",
    r"\bedmonton\b",
    r"\bsan\s+francisco\b",
    r"\bnew\s+york\b",
    r"\bseattle\b",
    r"\baustin\b",
    r"\bboston\b",
    r"\bchicago\b",
    r"\blos\s+angeles\b",
    r"\bcanada\b",
    r"\bunited\s+states\b",
    r"\bontario\b",
    r"\busa\b",
    r"\bBC\b",
    r"\bQC\b",
    r"\b[A-Z][a-z]+(?:[ -][A-Z][a-z]+)*,\s*(?:[A-Z]{2}|[A-Z][a-z]+|Canada|USA|United States)\b",
    r"\b(?:remote|hybrid|on[-\s]?site|onsite)\s*[-,]\s*[A-Z][A-Za-z]+(?:[ -][A-Z][A-Za-z]+)*\b",
)

VALID_LOCATION_CODE_PATTERNS = (
    r"\bON\b",
    r"\bCA\b",
    r"\bNY\b",
    r"\bBC\b",
    r"\bQC\b",
)

EMPLOYMENT_TYPE_KEYWORDS: dict[str, list[str]] = {
    "Full-time": ["full-time", "full time", "permanent"],
    "Part-time": ["part-time", "part time"],
    "Contract": ["contract", "freelance"],
    "Internship": ["internship", "intern"],
    "Co-op": ["co-op", "coop", "cooperative education"],
    "Temporary": ["temporary", "temp"],
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clean_metadata_value(value: str) -> str:
    """Clean a single metadata value without consuming adjacent lines."""
    value = (value or "").strip()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"^(?:-|:)+\s*", "", value)
    value = re.sub(r"\s*(?:-|:)+$", "", value)
    return value.strip(" \t.,;")


def _line_label_value(line: str, labels: tuple[str, ...]) -> str:
    """Extract a value from one labeled line only."""
    for label in labels:
        pattern = rf"^\s*{re.escape(label)}\s*[:\-\u2013\u2014]\s*(.*?)\s*$"
        match = re.match(pattern, line, re.IGNORECASE)
        if match:
            return _clean_metadata_value(match.group(1))
    return ""


def _is_metadata_label_line(line: str) -> bool:
    cleaned = _clean_metadata_value(line).lower()
    if cleaned in ALL_METADATA_LABELS:
        return True
    return any(
        re.match(rf"^\s*{re.escape(label)}\s*[:\-\u2013\u2014]", line, re.IGNORECASE)
        for label in ALL_METADATA_LABELS
    )


def _extract_labeled_field(text: str, labels: tuple[str, ...]) -> str:
    """Extract the first non-empty labeled value from a line or following line."""
    lines = text.splitlines()
    normalized_labels = {label.lower() for label in labels}

    for index, line in enumerate(lines):
        value = _line_label_value(line, labels)
        if value:
            return value

        normalized_line = _clean_metadata_value(line).lower()
        if normalized_line not in normalized_labels:
            continue

        for next_line in lines[index + 1:index + 5]:
            candidate = _clean_metadata_value(next_line)
            if not candidate:
                continue
            if candidate.lower() in normalized_labels or _is_metadata_label_line(next_line):
                continue
            return candidate
    return ""


def _is_valid_location(value: str, *, explicit_label: bool = False) -> bool:
    """Return True only for explicit geographic, remote, hybrid, or on-site values."""
    cleaned = _clean_metadata_value(value)
    if not cleaned:
        return False
    if len(cleaned) > 120:
        return False

    lower = cleaned.lower()
    if any(blocked in lower for blocked in COMPENSATION_LOCATION_BLOCKLIST):
        return False
    if any(re.search(rf"\b{re.escape(blocked)}\b", lower) for blocked in RESPONSIBILITY_LOCATION_BLOCKLIST):
        return False

    word_count = len(re.findall(r"\b[\w'-]+\b", cleaned))
    has_workplace_token = bool(re.search(r"\b(remote|hybrid|on[-\s]?site|onsite)\b", cleaned, re.IGNORECASE))
    if word_count > 8 and not has_workplace_token:
        return False

    has_known_location_token = (
        any(re.search(pattern, cleaned, re.IGNORECASE) for pattern in VALID_LOCATION_WORD_PATTERNS)
        or any(re.search(pattern, cleaned) for pattern in VALID_LOCATION_CODE_PATTERNS)
    )
    if has_known_location_token:
        return True

    # A short value from an explicit Location label is acceptable even if it is
    # not in the small known-token list. Avoid guessing from unlabeled body text.
    return explicit_label and word_count <= 8


def _extract_location(text: str) -> str:
    """Extract location conservatively. Empty is better than a wrong value."""
    for line in text.splitlines():
        value = _line_label_value(line, LOCATION_LABELS)
        if value and _is_valid_location(value, explicit_label=True):
            return value

    labeled_value = _extract_labeled_field(text, LOCATION_LABELS)
    if labeled_value and _is_valid_location(labeled_value, explicit_label=True):
        return labeled_value

    return ""


def _extract_employment_type(text: str) -> str:
    """Extract explicit employment type first, then fall back to keyword detection."""
    labeled_value = _extract_labeled_field(text, EMPLOYMENT_TYPE_LABELS)
    if labeled_value:
        cleaned = _clean_metadata_value(labeled_value)
        for emp_type, keywords in EMPLOYMENT_TYPE_KEYWORDS.items():
            if any(kw in cleaned.lower() for kw in keywords):
                return cleaned

    return _detect_employment_type(text.lower())


def _extract_work_mode(text: str) -> str:
    """Extract structured work mode if present. Currently not returned separately."""
    value = _extract_labeled_field(text, WORK_MODE_LABELS)
    if value and _is_valid_location(value, explicit_label=True):
        return value
    return ""


def _detect_employment_type(text_lower: str) -> str:
    """Detect employment type from keywords in text."""
    for emp_type, keywords in EMPLOYMENT_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return emp_type
    return ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_metadata(job_text: str) -> dict:
    """
    Extract metadata fields from job posting text.

    Returns:
        {
            "title": str,
            "company": str,
            "location": str,
            "employment_type": str,
            "warnings": list[str]
        }
    """
    warnings: list[str] = []

    title = _extract_labeled_field(job_text, TITLE_LABELS)
    company = _extract_labeled_field(job_text, COMPANY_LABELS)
    location = _extract_location(job_text)
    employment_type = _extract_employment_type(job_text)

    if not title:
        warnings.append("could not extract job title")
    if not company:
        warnings.append("could not extract company name")

    return {
        "title": title,
        "company": company,
        "location": location,
        "employment_type": employment_type,
        "warnings": warnings,
    }
