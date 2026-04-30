"""
Skill extraction — broad dictionary with word-boundary-aware matching.

Uses regex word boundaries to avoid false positives like:
- "java" matching "javascript"
- "scala" matching "scalable"
- "go" matching common English

Special handling for keywords with non-word characters (C++, C#, CI/CD).
"""

import re


# ---------------------------------------------------------------------------
# Skills dictionary — ~50 skills across 7 categories
# ---------------------------------------------------------------------------

SKILLS_DICTIONARY: dict[str, list[str]] = {
    # Programming languages
    "Python": ["python"],
    "JavaScript": ["javascript"],
    "TypeScript": ["typescript"],
    "Java": ["java"],
    "C++": ["c++", "cpp"],
    "C#": ["c#", "csharp"],
    "Go": ["golang"],
    "Rust": ["rust"],
    "Ruby": ["ruby"],
    "PHP": ["php"],
    "Swift": ["swift"],
    "Kotlin": ["kotlin"],
    "R": ["r programming", "r language", "rstudio", "r studio"],
    "Scala": ["scala"],

    # Web frameworks & libraries
    "React": ["react"],
    "Next.js": ["next.js", "nextjs"],
    "Angular": ["angular"],
    "Vue.js": ["vue.js", "vuejs"],
    "Node.js": ["node.js", "nodejs"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
    "Express.js": ["express.js", "expressjs"],
    "Spring": ["spring boot", "spring framework"],

    # Data & ML
    "SQL": ["sql"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb", "mongo"],
    "SQLite": ["sqlite"],
    "Redis": ["redis"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "TensorFlow": ["tensorflow"],
    "PyTorch": ["pytorch"],
    "Machine Learning": ["machine learning"],
    "Deep Learning": ["deep learning"],
    "NLP": ["natural language processing", "nlp"],
    "Computer Vision": ["computer vision"],
    "Data Analysis": ["data analysis", "data analytics"],
    "Data Engineering": ["data engineering", "data pipeline"],
    "ETL": ["etl"],

    # BI & Visualization
    "Excel": ["excel"],
    "Power BI": ["power bi", "powerbi"],
    "Tableau": ["tableau"],
    "Looker": ["looker"],

    # DevOps & Cloud
    "Git": ["git", "github", "gitlab", "version control"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "Azure": ["azure"],
    "GCP": ["gcp", "google cloud"],
    "CI/CD": ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
    "Terraform": ["terraform"],
    "Linux": ["linux"],

    # Tools & Platforms
    "Jira": ["jira"],
    "Figma": ["figma"],
    "Confluence": ["confluence"],
    "Salesforce": ["salesforce"],

    # Soft skills & business
    "Communication": ["communication skills", "strong communication",
                       "written and verbal", "verbal and written"],
    "Stakeholder Management": ["stakeholder", "cross-functional"],
    "Documentation": ["documentation", "technical writing"],
    "Project Management": ["project management", "project coordination"],
    "Process Improvement": ["process improvement"],
    "Testing": ["unit testing", "integration testing", "test-driven",
                "quality assurance"],
    "Debugging": ["debugging", "troubleshooting"],
    "APIs": ["rest api", "restful", "api development", "api integration"],
    "Automation": ["automation", "automated"],
    "Agile": ["agile", "scrum", "kanban", "sprint"],
}

# Keywords that need special matching (contain non-word chars like +, #, /)
_SPECIAL_CHAR_KEYWORDS = {"c++", "c#", "ci/cd", "next.js", "node.js",
                          "vue.js", "express.js"}


# ---------------------------------------------------------------------------
# Matching logic
# ---------------------------------------------------------------------------

def _keyword_in_text(keyword: str, text_lower: str) -> bool:
    """
    Check if a skill keyword is present in text.

    Uses word-boundary regex for normal keywords to prevent false positives.
    Uses literal substring matching for keywords with special characters.
    """
    # Special characters like +, #, / break regex word boundaries
    if keyword in _SPECIAL_CHAR_KEYWORDS:
        return keyword in text_lower

    # Word boundary matching prevents:
    # - "java" matching "javascript"
    # - "scala" matching "scalable"
    # - "rust" matching "frustrating" (etc.)
    pattern = r"\b" + re.escape(keyword) + r"\b"
    return bool(re.search(pattern, text_lower))


def _detect_skills_in_zone(text_lower: str) -> list[str]:
    """Find all skills from the dictionary present in the given text zone."""
    found = []
    for skill_name, keywords in SKILLS_DICTIONARY.items():
        for kw in keywords:
            if _keyword_in_text(kw, text_lower):
                found.append(skill_name)
                break
    return found


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_skills(text: str) -> list[str]:
    """
    Detect all skills present in the given text.

    Scans the full text against the skills dictionary using word-boundary
    matching. Returns a deduplicated list of skill names found.

    This is the shared entry point for both job and resume skill detection.
    """
    return list(dict.fromkeys(_detect_skills_in_zone(text.lower())))

def extract_skills(
    full_text: str,
    required_zone_text: str = "",
    preferred_zone_text: str = "",
) -> dict:
    """
    Extract skills from job text, separating required vs preferred.

    If required/preferred zone text is provided (from section_extractor),
    skills are classified into required vs preferred based on which zone
    they appear in. Skills found outside both zones default to required.

    If no zone text is provided, all detected skills go to required.

    Returns:
        {
            "required_skills": list[str],
            "preferred_skills": list[str],
            "all_skills": list[str]
        }
    """
    full_lower = full_text.lower()

    if required_zone_text.strip() or preferred_zone_text.strip():
        required_skills = _detect_skills_in_zone(required_zone_text.lower())
        preferred_skills = _detect_skills_in_zone(preferred_zone_text.lower())

        # Skills found in full text but not in either zone → default to required
        all_detected = _detect_skills_in_zone(full_lower)
        already_found = set(required_skills + preferred_skills)
        for skill in all_detected:
            if skill not in already_found:
                required_skills.append(skill)
    else:
        required_skills = _detect_skills_in_zone(full_lower)
        preferred_skills = []

    # Deduplicate while preserving order
    required_skills = list(dict.fromkeys(required_skills))
    preferred_skills = list(dict.fromkeys(preferred_skills))
    all_skills = list(dict.fromkeys(required_skills + preferred_skills))

    return {
        "required_skills": required_skills,
        "preferred_skills": preferred_skills,
        "all_skills": all_skills,
    }
