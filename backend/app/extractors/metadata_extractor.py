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
LOCATION_LABELS = ("location", "office", "work location", "workplace", "job - city", "region")
EMPLOYMENT_TYPE_LABELS = ("employment type", "job type", "type")
WORK_MODE_LABELS = ("work mode", "location type", "workplace type", "work model", "work type")
ALL_METADATA_LABELS = TITLE_LABELS + COMPANY_LABELS + LOCATION_LABELS + EMPLOYMENT_TYPE_LABELS + WORK_MODE_LABELS + (
    "department",
    "team",
    "source",
    "url",
    "page title",
    "job id",
    "work term",
    "application deadline",
    "application method",
    "application email",
    "division",
    "job - province/state",
    "job - country",
    "employment location arrangement",
    "application delivery",
    "if by email, send to",
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

JOB_TITLE_KEYWORDS = (
    "intern",
    "internship",
    "co-op",
    "coop",
    "engineer",
    "developer",
    "analyst",
    "product",
    "manager",
    "designer",
    "data",
    "software",
    "backend",
    "frontend",
    "full stack",
    "machine learning",
    "ai",
    "enablement",
    "associate",
    "specialist",
    "consultant",
    "wealth",
    "business",
    "technology",
    "finance",
    "executive",
    "sales",
    "marketing",
    "operations",
    "coordinator",
    "director",
    "lead",
    "principal",
    "architect",
    "administrator",
    "representative",
    "customer",
    "solutions",
    "security",
    "devops",
    "qa",
    "research",
    "scientist",
)

BAD_TITLE_VALUES = {
    "careers",
    "jobs",
    "home",
    "candidate home",
    "search jobs",
    "search for jobs",
    "job alerts",
    "why choose us",
    "settings",
    "english",
    "view application",
    "applied for this job",
    "read more",
    "accessibility",
    "faq",
    "labor posters",
    "our values",
    "job posting",
    "job description",
    "description",
    "department",
    "team",
    "location",
    "work mode",
    "employment type",
    "td careers",
    "td",
    "waterlooworks",
    "swap_vert",
    "co-op jobs",
    "university of waterloo - myaccount - co-op jobs - employer-student direct - jobs",
}

BODY_SENTENCE_STARTERS = ("as a", "you will", "we are", "our", "about")
RESPONSIBILITY_TITLE_BLOCKLIST = (
    "write",
    "build",
    "develop",
    "design",
    "support",
    "collaborate",
    "manage",
    "analyze",
    "create",
)
SECTION_HEADING_WORDS = (
    "about",
    "overview",
    "responsibilities",
    "qualifications",
    "requirements",
    "benefits",
    "what you will do",
    "what you'll do",
)


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


def _line_label_value_loose(line: str, labels: tuple[str, ...]) -> str:
    """Extract values from source text that lost colon separators."""
    for label in sorted(labels, key=len, reverse=True):
        pattern = rf"^\s*{re.escape(label)}\s+(.+?)\s*$"
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


def _normalize_compare(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().lower()


def _has_title_keyword(value: str) -> bool:
    lower = _normalize_compare(value)
    return any(re.search(rf"\b{re.escape(keyword)}\b", lower) for keyword in JOB_TITLE_KEYWORDS)


def _company_title_variants(company: str) -> set[str]:
    company_lower = _normalize_compare(company)
    if not company_lower:
        return set()
    return {
        company_lower,
        f"{company_lower} careers",
        f"{company_lower} jobs",
    }


def _is_bad_title_candidate(value: str, company: str = "") -> bool:
    """Return True for career portal, navigation, or body-copy title candidates."""
    cleaned = _clean_metadata_value(value)
    if not cleaned or len(cleaned) < 5 or len(cleaned) > 160:
        return True

    lower = _normalize_compare(cleaned)
    if lower in BAD_TITLE_VALUES or lower in _company_title_variants(company):
        return True
    if lower.endswith("myaccount - co-op jobs - employer-student direct - jobs"):
        return True
    if "you applied for this job" in lower:
        return True
    if lower.endswith("careers") and not _has_title_keyword(cleaned):
        return True
    if lower.startswith(BODY_SENTENCE_STARTERS):
        return True

    sentence_punctuation_count = len(re.findall(r"[.!?]", cleaned))
    word_count = len(re.findall(r"\b[\w'/-]+\b", cleaned))
    if sentence_punctuation_count > 1:
        return True
    if re.search(r"[.!?]\s+\S", cleaned) and word_count > 10:
        return True

    punctuation_count = len(re.findall(r"[,;:|/\\()\[\]{}]", cleaned))
    if punctuation_count > max(6, len(cleaned) // 12):
        return True

    return False


def _is_valid_job_title(value: str, company: str = "", *, explicit_label: bool = False) -> bool:
    """Validate likely role titles while rejecting nav labels and body sentences."""
    cleaned = _clean_metadata_value(value)
    if _is_bad_title_candidate(cleaned, company):
        return False

    word_count = len(re.findall(r"\b[\w'/-]+\b", cleaned))
    has_title_keyword = _has_title_keyword(cleaned)
    has_season_or_year = bool(re.search(r"\b(fall|winter|spring|summer|20\d{2}|co[-\s]?op|coop|intern)\b", cleaned, re.IGNORECASE))

    if word_count > 18 and not has_title_keyword:
        return False
    if any(re.search(rf"\b{re.escape(verb)}\b", cleaned, re.IGNORECASE) for verb in RESPONSIBILITY_TITLE_BLOCKLIST):
        if not has_title_keyword:
            return False

    return has_title_keyword or has_season_or_year or (explicit_label and word_count <= 8)


def _page_title_candidate(value: str, company: str = "") -> str:
    """Extract the role-looking side of a document title, e.g. before '| TD Careers'."""
    cleaned = _clean_metadata_value(value)
    if not cleaned:
        return ""
    for part in re.split(r"\s*[|\u2013\u2014]\s*", cleaned):
        part = _clean_metadata_value(part)
        if _is_valid_job_title(part, company):
            return part
    return cleaned if _is_valid_job_title(cleaned, company) else ""


def _extract_title_from_labeled_metadata(text: str, company: str = "") -> str:
    """Extract explicit Title/Job Title/Position/Role only if the value is valid."""
    posting_match = re.search(r"job posting:\s*\d+\s*-\s*position:\s*(.+)", text, re.IGNORECASE)
    if posting_match:
        posting_title = _clean_metadata_value(posting_match.group(1))
        if _is_valid_job_title(posting_title, company, explicit_label=True):
            return posting_title

    lines = text.splitlines()
    normalized_labels = {label.lower() for label in TITLE_LABELS}

    for index, line in enumerate(lines):
        value = _line_label_value(line, TITLE_LABELS) or _line_label_value_loose(line, TITLE_LABELS)
        if value and _is_valid_job_title(value, company, explicit_label=True):
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
            if _is_valid_job_title(candidate, company, explicit_label=True):
                return candidate
            break

    return ""


def _score_title_candidate(value: str, *, index: int, company: str = "", from_page_title: bool = False) -> int:
    if not _is_valid_job_title(value, company):
        return -10_000

    score = 0
    cleaned = _clean_metadata_value(value)
    lower = cleaned.lower()
    word_count = len(re.findall(r"\b[\w'/-]+\b", cleaned))

    if 8 <= len(cleaned) <= 140:
        score += 25
    if re.search(r"[()]", cleaned):
        score += 15
    if re.search(r"\b(fall|winter|spring|summer|20\d{2}|intern|co[-\s]?op|coop)\b", cleaned, re.IGNORECASE):
        score += 30
    for keyword in JOB_TITLE_KEYWORDS:
        if re.search(rf"\b{re.escape(keyword)}\b", lower):
            score += 12
    if from_page_title:
        score += 10
    if word_count <= 2:
        score -= 15
    if re.search(r"\bcareers?\b", cleaned, re.IGNORECASE) and not _has_title_keyword(cleaned):
        score -= 120

    return score - index


def _extract_title_from_heading_candidates(text: str, company: str = "") -> str:
    """Scan early normalized text for role-title lines when explicit metadata is bad."""
    candidates: list[tuple[int, str]] = []
    lines = [_clean_metadata_value(line) for line in text.splitlines()]
    non_empty_lines = [line for line in lines if line]

    for index, line in enumerate(non_empty_lines[:50]):
        lower = line.lower()

        page_title_value = _line_label_value(line, ("page title",))
        if page_title_value:
            page_title = _page_title_candidate(page_title_value, company)
            if page_title:
                candidates.append((_score_title_candidate(page_title, index=index, company=company, from_page_title=True), page_title))
            continue

        if lower in ALL_METADATA_LABELS or _is_metadata_label_line(line):
            continue
        if any(lower.startswith(section) for section in SECTION_HEADING_WORDS):
            break

        if _is_valid_job_title(line, company):
            candidates.append((_score_title_candidate(line, index=index, company=company), line))

    if not candidates:
        return ""

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1] if candidates[0][0] > -10_000 else ""


def _extract_labeled_field(text: str, labels: tuple[str, ...]) -> str:
    """Extract the first non-empty labeled value from a line or following line."""
    lines = text.splitlines()
    normalized_labels = {label.lower() for label in labels}

    for index, line in enumerate(lines):
        value = _line_label_value(line, labels) or _line_label_value_loose(line, labels)
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
    city = _extract_labeled_field(text, ("job - city",))
    province = _extract_labeled_field(text, ("job - province/state",))
    country = _extract_labeled_field(text, ("job - country",))
    if city and province:
        return f"{city}, {province}"
    if city:
        return f"{city}, {country}" if country and country.lower() not in {"canada", "ca"} else city

    for line in text.splitlines():
        value = _line_label_value(line, LOCATION_LABELS)
        if value and _is_valid_location(value, explicit_label=True):
            return value

    labeled_value = _extract_labeled_field(text, LOCATION_LABELS)
    if labeled_value and _is_valid_location(labeled_value, explicit_label=True):
        return re.sub(r"^[A-Z]{2}\s+-\s+", "", labeled_value)

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


def _is_bad_company_candidate(value: str) -> bool:
    cleaned = _normalize_compare(value)
    return cleaned in {"waterlooworks", "swap_vert", "university of waterloo - myaccount", "co-op jobs", "jobs"}


def _extract_company(text: str) -> str:
    company = _extract_labeled_field(text, ("company", "company name", "employer", "org"))
    organization = _extract_labeled_field(text, ("organization",))
    if organization:
        if not company or _is_bad_company_candidate(company):
            return organization
    return "" if _is_bad_company_candidate(company) else company


def _extract_extra_metadata(text: str) -> dict:
    job_id_match = re.search(r"job posting:\s*(\d+)", text, re.IGNORECASE)
    return {
        "work_mode": _extract_work_mode(text) or _extract_labeled_field(text, ("employment location arrangement",)),
        "work_term": _extract_labeled_field(text, ("work term",)),
        "application_deadline": _extract_labeled_field(text, ("application deadline", "app deadline")),
        "application_method": _extract_labeled_field(text, ("application method", "application delivery")),
        "application_email": _extract_labeled_field(text, ("application email", "if by email, send to")),
        "job_id": _extract_labeled_field(text, ("job id",)) or (job_id_match.group(1) if job_id_match else ""),
    }


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

    company = _extract_company(job_text)
    title = _extract_title_from_labeled_metadata(job_text, company)
    if not title:
        title = _extract_title_from_heading_candidates(job_text, company)
    location = _extract_location(job_text)
    employment_type = _extract_employment_type(job_text)
    extra_metadata = {key: value for key, value in _extract_extra_metadata(job_text).items() if value}

    if not title:
        warnings.append("could not extract job title")
    if not company:
        warnings.append("could not extract company name")

    return {
        "title": title,
        "company": company,
        "location": location,
        "employment_type": employment_type,
        **extra_metadata,
        "warnings": warnings,
    }
