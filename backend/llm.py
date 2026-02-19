import os
from openai import OpenAI


def generate_cover_letter(*, job: dict, resume_text: str, api_key: str | None = None) -> str:
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
