"""Mock contact discovery provider.

Returns realistic test contacts without calling external APIs or producing
real personal contact data.
"""


SAFE_EMAIL_DOMAIN = "example.com"
NO_EMAIL_DOMAIN = "no-email.example.com"


class MockContactProvider:
    """Generate ranked, fake contact candidates for product testing."""

    provider_name = "mock"

    def search(
        self,
        *,
        company: str,
        role_title: str,
        location: str,
        employment_type: str,
        job_profile: dict,
        max_results: int,
        target_titles: list[str] | None = None,
    ) -> list[dict]:
        company_name = company or job_profile.get("company") or "Unknown Company"
        title = role_title or job_profile.get("title") or "Open Role"
        context = self._context_text(title, employment_type, job_profile)

        candidates = []
        if self._is_student_role(context):
            candidates.extend(
                [
                    self._candidate(
                        "Avery Morgan",
                        "Campus Recruiter",
                        company_name,
                        95,
                        "Campus recruiters are often relevant for internship, co-op, and student roles.",
                        title,
                    ),
                    self._candidate(
                        "Jordan Lee",
                        "University Recruiter",
                        company_name,
                        95,
                        "University recruiters commonly support early-career and student hiring pipelines.",
                        title,
                        email=None,
                    ),
                    self._candidate(
                        "Taylor Chen",
                        "Early Talent Recruiter",
                        company_name,
                        95,
                        "Early talent recruiters are often the best first outreach target for co-op and internship postings.",
                        title,
                    ),
                    self._candidate(
                        "Riley Patel",
                        "Talent Acquisition Specialist",
                        company_name,
                        88,
                        "Talent acquisition specialists can often route candidates to the right recruiting owner.",
                        title,
                        email=None,
                    ),
                    self._candidate(
                        "Casey Nguyen",
                        "Technical Recruiter",
                        company_name,
                        88,
                        "Technical recruiters are often involved when the role has engineering or technical requirements.",
                        title,
                    ),
                ]
            )

        if self._is_engineering_role(context):
            candidates.extend(
                [
                    self._candidate(
                        "Morgan Smith",
                        "Engineering Manager",
                        company_name,
                        82,
                        "Engineering managers can be relevant outreach contacts for technical roles on their teams.",
                        title,
                        email=None,
                    ),
                    self._candidate(
                        "Jamie Rivera",
                        "Software Engineering Manager",
                        company_name,
                        82,
                        "Software engineering managers may understand the team needs behind software roles.",
                        title,
                    ),
                    self._candidate(
                        "Sam Brooks",
                        "Technical Lead",
                        company_name,
                        82,
                        "Technical leads can be useful contacts when the posting emphasizes hands-on engineering skills.",
                        title,
                        email=None,
                    ),
                ]
            )

        if self._is_product_data_ai_role(context):
            candidates.extend(
                [
                    self._candidate(
                        "Priya Shah",
                        "Product Manager",
                        company_name,
                        78,
                        "Product managers may be relevant when the role connects engineering work with product outcomes.",
                        title,
                        email=None,
                    ),
                    self._candidate(
                        "Alex Kim",
                        "AI/ML Lead",
                        company_name,
                        78,
                        "AI/ML leads are likely relevant when the posting emphasizes machine learning or AI systems.",
                        title,
                    ),
                    self._candidate(
                        "Drew Wilson",
                        "Data Science Manager",
                        company_name,
                        78,
                        "Data science managers may be useful outreach contacts for data-heavy roles.",
                        title,
                        email=None,
                    ),
                    self._candidate(
                        "Quinn Garcia",
                        "Head of Product",
                        company_name,
                        78,
                        "Heads of product can be relevant for product-focused roles or smaller product organizations.",
                        title,
                    ),
                ]
            )

        if self._is_startupish(context, company_name):
            candidates.extend(
                [
                    self._candidate(
                        "Robin Blake",
                        "Founder",
                        company_name,
                        75,
                        "Founders are often practical outreach contacts at small or startup-like companies.",
                        title,
                        email=None,
                    ),
                    self._candidate(
                        "Emery Davis",
                        "CTO",
                        company_name,
                        75,
                        "CTOs can be relevant for technical roles at small engineering organizations.",
                        title,
                    ),
                    self._candidate(
                        "Skyler Moore",
                        "Head of Engineering",
                        company_name,
                        75,
                        "Heads of engineering can help route technical candidates at smaller companies.",
                        title,
                        email=None,
                    ),
                ]
            )

        if not candidates:
            candidates.append(
                self._candidate(
                    "Harper Green",
                    "People Operations Contact",
                    company_name,
                    50,
                    "A generic people operations contact may help route outreach when no stronger contact category is obvious.",
                    title,
                    email=None,
                )
            )

        ranked = self._rank(candidates, target_titles)
        return ranked[:max_results]

    def _candidate(
        self,
        name: str,
        title: str,
        company: str,
        confidence_score: int,
        discovery_reason: str,
        role_title: str,
        email: str | None = "safe",
    ) -> dict:
        safe_email = None
        if email == "safe":
            local_part = title.lower().replace("/", "").replace(" ", ".").replace("-", ".")
            safe_email = f"{local_part}@{SAFE_EMAIL_DOMAIN}"

        return {
            "name": name,
            "title": title,
            "company": company,
            "email": safe_email,
            "linkedin_url": None,
            "source": self.provider_name,
            "confidence_score": confidence_score,
            "discovery_reason": discovery_reason,
            "recommended_message_angle": (
                f"Briefly connect your most relevant projects or experience to the {role_title} role "
                "and ask whether they are the right person to contact."
            ),
        }

    def _rank(self, candidates: list[dict], target_titles: list[str] | None) -> list[dict]:
        terms = [term.lower().strip() for term in (target_titles or []) if term and term.strip()]

        def score(candidate: dict) -> tuple[int, int]:
            title = (candidate.get("title") or "").lower()
            target_match = 1 if any(term in title for term in terms) else 0
            return (target_match, candidate.get("confidence_score") or 0)

        return sorted(candidates, key=score, reverse=True)

    def _context_text(self, title: str, employment_type: str, job_profile: dict) -> str:
        parts = [title, employment_type]
        for key in (
            "work_term",
            "required_skills",
            "preferred_skills",
            "responsibilities",
            "qualifications",
            "keywords",
        ):
            value = job_profile.get(key)
            if isinstance(value, list):
                parts.extend(str(item) for item in value)
            elif value:
                parts.append(str(value))
        return " ".join(parts).lower()

    def _is_student_role(self, context: str) -> bool:
        terms = ("intern", "internship", "co-op", "coop", "student", "new grad", "early talent")
        return any(term in context for term in terms)

    def _is_engineering_role(self, context: str) -> bool:
        terms = (
            "software",
            "engineer",
            "developer",
            "full-stack",
            "backend",
            "frontend",
            "platform",
            "technical",
        )
        return any(term in context for term in terms)

    def _is_product_data_ai_role(self, context: str) -> bool:
        terms = (
            "product",
            "data",
            "machine learning",
            "ml",
            "ai",
            "analytics",
            "science",
        )
        return any(term in context for term in terms)

    def _is_startupish(self, context: str, company: str) -> bool:
        company_text = company.lower()
        terms = ("startup", "founding", "founder", "seed", "series a", "small team")
        company_terms = ("labs", "studio", "ventures")
        return any(term in context for term in terms) or any(term in company_text for term in company_terms)
