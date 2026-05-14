"""
AI outreach message generation service.

Generates concise outreach drafts from known job, contact, resume, and
match context. This service does not discover contacts or send messages.
"""

import json
import re

from openai import OpenAI


_OUTREACH_SYSTEM_PROMPT = (
    "You are an expert internship/job-search outreach writer helping a student write "
    "thoughtful, targeted outreach. You do not invent facts. You write concise messages "
    "grounded in the provided job, resume, match, and contact context. Return valid JSON only."
)

_OUTREACH_OUTPUT_SCHEMA = """{
  "subject": "string or null",
  "body": "string"
}"""

_PLACEHOLDER_PATTERNS = (
    r"\[[^\]]+\]",
    r"\{name\}",
    r"\{company\}",
    r"\{role\}",
)


def _strip_json_fences(raw: str) -> str:
    """Strip common markdown code fences from JSON output."""
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _clean_generated_text(text: str | None) -> str:
    """Remove obvious template artifacts and normalize whitespace."""
    cleaned = (text or "").strip()
    for pattern in _PLACEHOLDER_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned.strip()


def _assert_no_placeholders(text: str) -> None:
    """Reject unresolved placeholders and bracketed template text."""
    lowered = text.lower()
    if "[" in text or "]" in text:
        raise RuntimeError("AI outreach generation failed.")
    if any(token in lowered for token in ("[name]", "[company]", "[role]", "{name}", "{company}", "{role}")):
        raise RuntimeError("AI outreach generation failed.")


def _contact_to_context(contact) -> dict | None:
    if contact is None:
        return None
    return {
        "name": contact.name,
        "title": contact.title,
        "company": contact.company,
        "email": contact.email,
        "linkedin_url": contact.linkedin_url,
        "source": contact.source,
        "notes": contact.notes,
    }


def generate_outreach_message(
    *,
    job_profile: dict,
    job_raw_text: str,
    contact,
    resume_profile: dict | None,
    match_summary: dict | None,
    message_type: str,
    api_key: str,
    extra_context: str | None = None,
) -> dict:
    """
    Generate an outreach message draft using OpenAI.

    Returns:
        {"subject": str | None, "body": str}

    Raises:
        ValueError: If api_key is missing.
        RuntimeError: If generation or parsing fails.
    """
    if not api_key or not api_key.strip():
        raise ValueError("Missing OpenAI API key.")

    user_prompt = f"""Generate a targeted outreach message.

MESSAGE TYPE:
{message_type}

JOB CONTEXT:
{json.dumps({
    "title": job_profile.get("title"),
    "company": job_profile.get("company"),
    "location": job_profile.get("location"),
    "employment_type": job_profile.get("employment_type"),
    "required_skills": job_profile.get("required_skills", []),
    "preferred_skills": job_profile.get("preferred_skills", []),
    "responsibilities": job_profile.get("responsibilities", [])[:5],
}, indent=2)}

JOB RAW TEXT EXCERPT:
{(job_raw_text or "")[:2500]}

CONTACT CONTEXT:
{json.dumps(_contact_to_context(contact), indent=2)}

RESUME CONTEXT:
{json.dumps(resume_profile, indent=2) if resume_profile else "null"}

MATCH CONTEXT:
{json.dumps(match_summary, indent=2) if match_summary else "null"}

EXTRA CONTEXT:
{extra_context or "None"}

RULES:
- Return valid JSON only.
- Output exactly this schema: {_OUTREACH_OUTPUT_SCHEMA}
- Do not include placeholders.
- Do not include bracketed template text.
- Do not use [Name], [Company], [Role], {{name}}, {{company}}, or {{role}}.
- Do not fabricate personal connections.
- Do not invent company facts.
- Do not invent recruiter relationships, referrals, or personal connections.
- Do not overstate experience.
- Do not claim prior conversation or prior sent outreach unless EXTRA CONTEXT explicitly says so.
- Do not claim the student already applied unless EXTRA CONTEXT explicitly says they applied.
- Base claims only on supplied job, resume, match, and contact context.
- Avoid "I hope this email finds you well."
- Keep the tone confident, student/internship appropriate, practical, and specific.

MESSAGE-SPECIFIC RULES:
- email: include a subject and a 120-180 word body. Start with "Hi " followed by the contact name if available, otherwise "Hi team,". Mention the job title/company, 1-2 relevant projects/skills if resume context exists, and ask for a brief conversation, referral consideration, or whether they are the right person.
- linkedin_dm: set subject to null. Write 50-90 words, casual but professional, no long paragraphs.
- follow_up: keep it shorter than an initial email. Only say "I wanted to follow up on my note" if EXTRA CONTEXT says prior outreach exists.
- referral_request: be polite and low-pressure. Explain interest in the role and ask if the contact would be open to pointing the student in the right direction or considering a referral."""

    client = OpenAI(api_key=api_key.strip())

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _OUTREACH_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
        )
        raw = _strip_json_fences(resp.choices[0].message.content or "")
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise RuntimeError("AI outreach generation failed.")
    except json.JSONDecodeError:
        raise RuntimeError("AI outreach generation failed.")
    except Exception:
        raise RuntimeError("AI outreach generation failed.")

    subject = parsed.get("subject")
    body = _clean_generated_text(parsed.get("body"))
    if not body:
        raise RuntimeError("AI outreach generation failed.")

    if message_type == "linkedin_dm":
        subject = None
    elif subject is not None:
        subject = _clean_generated_text(str(subject))

    _assert_no_placeholders(body)
    if subject:
        _assert_no_placeholders(subject)

    return {
        "subject": subject or None,
        "body": body,
    }
