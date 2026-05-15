# Apply Agent + OpenClaw — Sprint Summary

**Sprint closed:** 2026-05-15  
**Branch:** `main`  
**Status:** Proof of concept working end-to-end locally

---

## High-Level Goal

Build a controlled proof-of-concept for AI-assisted job application form filling.
The Hyrra Chrome extension detects a mock application page, the backend generates a structured fill plan ranked by safety and confidence, and OpenClaw fills only the verified high-confidence fields in an isolated managed browser — without ever clicking Submit.

---

## Final Working Architecture

```
Your normal Chrome (user-facing)
────────────────────────────────
  Demo page: /apply-demo/northstar-ev-ai-intern
  Chrome extension popup (Hyrra AI)
        │
        │  1. detects data-hyrra-apply-demo="true" on the page
        │  2. reads form fields + job ID from DOM attributes
        │  3. POST /v1/apply-agent/sessions  (create session + suggestions)
        │  4. GET  /v1/apply-agent/sessions/{id}/fill-plan  (fill plan)
        │  5. POST /v1/apply-agent/sessions/{id}/run-openclaw-fill
        ▼
  Hyrra backend (FastAPI · port 8000)
  ─────────────────────────────────
  Suggestion cascade:
    profile → resume → deterministic → AI (BYOK, optional)
  Fill plan classification:
    fillable (confidence ≥ 80, needs_review=false, source=profile/deterministic)
    blocked  (everything else)
  Generates OpenClaw prompt entirely server-side
  Spawns: openclaw agent --agent main --message <prompt> --json --timeout <T>
        │
        └──── OpenClaw subprocess ────────────────────►
                                        OpenClaw managed browser
                                        (isolated Chrome profile)
                                        ─────────────────────────
                                        Navigates to target_url
                                        Verifies data-hyrra-apply-demo="true"
                                        Fills fillable fields via keyboard events
                                        Adds .hyrra-review-required marker per field
                                        Reports JSON: { session_id, filled, failed, url }
```

**Key design property:** OpenClaw runs in its own isolated browser profile with no Hyrra extension installed. All fill values come from the backend-generated prompt — OpenClaw does not use `localStorage`, extension APIs, or any client-side state.

---

## Backend — What Was Added / Changed

### New files

| File | Purpose |
|---|---|
| `backend/app/services/apply_agent_fill_plan_service.py` | Classifies suggestions into `fillable` vs `blocked` buckets using the three safety gates (confidence ≥ 80, `needs_review=false`, source in `profile`/`deterministic`). Exports Pydantic schemas `ApplyAgentFillPlanField`, `ApplyAgentBlockedField`, `ApplyAgentFillPlanResponse`. |
| `backend/app/services/openclaw_task_service.py` | Generates the natural-language task prompt passed to OpenClaw. Stays under 4 000 chars to fit within the Windows `cmd.exe` 8 191-char argument limit. Uses single quotes in JS snippets to avoid `cmd.exe` mangling. Handles `localhost` ↔ `127.0.0.1` equivalence. |
| `backend/app/services/openclaw_runner_service.py` | Subprocess runner for OpenClaw. Resolves the binary via `OPENCLAW_BIN` → `shutil.which` → `%APPDATA%\npm` fallbacks. Injects `OPENCLAW_CODEX_APP_SERVER_BIN` explicitly into the subprocess environment. Supports `--message` for short prompts and a temp-file strategy for long prompts. Returns `OpenClawRunResult` dataclass. |

### Modified files

| File | Change |
|---|---|
| `backend/app/api/apply_agent.py` | Added `GET /sessions/{id}/fill-plan` endpoint (returns fill plan + pre-generated OpenClaw prompt). Added `POST /sessions/{id}/run-openclaw-fill` endpoint (dev only, guarded by `ENABLE_LOCAL_OPENCLAW_RUNNER`). Endpoint logs `agent_filled` / `agent_failed` audit entries from the structured JSON result. |
| `backend/app/core/config.py` | Added `ENABLE_LOCAL_OPENCLAW_RUNNER`, `OPENCLAW_MAX_TIMEOUT`, `OPENCLAW_BIN`, `OPENCLAW_CODEX_APP_SERVER_BIN` config vars. Added `python-dotenv` auto-loading so `backend/.env` is always read without `--env-file`. Added `127.0.0.1:3000` to `CORS_ORIGINS` (OpenClaw's managed browser treats it as a distinct origin from `localhost:3000`). |

### Pre-existing files (unchanged this sprint)

`apply_agent_service.py`, `apply_agent_suggestion_service.py`, `candidate_profile_service.py`, `database/models.py` — all carry the session/suggestion/action-log data model introduced in the prior sprint.

---

## Frontend / Demo Page — What Was Added / Changed

### New files

| File | Purpose |
|---|---|
| `frontend/app/apply-demo/northstar-ev-ai-intern/page.tsx` | Mock application form for "Northstar EV Systems — AI Automation Intern". Carries `data-hyrra-apply-demo="true"` and `data-hyrra-job-id="{id}"` on the root element so the extension and OpenClaw can detect and read it without `localStorage`. Every input carries `data-apply-field="{key}"` and the wrapper carries `data-field-key="{key}"` for OpenClaw selectors. Submit button is permanently disabled with `type="button"`. |
| `frontend/app/apply-demo/northstar-ev-ai-intern/apply-demo.css` | Form field styling including `.hyrra-review-required` (amber left-border) and `.hyrra-review-warning` (overlay tag) classes that OpenClaw injects after each fill. |
| `frontend/app/apply-demo/layout.tsx` | Bare layout wrapper (no sidebar/topbar) so the demo page renders without the Hyrra app shell. |

### Modified files

| File | Change |
|---|---|
| `frontend/app/apply-agent/page.tsx` | Added fill-plan chip display (safe / review / blocked counts). Field cards carry `data-field-key`, `data-confidence`, `data-needs-review`, `data-source` attributes. Accept buttons carry `data-agent-action="accept"`. These attributes are required for OpenClaw V2 selectors. |

---

## Chrome Extension — What Was Added / Changed

### Modified files

| File | Change |
|---|---|
| `frontend/extension/content.js` | Added `window.extractApplyDemoContext()` — reads `data-hyrra-apply-demo`, `data-hyrra-job-id`, and all `data-apply-field` elements to build a structured form field list. No heuristics — only activates on pages with the demo marker. `target_url` is read from `window.location.href`. |
| `frontend/extension/popup.js` | Added full Apply Demo mode panel with state machine (`initial → preparing → session_ready → running → completed → error`). Detects demo page via `extractApplyDemoContext()`, creates Apply Agent session, fetches fill plan, triggers `run-openclaw-fill`, shows structured result. Buttons: Prepare Apply Session, Run OpenClaw Fill, Copy Task Prompt, Open Dashboard. Session ID is persisted in `chrome.storage.session` (not `localStorage`). |
| `frontend/extension/popup.html` | Added apply-panel HTML with job status indicator, session info row, count chips (safe / review / blocked), status text, secondary action row, and details disclosure. |
| `frontend/extension/popup.css` | Added styles for apply-panel, count chips, job-status states, and session-info row. |

---

## OpenClaw Setup — Issues Solved

### 1. OpenClaw binary not found on Windows

**Problem:** Python's `subprocess.run(shell=False)` resolves executables using the PATH
visible to the Python process (often an IDE or restricted shell), which does not include
`%APPDATA%\npm` where npm installs global packages on Windows.

**Fix:** `OPENCLAW_BIN` env var in `backend/.env` pointing to the full path of `openclaw.cmd`.
The runner also probes `shutil.which("openclaw")`, `shutil.which("openclaw.cmd")`,
`%APPDATA%\npm\openclaw.cmd`, and `%APPDATA%\npm\openclaw` as fallbacks.

```env
OPENCLAW_BIN=C:\Users\<you>\AppData\Roaming\npm\openclaw.cmd
```

Find the correct path with: `where.exe openclaw` in PowerShell.

### 2. Codex app-server binary not found

**Problem:** OpenClaw internally uses the Codex binary (`@openai/codex-*`) as its reasoning
engine. Even when `OPENCLAW_BIN` is set, the subprocess may not inherit
`OPENCLAW_CODEX_APP_SERVER_BIN` from the shell environment if the backend was launched
from an IDE.

**Fix:** `OPENCLAW_CODEX_APP_SERVER_BIN` env var in `backend/.env`. The runner explicitly
injects this into `os.environ.copy()` before spawning the subprocess, regardless of how
the backend was started.

```env
OPENCLAW_CODEX_APP_SERVER_BIN=C:\Users\<you>\.openclaw\npm\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\codex\codex.exe
```

**Why backend env injection alone was not enough:** The OpenClaw gateway process (started
separately with `openclaw gateway start`) also needs to know where the Codex binary is.
The gateway reads the OpenClaw config file, not the Python process environment. Setting
`OPENCLAW_CODEX_APP_SERVER_BIN` in `.env` fixes the subprocess call; the gateway must have
the binary configured via the OpenClaw config path:

```
plugins.entries.codex.config.appServer.command
```

This is set inside the OpenClaw config file (typically in `~/.openclaw/` or the OpenClaw
npm package directory), not from the backend environment.

### 3. OpenClaw config path for Codex app-server

The OpenClaw config key that controls which binary the gateway uses:

```json
{
  "plugins": {
    "entries": {
      "codex": {
        "config": {
          "appServer": {
            "command": "C:\\Users\\<you>\\.openclaw\\npm\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe"
          }
        }
      }
    }
  }
}
```

### 4. Localhost / private network access

**Problem:** OpenClaw's SSRF policy blocks navigation to `localhost` and `127.0.0.1` by
default.

**Fix:** Run once after starting the gateway:

```bash
openclaw config set browser.ssrfPolicy.dangerouslyAllowPrivateNetwork true --strict-json
```

### 5. `.env` auto-loading without `--env-file`

**Problem:** Running `uvicorn app.main:app --reload` without `--env-file .env` meant the
backend started without any OpenClaw config variables.

**Fix:** `python-dotenv` `load_dotenv()` call added in `backend/app/core/config.py`.
The two-parent path resolution (`Path(__file__).resolve().parents[2]`) correctly locates
`backend/.env` regardless of the working directory when uvicorn is launched.

### 6. Windows `cmd.exe` argument mangling

**Problem:** Python's `subprocess.run(..., shell=False)` on Windows still invokes `.cmd`
files through `cmd.exe`, which mangles double-quotes and percent-signs in arguments.

**Fix:** `openclaw_task_service.py` generates prompts that use only single-quoted CSS
selectors and JS snippets. Values are formatted via `repr()` (Python single-quoted string
literals). For prompts exceeding 4 000 chars, the runner detects a `--message-file` / 
`--prompt-file` flag from `openclaw agent --help` and writes the prompt to a temp file.

---

## Final Working Commands

```bash
# 1. Start backend (from backend/)
uvicorn app.main:app --reload

# 2. Start frontend (from frontend/)
npm run dev

# 3. Start OpenClaw gateway (separate terminal)
openclaw gateway start

# 4. Start OpenClaw managed browser (separate terminal)
openclaw browser start

# 5. Enable localhost access (one-time after gateway start)
openclaw config set browser.ssrfPolicy.dangerouslyAllowPrivateNetwork true --strict-json

# 6. Verify backend reads .env correctly (from backend/)
python -c "
from app.core.config import ENABLE_LOCAL_OPENCLAW_RUNNER, OPENCLAW_MAX_TIMEOUT, OPENCLAW_BIN, OPENCLAW_CODEX_APP_SERVER_BIN
print(ENABLE_LOCAL_OPENCLAW_RUNNER)
print(OPENCLAW_MAX_TIMEOUT)
print(OPENCLAW_BIN)
print(bool(OPENCLAW_CODEX_APP_SERVER_BIN))
"
# Expected: True / 600 / <path> / True
```

**Demo flow:**

1. Open `http://localhost:3000/apply-demo/northstar-ev-ai-intern` in **your normal Chrome**.
2. Click **Create Demo Job** — registers the job in the backend.
3. Click the Hyrra AI extension icon — shows "Apply Demo Detected".
4. Click **Prepare Apply Session** — creates session, fetches fill plan (shows safe/review/blocked counts).
5. Click **Run OpenClaw Fill** — spawns OpenClaw subprocess; watch it fill the managed browser.
6. Confirm in the managed browser: 8 safe fields filled, 4 sensitive/review fields untouched, Submit not clicked.

---

## Current Demo Behavior

| Field | Fill result | Reason |
|---|---|---|
| `full_name` | Filled | profile, confidence 95, needs_review=false |
| `email` | Filled | profile, confidence 95, needs_review=false |
| `phone` | Filled | profile, confidence 95, needs_review=false |
| `school` | Filled | profile, confidence 95, needs_review=false |
| `program` | Filled | profile, confidence 95, needs_review=false |
| `graduation_year` | Filled | profile, confidence 95, needs_review=false |
| `linkedin_url` | Filled | profile, confidence 95, needs_review=false |
| `github_url` | Filled | profile, confidence 95, needs_review=false |
| `work_auth` | **Blocked** | field_type=select, needs_review=true (sensitive/legal) |
| `why_interested` | **Blocked** | needs_review=true (long-answer, review required) |
| `relevant_project` | **Blocked** | needs_review=true (long-answer, review required) |
| `additional_info` | **Blocked** | needs_review=true (long-answer, review required) |

Expected chip counts with a complete profile and no API key: **8 safe · 0 review · 4 blocked**.

---

## Known Limitations

1. **OpenClaw fills field-by-field via agent reasoning.** This is slower than ideal for structured fields with known values. Each field requires at least one browser interaction cycle from OpenClaw's reasoning loop.

2. **Review-required written fields are blocked, not draft-filled.** Fields like `why_interested` and `relevant_project` are skipped entirely. A better UX would draft-fill them with an AI suggestion and display a visible "AI draft — review required" overlay, while still blocking OpenClaw from touching them.

3. **Controlled demo page only.** The current target is `apply-demo/northstar-ev-ai-intern`. The content script's `extractApplyDemoContext()` only activates on pages with `data-hyrra-apply-demo="true"`. Arbitrary real application pages are not yet supported.

4. **Separate browser profile.** OpenClaw operates in its own isolated Chrome profile, not the user's currently open browser tab. The user must watch a separate managed browser window to see the filling happen.

5. **No multi-step form support.** If a real application form spans multiple pages or has conditional sections, the current prompt and flow cannot navigate between steps.

6. **No generalized field detection.** On the demo page, selectors are known ahead of time (`data-apply-field` attributes). On arbitrary pages, field label/selector mapping, confidence scoring, and dynamic UI handling are future work.

---

## Next Sprint: Generalizing Apply Agent Beyond the Demo Page

### Redefine OpenClaw's role

OpenClaw should **not** manually type already-structured fields one by one — it is too slow and too fragile for high-confidence known values. Instead:

- **Hyrra** fast-fills known structured fields (profile data, deterministic extractions) directly via a batched DOM manipulation executor.
- **OpenClaw** handles only the ambiguous, unseen, or dynamic fields where agent reasoning is needed.

### Four fill categories

| Category | Description | Who fills it |
|---|---|---|
| `safe` | confidence ≥ 80, needs_review=false, source=profile/deterministic | Hyrra fast executor |
| `review_required` | AI/resume-sourced; needs human sign-off | Hyrra fast executor (draft only) + visible "AI draft — review required" marker |
| `agent_required` | Unknown field key, dynamic label, inferred from page context | OpenClaw only |
| `blocked` | Select/checkbox/radio/file, legal/work-auth, confidence < threshold | Leave untouched |

### Fast deterministic executor

For `safe` and `review_required` fields:
- Batched DOM fill via `document.querySelector` + dispatched `input`/`change` events (React-compatible).
- Applied before OpenClaw is invoked — no subprocess latency for known values.
- `review_required` fields get a visible `.hyrra-review-required` marker + "AI draft — review before submitting" overlay.

### OpenClaw scope (V2)

OpenClaw runs **only** for `agent_required` fields:
- Field extraction: scan page DOM for unlabelled or dynamically generated inputs.
- Label/selector mapping: infer which backend field key each element corresponds to.
- Confidence scoring: return structured `{field_key, selector, value, confidence}` — Hyrra backend applies the threshold gates.
- Recovery: if deterministic filling fails (selector mismatch, dynamic rendering), OpenClaw tries to recover before escalating to human review.

### Support for arbitrary pages

- Content script generalizes `extractApplyDemoContext()` to work on any page using label heuristics, ARIA attributes, and placeholder text matching.
- Multi-step form navigation: detect "Next" / "Continue" patterns; pause for human checkpoint between steps.
- Dynamic UI handling: wait for React/Vue state to settle before reading selectors.

### Safety constraints remain unchanged

- No auto-submit under any circumstances.
- No auto-fill of `select`, `checkbox`, `radio`, or `file` elements.
- No auto-fill of work authorization or other legal/sensitive fields.
- Human review required for all `review_required` and `agent_required` fields before the session can be marked complete.
- All actions logged to the immutable action log.

---

## README / Docs Status

- `OPENCLAW_SETUP.md` — full setup walkthrough including all config fixes above. Located at the repo root.
- `docs/APPLY_AGENT_OPENCLAW_SPRINT_SUMMARY.md` — this file.
- `public_showcase/` — architecture overview and publish checklist (pre-existing).

**Demo video:** not yet recorded. Placeholder: add a `docs/demo/` folder with screen recording once recorded.
