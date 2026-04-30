"""
Cover letter generation service.

Uses OpenAI API with BYOK (Bring Your Own Key) pattern.
"""

from openai import OpenAI


def generate_cover_letter(*, job: dict, resume_text: str, api_key: str | None = None) -> str:
    """
    Generate a tailored cover letter for a job posting using OpenAI.

    Args:
        job: Dict with at least 'job_title', 'organization', and 'job_text' keys.
        resume_text: The applicant's resume as plain text.
        api_key: OpenAI API key (required, BYOK).

    Returns:
        The generated cover letter as a string.

    Raises:
        ValueError: If api_key is missing or empty.
    """
    if not api_key or not api_key.strip():
        raise ValueError("Missing OpenAI API key.")

    client = OpenAI(api_key=api_key.strip())
    prompt = f"""
Write a tailored, professional cover letter.

Job Title: {job.get("job_title","")}
Organization: {job.get("organization","")}

JOB POSTING:
{job.get("job_text","")}

RESUME:
{resume_text}

Keep it concise, specific, and impact-focused. Avoid filler.
"""
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content.strip()
