# Hyrra AI — Claude Code Instructions

## 1. Project Overview

Hyrra AI is a full-stack AI job intelligence and workflow platform.

- **Backend:** FastAPI (Python), SQLite, OpenAI APIs
- **Frontend:** Next.js, React, TypeScript
- **Extension:** Chrome extension workflow code
- **Existing features:** job posting parsing, candidate/job workflow tracking, match scoring, cover letter generation, outreach and application planning

## 2. Current Sprint Goal

We are building two tightly linked features:

### 2a. Candidate Application Profile
A single structured profile the user fills in once. It stores identity, education, links, work authorization, availability, and reusable short-answer context. This is the **primary data source** for form field suggestions — it must be checked before resume data or AI.

Fields include: `first_name`, `last_name`, `preferred_name`, `email`, `phone`, `location_city`, `location_region`, `country`, `school`, `program`, `degree`, `graduation_month`, `graduation_year`, `gpa_optional`, `linkedin_url`, `github_url`, `portfolio_url`, `personal_website_url`, `other_links_json`, `work_authorization_country`, `authorized_to_work`, `requires_sponsorship`, `available_start_date`, `available_end_date`, `preferred_work_location`, `open_to_remote`, `default_why_interested`, `default_relevant_project`, `default_additional_info`, `default_cover_note`, `top_skills_json`, `top_projects_json`.

Keep profile management simple: create / view / edit a single profile. Do not build multi-profile management or a CRM.

### 2b. Hyrra Apply Agent (V1 — manual review only)
A controlled demo workflow inside the Hyrra frontend with a mock job application form.

**Suggestion priority order (strictly enforced):**
1. Candidate Application Profile — highest trust, use directly
2. Resume parsed/raw data — fallback extraction
3. Job context — inform AI prompts only
4. OpenAI/BYOK — only for longer generated answers (why interested, relevant project, additional info)

It must:
- Present a mock application form with realistic fields
- Map each field to a suggestion using the priority order above
- Show confidence, source, and a reasoning note per field
- Require the user to Accept / Edit / Skip every field individually
- Log every decision to an immutable action log
- Never auto-submit or auto-accept any field

**V2 direction (do not build yet — design for it):**
V2 will use OpenClaw as a browser/workflow operator. OpenClaw is **not** the decision brain — the Hyrra backend is. OpenClaw may only click Accept on fields where:
- `confidence >= 80`
- `needs_review === false`
- `source` is `"profile"` or `"deterministic"`

OpenClaw must never interact with AI-generated fields, select fields, low-confidence fields, or any submit button.

To enable V2 without code changes, all frontend form field cards and Accept buttons must carry stable HTML data attributes from V1 onwards:
- `data-field-key`
- `data-confidence`
- `data-needs-review`
- `data-source`
- `data-agent-action="accept"` on the Accept button

## 3. Safety Rules

- Never implement automatic application submission — no submit button, no form action.
- Never build mass-apply or bulk session behavior.
- Never use real private user data in demos or tests.
- Always flag uncertain generated fields for human review before use.
- Log all suggestions and actions so behavior is auditable.
- The user must remain in control at every step.
- OpenAI API keys are never stored — BYOK pattern only.
- AI-generated fields (`source: "ai"`) must always be flagged `needs_review: true` regardless of confidence.
- OpenClaw (V2) must never generate application answers and must never submit anything.

## 4. Coding Rules

- Prefer small, scoped changes — one concern per task.
- Reuse existing repo patterns (routers, services, models, hooks, components).
- Do not refactor unrelated code as part of a task.
- Do not make broad architecture changes without asking first.
- After each task, summarize which files were changed and why.
- Provide verification commands (curl, npm run, pytest, etc.) after code changes.
- Do not touch secrets, environment files, or deployment config unless explicitly asked.

## 5. Reporting Style

- **Inspection tasks:** read and report only — do not edit files.
- **Implementation tasks:** explain what changed, why it changed, and how to test it.
- Separate must-fix issues from nice-to-have improvements when reviewing or auditing.
