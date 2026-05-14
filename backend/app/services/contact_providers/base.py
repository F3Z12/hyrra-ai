"""Base types for contact discovery providers."""

from typing import Protocol


class ContactDiscoveryProvider(Protocol):
    """Provider contract for finding likely outreach contacts."""

    provider_name: str

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
        """Return ranked contact candidates for a job/company."""
