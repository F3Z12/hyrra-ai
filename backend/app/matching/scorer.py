"""
Deterministic job-resume matching scorer.

Scoring formula:
  1. Required skill coverage  — 60 points
  2. Preferred skill coverage — 25 points
  3. Keyword overlap           — 15 points
  Total max = 100

Recommendation thresholds:
  85-100: Excellent Match
  70-84:  Strong Apply
  55-69:  Possible Apply
  35-54:  Weak Match
  0-34:   Low Fit

No LLM dependency. Fully deterministic.
"""


def _get_recommendation(score: int) -> str:
    """Map a match score to a recommendation label."""
    if score >= 85:
        return "Excellent Match"
    elif score >= 70:
        return "Strong Apply"
    elif score >= 55:
        return "Possible Apply"
    elif score >= 35:
        return "Weak Match"
    else:
        return "Low Fit"


def score_job_resume_match(job_profile: dict, resume_profile: dict) -> dict:
    """
    Score the match between a job profile and a resume profile.

    Args:
        job_profile: Output of extract_job_profile() — must have
            required_skills, preferred_skills, keywords.
        resume_profile: Output of extract_resume_profile() — must have
            skills, keywords.

    Returns:
        {
            "match_score": int,
            "recommendation": str,
            "matched_skills": list[str],
            "missing_required_skills": list[str],
            "missing_preferred_skills": list[str],
            "keyword_overlap": list[str],
            "reasoning": str,
            "suggested_angle": str
        }
    """
    job_required = set(job_profile.get("required_skills", []))
    job_preferred = set(job_profile.get("preferred_skills", []))
    job_keywords = set(job_profile.get("keywords", []))

    resume_skills = set(resume_profile.get("skills", []))
    resume_keywords = set(resume_profile.get("keywords", []))

    # --- 1. Required skill coverage (60 points) ---
    matched_required = job_required & resume_skills
    missing_required = job_required - resume_skills

    if job_required:
        required_score = (len(matched_required) / len(job_required)) * 60
    else:
        # No required skills listed — give partial credit if resume has skills
        required_score = 40 if resume_skills else 20

    # --- 2. Preferred skill coverage (25 points) ---
    matched_preferred = job_preferred & resume_skills
    missing_preferred = job_preferred - resume_skills

    if job_preferred:
        preferred_score = (len(matched_preferred) / len(job_preferred)) * 25
    else:
        # No preferred skills listed — give partial credit
        preferred_score = 15 if resume_skills else 5

    # --- 3. Keyword overlap (15 points) ---
    keyword_overlap = job_keywords & resume_keywords

    if job_keywords:
        keyword_score = min((len(keyword_overlap) / max(len(job_keywords), 1)) * 15, 15)
    else:
        keyword_score = 7

    # --- Total ---
    total_score = int(round(min(max(required_score + preferred_score + keyword_score, 0), 100)))

    # --- All matched skills (required + preferred) ---
    all_matched = sorted(matched_required | matched_preferred)

    # --- Recommendation ---
    recommendation = _get_recommendation(total_score)

    # --- Reasoning ---
    reasoning_parts = []
    if job_required:
        reasoning_parts.append(
            f"Matched {len(matched_required)} of {len(job_required)} required skills"
        )
    if job_preferred:
        reasoning_parts.append(
            f"{len(matched_preferred)} of {len(job_preferred)} preferred skills"
        )
    if missing_required:
        reasoning_parts.append(
            f"Missing required: {', '.join(sorted(missing_required))}"
        )
    if missing_preferred:
        reasoning_parts.append(
            f"Missing preferred: {', '.join(sorted(missing_preferred))}"
        )
    reasoning = ". ".join(reasoning_parts) + "." if reasoning_parts else "No scoring details available."

    # --- Suggested angle ---
    if all_matched:
        angle = f"Emphasize {', '.join(all_matched[:5])} experience."
    else:
        angle = "Focus on transferable skills and willingness to learn."

    return {
        "match_score": total_score,
        "recommendation": recommendation,
        "matched_skills": all_matched,
        "missing_required_skills": sorted(missing_required),
        "missing_preferred_skills": sorted(missing_preferred),
        "keyword_overlap": sorted(keyword_overlap),
        "reasoning": reasoning,
        "suggested_angle": angle,
    }
