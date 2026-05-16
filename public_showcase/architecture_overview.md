# System Architecture

Hyrra AI is built to provide an extremely fast, localized, and deterministic matching engine while leaning on Large Language Models (LLMs) only for high-level reasoning and enrichment. This architecture guarantees that core functionality (like identifying if a candidate knows Python) is 100% accurate, while leveraging AI for the nuanced task of drafting cover letters.

## Data Flow

### 1. Job Sourcing (Chrome Extension)
- **Extraction**: The MVP Chrome Extension injects a lightweight content script into the active browser tab. It targets the main document body to extract visible job posting text.
- **Verification**: Extracted text is loaded into a popup textarea, allowing the user to clean or edit the payload before submission.
- **Transmission**: The payload is transmitted securely to the local backend API (`POST /v1/jobs`).

### 2. Core Engine (FastAPI)
- **Ingestion**: Normalizes incoming text (lowercasing, punctuation stripping) and routes it to specific parsers.
- **Deterministic Extraction**: Extracts standardized candidate profiles (skills, projects, education) from both Resumes and Jobs. **Crucially, this step does NOT use LLMs.** It uses a heavily optimized, word-boundary-aware regex dictionary to prevent false positives (e.g., ensuring "Java" does not match "JavaScript").
- **Storage Layer**: Persists relational data securely in a local SQLite instance, ensuring no private data leaves the user's machine by default.

### 3. Intelligence Layer
- **Matching Engine**: Computes deterministic match scores between Job profiles and Resume profiles by calculating the mathematical intersection of the extracted skill sets.
- **AI Enrichment**: If the user desires deeper insights, the platform uses an OpenAI BYOK (Bring Your Own Key) integration to generate dynamic features:
  - **Explain Match**: An LLM is provided with the deterministic gap analysis to generate human-readable feedback on strengths, weaknesses, and improvement suggestions.
  - **Generate Cover Letter**: An LLM drafts a highly personalized application based on the intersecting skills.

### 4. Presentation (Next.js Dashboard)
- A unified React interface for tracking saved jobs, managing multiple resumes, reviewing deep match results, and visually moving applications through a Kanban pipeline.

### 5. Apply Agent (Proof of Concept)

An additional layer that takes the output of the intelligence layer and drives a managed browser to pre-fill job application form fields, with every decision gated by safety rules and logged to an audit trail.

```
Chrome Extension (user's normal browser)
  │  Detects controlled application page via DOM marker
  │  Reads field keys, labels, input types, CSS selectors
  │  from data-apply-field attributes (no heuristics, no localStorage)
  ▼
POST /v1/apply-agent/sessions  →  FastAPI Backend
  │  Suggestion cascade:
  │    candidate profile → resume → deterministic regex → AI (BYOK, optional)
  │  Fill plan classification per field:
  │    safe            confidence ≥ 80, profile/deterministic source, needs_review=false
  │    review_required AI/resume-sourced or flagged — drafted but not auto-filled
  │    blocked         select/checkbox/radio, work authorization, sensitive — untouched
  │  Generates OpenClaw task prompt entirely server-side
  ▼
POST /sessions/{id}/run-openclaw-fill  →  OpenClaw subprocess
  │  OpenClaw navigates its isolated managed browser to the target page
  │  Verifies the page marker is present before doing anything
  │  Fills safe fields via keyboard events (React-compatible)
  │  Explicitly instructed: never click Submit, Apply, Next, or Continue
  │  Reports: { session_id, filled: [...], failed: [...], url }
  ▼
Backend logs agent_filled / agent_failed audit entries
User reviews the filled form; no submission occurs
```

## Core Database Entities

The localized SQLite database manages the following entities:

**Original entities:**
- `Job`: A parsed job posting containing required and preferred skills.
- `Resume`: A parsed candidate profile tracking detected skills and word counts.
- `Application`: Tracks the pipeline status (Saved, Applied, Interviewing, Offer) between a specific Job and a Resume.
- `MatchResult`: Stores the computed intersection of skills and the AI-generated reasoning payload.

**Apply Agent entities (added this sprint):**
- `CandidateProfile`: Single structured profile storing identity, education, links, work authorization, and reusable long-answer defaults. Primary source for fill suggestions.
- `ApplyAgentSession`: Ties a candidate profile, job, and optional resume together for one application attempt.
- `ApplyAgentFieldSuggestion`: Per-field suggestion with `suggested_value`, `confidence`, `source`, `needs_review`, `reasoning`, and resolved status.
- `ApplyAgentActionLog`: Append-only log of every agent fill, user accept/edit/skip, and failure. Immutable once written.
