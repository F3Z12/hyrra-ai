"""
AI enrichment service — LLM-powered insights on top of deterministic matching.

Provides structured match explanations and tailored cover letters
using OpenAI (gpt-4o-mini) with BYOK pattern.

This is an OPTIONAL layer. The deterministic scorer remains the default.
AI enrichment is only triggered when explicitly requested via the /v1/ai/ endpoints.
"""

import json
import re

from openai import OpenAI


# ---------------------------------------------------------------------------
# Match explanation
# ---------------------------------------------------------------------------

_EXPLAIN_SYSTEM_PROMPT = (
    "You are an expert career strategist helping a student land competitive internships. "
    "Analyze the job posting, resume, and match results provided and produce highly specific, "
    "practical advice. Avoid generic statements. Respond with VALID JSON ONLY — no markdown, "
    "no code fences, no explanations outside the JSON object."
)

_EXPLAIN_OUTPUT_SCHEMA = """{
  "summary": "One-sentence match assessment",
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "weaknesses": ["Specific gap 1", "Specific gap 2"],
  "improvement_suggestions": ["Actionable suggestion 1", "Actionable suggestion 2"],
  "positioning_strategy": "How to position yourself for this role",
  "resume_bullets": ["Tailored bullet point 1", "Tailored bullet point 2"],
  "cover_letter_angle": "Recommended angle for the cover letter"
}"""


def generate_match_explanation(
    job_profile: dict,
    resume_profile: dict,
    match_result: dict,
    api_key: str,
) -> dict:
    """
    Generate structured AI insights explaining a job-resume match.

    Uses OpenAI gpt-4o-mini to interpret the deterministic match result
    and produce actionable career strategy advice.

    Args:
        job_profile: Extracted job profile dict.
        resume_profile: Extracted resume profile dict.
        match_result: Output of score_job_resume_match().
        api_key: OpenAI API key (BYOK).

    Returns:
        Dict with summary, strengths, weaknesses, suggestions, strategy,
        resume bullets, and cover letter angle.

    Raises:
        ValueError: If api_key is missing.
        RuntimeError: If AI generation fails.
    """
    if not api_key or not api_key.strip():
        raise ValueError("Missing OpenAI API key.")

    user_prompt = f"""Analyze this job-resume match and return the JSON structure shown below.

JOB PROFILE:
{json.dumps(job_profile, indent=2)}

RESUME PROFILE:
{json.dumps(resume_profile, indent=2)}

MATCH RESULT:
{json.dumps(match_result, indent=2)}

Return EXACTLY this JSON structure (fill in the values):
{_EXPLAIN_OUTPUT_SCHEMA}"""

    client = OpenAI(api_key=api_key.strip())

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _EXPLAIN_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        raw = resp.choices[0].message.content.strip()

        # Strip markdown fences if model wraps output
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()
        if raw.startswith("json"):
            raw = raw[4:].strip()

        return json.loads(raw)

    except json.JSONDecodeError:
        raise RuntimeError("AI returned invalid JSON for match explanation.")
    except Exception as e:
        raise RuntimeError(f"AI generation failed: {str(e)}")


# ---------------------------------------------------------------------------
# Tailored cover letter
# ---------------------------------------------------------------------------

_COVER_LETTER_SYSTEM_PROMPT = (
    "You are an expert cover letter writer for competitive tech internships. "
    "Write highly tailored, specific cover letters that demonstrate genuine understanding "
    "of the company and role. Avoid generic phrases like 'I am writing to express my interest'. "
    "Tone: confident, specific, student-level. Length: 200-300 words. "
    "The output must be a complete, submission-ready cover letter with zero template placeholders. "
    "Start strictly with 'Dear Hiring Manager,'. Do not include dates, addresses, bracketed fields, "
    "or placeholders like '[Your Name]', '[City]', or '[Date]'."
)


def _clean_cover_letter_output(text: str) -> str:
    """Enforce no-placeholder cover letter formatting constraints."""
    cleaned = (text or "").strip()
    salutation = "Dear Hiring Manager,"
    salutation_index = cleaned.lower().find(salutation.lower())
    if salutation_index >= 0:
        cleaned = cleaned[salutation_index:].strip()
    else:
        cleaned = f"{salutation}\n\n{cleaned}"

    cleaned = re.sub(r"\[[^\]]+\]", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned.strip()


def generate_tailored_cover_letter(
    job_profile: dict,
    resume_profile: dict,
    match_result: dict,
    api_key: str,
) -> str:
    """
    Generate a tailored cover letter using match intelligence.

    Uses the matched/missing skills and positioning strategy from the
    deterministic scorer to inform the AI-generated cover letter.

    Args:
        job_profile: Extracted job profile dict.
        resume_profile: Extracted resume profile dict.
        match_result: Output of score_job_resume_match().
        api_key: OpenAI API key (BYOK).

    Returns:
        The generated cover letter as a string.

    Raises:
        ValueError: If api_key is missing.
        RuntimeError: If AI generation fails.
    """
    if not api_key or not api_key.strip():
        raise ValueError("Missing OpenAI API key.")

    user_prompt = f"""Write a tailored cover letter for this job application.

COMPANY: {job_profile.get("company", "the company")}
ROLE: {job_profile.get("title", "the position")}
LOCATION: {job_profile.get("location", "")}

JOB REQUIREMENTS:
- Required skills: {", ".join(job_profile.get("required_skills", []))}
- Preferred skills: {", ".join(job_profile.get("preferred_skills", []))}
- Key responsibilities: {"; ".join(job_profile.get("responsibilities", [])[:3])}

MY MATCHING SKILLS: {", ".join(match_result.get("matched_skills", []))}
SKILLS I'M MISSING: {", ".join(match_result.get("missing_required_skills", []))}
MY PROJECTS: {"; ".join(resume_profile.get("projects", [])[:3])}
MY EXPERIENCE: {"; ".join(resume_profile.get("experience_keywords", [])[:3])}

POSITIONING STRATEGY: {match_result.get("suggested_angle", "")}

RULES:
- 200-300 words
- Start strictly with: Dear Hiring Manager,
- DO NOT use placeholders or brackets like [Your Name], [City], [Date], [Company], or [Hiring Manager]
- Do not include sender address, recipient address, city, date, or any fill-in fields
- Be specific to the company and role
- Highlight matched skills with concrete examples from projects/experience
- Address missing skills honestly (show willingness to learn or related experience)
- No generic phrases
- Strong opening, specific middle, confident close
- End with a standard professional sign-off. If the candidate's name is not available in the context, end with 'Sincerely,' and do not invent a name
- The letter must be 100% ready for submission with zero manual fill-in required"""

    client = OpenAI(api_key=api_key.strip())

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _COVER_LETTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.8,
        )
        return _clean_cover_letter_output(resp.choices[0].message.content.strip())

    except Exception as e:
        raise RuntimeError(f"AI generation failed: {str(e)}")
