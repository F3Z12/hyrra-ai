"""
Apply Agent suggestion generation service.

Determines the best suggestion for each form field using a priority cascade:
  1. Candidate profile direct field         (source: "profile",       confidence 95)
  2. Profile reusable long-answer default   (source: "profile",       confidence 85, needs_review True)
  3. Resume parsed profile keywords         (source: "resume",        confidence 60, needs_review True)
  4. Deterministic regex extraction         (source: "deterministic", confidence 80)
  5. OpenAI/BYOK — textarea fields only,    (source: "ai",            confidence 70, needs_review True)
     batched into one call
  6. No suggestion                          (source: "none",          confidence 0,  needs_review True)

OpenClaw (V2) may only auto-accept fields where:
  confidence >= 80, needs_review is False, source is "profile" or "deterministic".
"""

import json
import re

from openai import OpenAI


# ---------------------------------------------------------------------------
# Regex patterns for deterministic extraction
# ---------------------------------------------------------------------------

_RE_EMAIL    = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_RE_LINKEDIN = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+", re.IGNORECASE)
_RE_GITHUB   = re.compile(r"(?:https?://)?(?:www\.)?github\.com/[\w\-]+", re.IGNORECASE)
_RE_GRAD_YEAR = re.compile(r"\b(20[12]\d)\b")


# ---------------------------------------------------------------------------
# AI prompt constants  (follows outreach_ai_service.py style)
# ---------------------------------------------------------------------------

_AI_SYSTEM_PROMPT = (
    "You are helping a job applicant fill out an application form. "
    "Generate concise, specific, honest responses grounded in the provided context. "
    "Do not invent projects, skills, or experiences not mentioned in the context. "
    "Do not use placeholder text. Return valid JSON only — no markdown, no code fences."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_json_safe(json_str) -> dict | list | None:
    if not json_str:
        return None
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return None


def _strip_json_fences(raw: str) -> str:
    """Strip common markdown code fences from LLM JSON output."""
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _mk(source: str, value, confidence: int, reasoning: str) -> dict:
    """Build a core suggestion dict. value=None is valid (no suggestion)."""
    return {
        "suggested_value": str(value) if value is not None else None,
        "confidence": confidence,
        "source": source,
        "reasoning": reasoning,
    }


def _normalize_url(raw: str) -> str:
    if raw and not raw.startswith(("http://", "https://")):
        return "https://" + raw
    return raw


def _calculate_needs_review(source: str, confidence: int, field_type: str, field_key: str) -> bool:
    """
    Centralized needs_review logic.  OpenClaw (V2) trusts only fields where
    this returns False, source is "profile" or "deterministic", and confidence >= 80.
    """
    if source == "ai":
        return True
    if confidence < 70:
        return True
    if field_type == "select":
        return True
    # Reusable long-answer defaults always need human review even when sourced from profile
    if field_key in {"why_interested", "relevant_project", "additional_info", "additional_information"}:
        return True
    return False


# ---------------------------------------------------------------------------
# Core per-field suggestion logic
# ---------------------------------------------------------------------------

def _suggest_core(
    field_key: str,
    profile,            # CandidateProfile ORM object
    resume_parsed: dict | None,
    resume_raw: str | None,
    resume_name: str | None,
) -> dict:
    """
    Return a core suggestion dict for one field.

    source "_ai_needed" is a private marker — it is replaced by AI output or
    "none" before the result leaves generate_all_suggestions.
    """

    # ── full_name ──────────────────────────────────────────────────────────
    if field_key == "full_name":
        fn = (profile.first_name or "").strip()
        ln = (profile.last_name or "").strip()
        if fn and ln:
            return _mk("profile", f"{fn} {ln}", 95, "From your candidate profile.")
        if fn:
            return _mk("profile", fn, 80, "From your candidate profile (last name not set).")
        if resume_name:
            return _mk("resume", resume_name, 85, "From your resume name.")

    # ── email ──────────────────────────────────────────────────────────────
    elif field_key == "email":
        if profile.email:
            return _mk("profile", profile.email, 95, "From your candidate profile.")
        if resume_raw:
            m = _RE_EMAIL.search(resume_raw)
            if m:
                return _mk("deterministic", m.group(), 80, "Extracted from resume text.")

    # ── phone ──────────────────────────────────────────────────────────────
    elif field_key == "phone":
        if profile.phone:
            return _mk("profile", profile.phone, 95, "From your candidate profile.")

    # ── school ────────────────────────────────────────────────────────────
    elif field_key == "school":
        if profile.school:
            return _mk("profile", profile.school, 95, "From your candidate profile.")
        if resume_parsed:
            edu = resume_parsed.get("education_keywords", [])
            if edu:
                return _mk("resume", edu[0], 60, "Inferred from resume education section.")

    # ── program ───────────────────────────────────────────────────────────
    elif field_key == "program":
        if profile.program:
            return _mk("profile", profile.program, 95, "From your candidate profile.")
        if resume_parsed:
            edu = resume_parsed.get("education_keywords", [])
            if len(edu) > 1:
                return _mk("resume", edu[1], 60, "Inferred from resume education section.")

    # ── graduation_year / grad_year ────────────────────────────────────────
    elif field_key in ("graduation_year", "grad_year"):
        if profile.graduation_year:
            return _mk("profile", str(profile.graduation_year), 95, "From your candidate profile.")
        search_targets = []
        if resume_parsed:
            search_targets.extend(resume_parsed.get("education_keywords", []))
        if resume_raw:
            search_targets.append(resume_raw)
        for target in search_targets:
            m = _RE_GRAD_YEAR.search(str(target))
            if m:
                return _mk("deterministic", m.group(), 80, "Extracted from resume text.")

    # ── graduation_month ──────────────────────────────────────────────────
    elif field_key == "graduation_month":
        if profile.graduation_month:
            return _mk("profile", str(profile.graduation_month), 95, "From your candidate profile.")

    # ── degree ────────────────────────────────────────────────────────────
    elif field_key == "degree":
        if profile.degree:
            return _mk("profile", profile.degree, 95, "From your candidate profile.")

    # ── linkedin_url ──────────────────────────────────────────────────────
    elif field_key == "linkedin_url":
        if profile.linkedin_url:
            return _mk("profile", profile.linkedin_url, 95, "From your candidate profile.")
        if resume_raw:
            m = _RE_LINKEDIN.search(resume_raw)
            if m:
                return _mk("deterministic", _normalize_url(m.group()), 80, "Extracted from resume text.")

    # ── github_url ────────────────────────────────────────────────────────
    elif field_key == "github_url":
        if profile.github_url:
            return _mk("profile", profile.github_url, 95, "From your candidate profile.")
        if resume_raw:
            m = _RE_GITHUB.search(resume_raw)
            if m:
                return _mk("deterministic", _normalize_url(m.group()), 80, "Extracted from resume text.")

    # ── portfolio_url ─────────────────────────────────────────────────────
    elif field_key == "portfolio_url":
        if profile.portfolio_url:
            return _mk("profile", profile.portfolio_url, 95, "From your candidate profile.")

    # ── personal_website_url ──────────────────────────────────────────────
    elif field_key == "personal_website_url":
        if profile.personal_website_url:
            return _mk("profile", profile.personal_website_url, 95, "From your candidate profile.")

    # ── work_auth / work_authorization ────────────────────────────────────
    elif field_key in ("work_auth", "work_authorization"):
        if profile.authorized_to_work:
            # Always needs_review — select field, too sensitive to auto-accept
            return _mk("profile", profile.authorized_to_work, 85, "From your candidate profile.")

    # ── why_interested ────────────────────────────────────────────────────
    elif field_key == "why_interested":
        if profile.default_why_interested:
            return _mk("profile", profile.default_why_interested, 85,
                        "From your reusable answers. Review before use.")
        return _mk("_ai_needed", None, 0, "")

    # ── relevant_project ─────────────────────────────────────────────────
    elif field_key == "relevant_project":
        if profile.default_relevant_project:
            return _mk("profile", profile.default_relevant_project, 85,
                        "From your reusable answers. Review before use.")
        return _mk("_ai_needed", None, 0, "")

    # ── additional_info / additional_information ──────────────────────────
    elif field_key in ("additional_info", "additional_information"):
        if profile.default_additional_info:
            return _mk("profile", profile.default_additional_info, 85,
                        "From your reusable answers. Review before use.")
        return _mk("_ai_needed", None, 0, "")

    # ── unknown field key or no data matched any case above ───────────────
    return _mk("none", None, 0, "No suggestion available. Enter manually.")


# ---------------------------------------------------------------------------
# AI batch generation  (one call for all textarea fields that need AI)
# ---------------------------------------------------------------------------

def _generate_ai_batch(
    ai_field_keys: list[str],
    job,                    # Job ORM object
    job_parsed: dict | None,
    profile,                # CandidateProfile ORM object
    resume_parsed: dict | None,
    api_key: str,
) -> dict:
    """
    Make one batched OpenAI call for all AI-needed textarea fields.

    Returns a dict mapping field_key → suggested text.
    Returns {} on any failure — session creation never crashes due to AI errors.
    """
    if not ai_field_keys or not api_key or not api_key.strip():
        return {}

    # Build the expected output schema for only the requested fields
    output_schema = json.dumps({k: "..." for k in ai_field_keys}, indent=2)

    # Candidate context
    profile_parts = []
    if profile.first_name or profile.last_name:
        profile_parts.append(f"Name: {(profile.first_name or '')} {(profile.last_name or '')}".strip())
    if profile.school:
        profile_parts.append(f"School: {profile.school}")
    if profile.program:
        profile_parts.append(f"Program: {profile.program}")
    if profile.graduation_year:
        profile_parts.append(f"Graduation: {profile.graduation_year}")
    if profile.top_skills_json:
        parsed_skills = _parse_json_safe(profile.top_skills_json)
        skills_str = ", ".join(parsed_skills) if isinstance(parsed_skills, list) else profile.top_skills_json
        profile_parts.append(f"Top skills: {skills_str}")
    if profile.top_projects_json:
        parsed_projects = _parse_json_safe(profile.top_projects_json)
        if isinstance(parsed_projects, list):
            project_names = [p.get("name", str(p)) if isinstance(p, dict) else str(p) for p in parsed_projects]
            profile_parts.append(f"Top projects: {', '.join(project_names)}")
        else:
            profile_parts.append(f"Top projects: {profile.top_projects_json}")
    if resume_parsed:
        if resume_parsed.get("skills"):
            profile_parts.append(f"Resume skills: {', '.join(resume_parsed['skills'][:10])}")
        if resume_parsed.get("projects"):
            profile_parts.append(f"Resume projects: {'; '.join(resume_parsed['projects'][:3])}")
        if resume_parsed.get("experience_keywords"):
            profile_parts.append(f"Experience: {', '.join(resume_parsed['experience_keywords'][:5])}")

    # Job context
    job_parts = [
        f"Title: {job.title or 'unknown'}",
        f"Company: {job.company or 'unknown'}",
    ]
    if job_parsed:
        if job_parsed.get("required_skills"):
            job_parts.append(f"Required skills: {', '.join(job_parsed['required_skills'][:6])}")
        if job_parsed.get("responsibilities"):
            job_parts.append(f"Key responsibilities: {'; '.join(job_parsed['responsibilities'][:3])}")
    job_parts.append(f"Description excerpt: {(job.raw_text or '')[:1200]}")

    user_prompt = f"""Generate application form responses for this candidate applying to this role.

CANDIDATE:
{chr(10).join(profile_parts) if profile_parts else "No profile context provided."}

JOB:
{chr(10).join(job_parts)}

Generate responses for ONLY these fields: {', '.join(ai_field_keys)}

Return exactly this JSON structure (fill in each value):
{output_schema}

Rules:
- Write in first person as the candidate.
- Be specific to this company and role.
- Keep each response 2-4 sentences.
- Base all claims on the provided context only — do not invent experiences.
- Do not use placeholder text like [Name], [Company], or [Role].
- Do not include JSON keys beyond the ones in the schema above."""

    client = OpenAI(api_key=api_key.strip())

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _AI_SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.7,
        )
        raw = _strip_json_fences(resp.choices[0].message.content or "")
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return {}
        return {k: str(v) for k, v in parsed.items() if k in ai_field_keys and v}
    except Exception:
        # Silently absorb all AI failures — session is still created without AI suggestions
        return {}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_all_suggestions(
    form_fields: list[dict],    # [{"field_key": ..., "label": ..., "field_type": ...}]
    profile,                    # CandidateProfile ORM object
    job,                        # Job ORM object
    resume,                     # Resume ORM object or None
    api_key: str | None = None,
) -> list[dict]:
    """
    Generate one suggestion dict per form field using the priority cascade.

    Each returned dict is ready for direct insertion into apply_agent_field_suggestions.
    """
    resume_parsed = _parse_json_safe(resume.parsed_profile_json) if resume else None
    resume_raw    = resume.raw_text if resume else None
    resume_name   = resume.name     if resume else None
    job_parsed    = _parse_json_safe(job.parsed_profile_json)

    results: list[dict] = []
    ai_pending_keys: list[str] = []

    for field in form_fields:
        key   = field["field_key"]
        label = field["label"]
        ftype = field["field_type"]

        core = _suggest_core(key, profile, resume_parsed, resume_raw, resume_name)

        if core["source"] == "_ai_needed":
            # Placeholder — will be replaced by the AI batch call below
            ai_pending_keys.append(key)
            results.append({
                "field_key": key, "label": label, "field_type": ftype,
                "suggested_value": None, "confidence": 0, "needs_review": True,
                "source": "none",
                "reasoning": "No suggestion available. Enter manually.",
                "_ai_pending": True,
            })
        else:
            nr = _calculate_needs_review(core["source"], core["confidence"], ftype, key)
            results.append({
                "field_key": key, "label": label, "field_type": ftype,
                "suggested_value": core["suggested_value"],
                "confidence": core["confidence"],
                "needs_review": nr,
                "source": core["source"],
                "reasoning": core["reasoning"],
            })

    # Single batched AI call for all pending fields
    if ai_pending_keys and api_key:
        ai_results = _generate_ai_batch(
            ai_pending_keys, job, job_parsed, profile, resume_parsed, api_key
        )
        for r in results:
            if not r.pop("_ai_pending", False):
                continue
            ai_value = ai_results.get(r["field_key"])
            if ai_value:
                r.update({
                    "suggested_value": ai_value,
                    "confidence": 70,
                    "needs_review": True,
                    "source": "ai",
                    "reasoning": "AI-generated. Review before use.",
                })
            # else: leave as source "none" — AI failed for this field
    else:
        # No AI call — clear pending flags, leave as "none"
        for r in results:
            r.pop("_ai_pending", None)

    return results
