# Hyrra AI — Private Developer Repository

Hyrra AI is an AI-assisted job intelligence and application workflow platform. It combines a FastAPI backend, a Next.js dashboard, and a Chrome extension to help candidates track jobs, review AI-generated field suggestions, and — as of the latest sprint — experiment with human-supervised browser automation for form filling.

This repository contains the full proprietary source code. It is private and not publicly distributed.

---

## Architecture

The project is split into three main components:

- **`backend/`** — FastAPI (Python). Job and resume extraction, candidate profile management, match scoring, cover letter generation, Apply Agent session management, fill-plan generation, and a local OpenClaw subprocess runner.
- **`frontend/`** — Next.js / React / TypeScript. Dashboard for jobs, resumes, matches, candidate profile, and the Apply Agent review interface. Also contains a controlled mock application page used for the OpenClaw proof of concept.
- **`frontend/extension/`** — Chrome extension. Extracts job text from career sites, and detects controlled application pages to launch Apply Agent sessions.

---

## Features

### Core platform
- Parse and store job postings from any career page via the Chrome extension
- Upload and parse resumes (PDF); extract skills, education, and experience
- Match scoring between candidates and jobs
- Cover letter generation (BYOK — bring your own OpenAI key)
- Outreach planning and application workflow tracking
- Candidate Application Profile: single structured profile used as the primary data source for field suggestions

### Apply Agent (proof of concept)
AI-assisted application form filling with mandatory human review at every step.

**Flow:**
1. User opens a controlled mock application page in their normal Chrome browser
2. The Hyrra extension detects the page via `data-hyrra-apply-demo` DOM attributes
3. Extension extracts field keys, labels, input types, and CSS selectors from the page
4. Extension creates an Apply Agent session on the FastAPI backend
5. Backend runs the suggestion cascade: candidate profile → resume → deterministic regex → AI (BYOK, optional)
6. Backend classifies each field into a fill plan:
   - **safe** — high confidence, profile/deterministic source, no review flag; eligible for auto-fill
   - **review_required** — AI-generated or lower-confidence; drafted but flagged for human sign-off
   - **blocked** — select/checkbox/radio inputs, work authorization, or anything sensitive; left untouched
7. User triggers OpenClaw from the extension popup
8. Backend spawns a local OpenClaw subprocess with a server-generated prompt; no client input is passed to the subprocess
9. OpenClaw navigates its own isolated managed browser to the target page and fills safe fields using keyboard events (React-compatible)
10. Backend receives structured JSON output (`filled`, `failed`, `url`) and logs every action to an immutable audit trail
11. User reviews the filled form in the managed browser; no submission occurs

**Human-in-the-loop guarantee:** the user must Accept, Edit, or Skip every field individually in the Hyrra review interface. OpenClaw never touches a Submit button and never interacts with sensitive or low-confidence fields.

---

## Safety Principles

- **No automatic submission.** The demo form's submit button is permanently disabled (`type="button" disabled`). No code path exists that submits a form.
- **Sensitive fields are always blocked.** Work authorization, select/dropdown inputs, checkbox/radio groups, and file uploads are excluded from the fill plan regardless of confidence.
- **Human review is required.** Every field — including safe fields filled by OpenClaw — can be inspected, edited, or overridden in the Hyrra review UI before the session is marked complete.
- **AI-generated answers are always flagged.** Fields with `source: "ai"` always carry `needs_review: true` and are never eligible for auto-fill.
- **BYOK only.** OpenAI API keys are never stored. They are passed in the session request and used only for the duration of that request.
- **Audit log.** Every suggestion, fill action, edit, skip, and agent result is written to an immutable action log that can be queried at any time.

---

## Current Limitations

The Apply Agent is a **proof of concept**, not a production feature.

- **Field-by-field execution is slow.** OpenClaw reasons about each field individually through its managed browser loop. This works but is not efficient for structured fields with known values.
- **Review-required written answers are currently blocked, not draft-filled.** Fields like "Why are you interested in this role?" are skipped entirely rather than draft-filled with an AI suggestion and a visible review marker.
- **Controlled demo page only.** The current implementation targets a fixed mock application page (`/apply-demo/northstar-ev-ai-intern`). Arbitrary real application pages are not yet supported — field detection relies on `data-apply-field` attributes that only exist on the demo page.
- **Separate browser profile.** OpenClaw operates in its own isolated managed Chrome profile, not the user's open browser tab. Filled results are visible there, not in the user's normal window.
- **No multi-step form support.** Forms that span multiple pages or have conditional sections are not yet handled.

---

## Roadmap — Next Direction

- **Deterministic batched filling** for `safe` and `review_required` fields via direct DOM fill (no subprocess latency for known structured values)
- **Visible "AI draft — review required" markers** on draft-filled written-answer fields
- **Add `agent_required` category** for ambiguous, unseen, or dynamically generated fields — OpenClaw handles only these
- **Generalize field detection** to arbitrary application pages using label heuristics, ARIA attributes, and placeholder text matching
- **Multi-step form navigation** support
- **Improved audit log and review UI**
- **Sanitized public showcase / demo repo** (separate from this private repository)

See [`docs/APPLY_AGENT_OPENCLAW_SPRINT_SUMMARY.md`](docs/APPLY_AGENT_OPENCLAW_SPRINT_SUMMARY.md) for the full sprint architecture, implementation details, and OpenClaw setup notes.

---

## Local Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit .env with your values
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`. See `backend/.env.example` for available configuration options including the OpenClaw runner settings.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

### 3. Chrome Extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select the `frontend/extension/` folder.

The extension communicates with the local backend (`http://127.0.0.1:8000`) and dashboard (`http://localhost:3000`).

### 4. OpenClaw (for Apply Agent proof of concept)

OpenClaw requires separate setup. See [`OPENCLAW_SETUP.md`](OPENCLAW_SETUP.md) for the full walkthrough including gateway startup, managed browser configuration, and private-network access settings.

---

## Security

> [!CAUTION]
> - **Do not commit `.env` files.** All API keys and local paths must remain strictly local. `backend/.env` is gitignored.
> - **Do not commit database files.** `job_intelligence.db` and any `.db` file are gitignored and contain personal data.
> - **Do not make this repository public** without removing all local path references and running a full credential scan.
