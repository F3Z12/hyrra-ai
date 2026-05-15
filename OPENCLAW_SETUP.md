# OpenClaw Local Setup — Hyrra Apply Agent V2

This guide walks through running the end-to-end demo locally:
the Hyrra Chrome extension (in your normal browser) triggers the backend, which spawns
OpenClaw to fill the Northstar mock application form in its own isolated managed browser.

---

## Architecture: two browsers, one backend

```
Your normal Chrome                    OpenClaw managed browser
────────────────────────              ────────────────────────────
  Demo page (Next.js)                   (separate Chrome profile)
  Hyrra extension popup                 No Hyrra extension installed
        │                               No access to your localStorage
        │ detects page,                         │
        │ extracts form fields                  │
        ▼                                       │
  POST /run-openclaw-fill                       │
        │                                       │
        ▼                                       │
  Hyrra backend (FastAPI)                       │
  generates fill-plan prompt                    │
        │                                       │
        └──── spawns OpenClaw subprocess ───────▶ navigates to target_url
                                                  fills safe fields
                                                  reports JSON result
```

Key point: **the Hyrra extension only runs in your normal Chrome.** OpenClaw operates
in its own isolated profile. All fill data comes from the backend-generated prompt —
OpenClaw does not need the extension, does not read `localStorage`, and does not use any
extension APIs.

---

## Prerequisites

| Requirement | Install / docs |
|---|---|
| Hyrra backend running | `uvicorn app.main:app --reload` (port 8000) |
| Hyrra frontend running | `npm run dev` (port 3000) |
| OpenClaw CLI installed | `npm i -g @openclaw/cli` or follow OpenClaw docs |
| Chrome extension loaded in **your normal Chrome** | Load `frontend/extension/` as unpacked extension in `chrome://extensions` |
| Candidate profile created | Fill in at `http://localhost:3000/candidate-profile` |

---

## 0. Verify config loads correctly

Run this from the `backend/` folder after editing `.env` to confirm every
variable is picked up without needing `--env-file`:

```bash
python -c "
from app.core.config import (
    ENABLE_LOCAL_OPENCLAW_RUNNER,
    OPENCLAW_MAX_TIMEOUT,
    OPENCLAW_BIN,
    OPENCLAW_CODEX_APP_SERVER_BIN,
)
print(ENABLE_LOCAL_OPENCLAW_RUNNER)
print(OPENCLAW_MAX_TIMEOUT)
print(OPENCLAW_BIN)
print(bool(OPENCLAW_CODEX_APP_SERVER_BIN))
"
```

Expected output:

```
True
600
C:\Users\faizs\AppData\Roaming\npm\openclaw.cmd
True
```

If any line shows the wrong value, check `backend/.env` and restart the backend.

---

## 1. Backend `.env` settings

Add these to `backend/.env` (create the file if it does not exist):

```env
# Enable the local OpenClaw subprocess runner (dev only — never enable in production)
ENABLE_LOCAL_OPENCLAW_RUNNER=true

# Explicit path to the OpenClaw binary (required on Windows when npm global bin
# is not on the PATH visible to the Python subprocess).
# Find your path with: where.exe openclaw  (pick the .cmd variant)
OPENCLAW_BIN=C:\Users\faizs\AppData\Roaming\npm\openclaw.cmd

# Path to the Codex app-server binary that OpenClaw uses internally.
# The Python subprocess may not inherit this from your shell session.
# Find it inside the OpenClaw npm package installation:
OPENCLAW_CODEX_APP_SERVER_BIN=C:\Users\faizs\.openclaw\npm\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\codex\codex.exe

# Optional: raise timeout ceiling (default is 600 seconds)
OPENCLAW_MAX_TIMEOUT=600
```

> **Why `OPENCLAW_BIN` is needed on Windows:**
> Python's `subprocess.run(..., shell=False)` resolves executables using the PATH
> visible to the Python process, which may differ from the PATH in your PowerShell
> session (where `where.exe openclaw` works). The runner falls back through
> `shutil.which("openclaw")`, `shutil.which("openclaw.cmd")`, and
> `%APPDATA%\npm\openclaw.cmd` automatically, but setting `OPENCLAW_BIN` explicitly
> is the most reliable option on Windows.

Restart the backend after changing `.env`.

---

## 2. Start OpenClaw services

Run these three commands in separate terminals (order matters):

```bash
# Terminal 1 — OpenClaw gateway
openclaw gateway start

# Terminal 2 — OpenClaw managed browser (separate from your normal Chrome)
openclaw browser start

# Terminal 3 — allow private-network (localhost) access
openclaw config set browser.ssrfPolicy.dangerouslyAllowPrivateNetwork true --strict-json
```

> **Why the ssrfPolicy setting?**
> By default OpenClaw blocks navigation to `localhost` / `127.0.0.1`.
> The demo page lives at `http://localhost:3000/apply-demo/northstar-ev-ai-intern`
> so private-network access must be explicitly unlocked for the managed browser.

---

## 3. Approve required OpenClaw scopes (first run only)

On the first run, OpenClaw may prompt you to approve scopes in the gateway UI:

- `browser.navigate` — navigate to URLs
- `browser.read_dom` — read page content
- `browser.interact` — click and type into elements
- `browser.execute_script` — inject review indicator CSS classes

Approve all four. They are saved for the session.

---

## 4. Create and save the demo job (in your normal Chrome)

1. Open `http://localhost:3000/apply-demo/northstar-ev-ai-intern` in **your normal Chrome**.
2. Click **Create Demo Job** — this saves the job via the Hyrra backend and reveals the job ID.
3. The job ID badge on the page confirms the backend round-trip worked.

You do not need to open this page in the OpenClaw managed browser — OpenClaw will
navigate there itself when the run is triggered.

---

## 5. Run the E2E flow via the Chrome extension (in your normal Chrome)

1. Click the **Hyrra AI** extension icon while on the demo page in **your normal Chrome**.
2. The popup shows **Apply Demo Detected** with the job ID.
3. Click **Prepare Apply Session** — the extension creates a session on the backend and fetches
   the fill plan. The extension reads `target_url` from the page DOM and sends it to the backend.
4. The popup shows chip counts: safe / review / blocked.
   - Expected with a complete profile and no API key: **8 safe, 4 blocked**.
5. Click **Run OpenClaw Fill**:
   - The backend generates an OpenClaw prompt from the fill plan.
   - The backend spawns an OpenClaw subprocess.
   - **OpenClaw navigates its own managed browser to `target_url`** (the demo page).
   - OpenClaw fills the 8 safe fields using keyboard events (React-compatible).
6. Watch the **OpenClaw managed browser window** — you should see it navigate to the demo page
   and type into: Full Name, Email, Phone, School, Program, Graduation Year, LinkedIn URL,
   GitHub URL.
7. Each filled field gets an amber left-border with "Auto-filled — please review" text.
8. The extension popup shows completion status and duration.

---

## 6. Verify blocked fields were not touched (in the OpenClaw managed browser)

After OpenClaw completes, confirm in the **OpenClaw managed browser** that these fields
remain empty:

- **Work Authorization** (`<select>`) — skipped because `field_type=select`
- **Why interested** — skipped because `needs_review=true` (long-answer)
- **Relevant project** — skipped because `needs_review=true`
- **Additional info** — skipped because `needs_review=true`

The disabled **Submit Application** button must remain untouched.

---

## 7. Inspect action logs

```bash
curl http://localhost:8000/v1/apply-agent/sessions/<SESSION_ID>/log
```

Expected entries for a successful run:
- `agent_filled` for each of the 8 safe fields
- No `agent_failed` entries (unless a field was not found)

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Extension popup shows **403 – Local OpenClaw runner is disabled** | Set `ENABLE_LOCAL_OPENCLAW_RUNNER=true` in `.env` and restart backend |
| OpenClaw exits immediately with "ECONNREFUSED" | Run `openclaw gateway start` first |
| OpenClaw managed browser does not navigate to the demo page | Ensure `ssrfPolicy.dangerouslyAllowPrivateNetwork` is set; both `localhost:3000` and `127.0.0.1:3000` are treated as equivalent by the prompt |
| Fields not updating visually despite typing | OpenClaw may be using JS value injection instead of keyboard events; the prompt explicitly requires click → Ctrl+A → type |
| `data-hyrra-job-id` missing on demo page | Click **Create Demo Job** on the page first (in your normal Chrome), then re-open the extension popup |
| Session restored but fill plan empty after browser restart | `chrome.storage.session` is cleared on browser close; click **Prepare Apply Session** again |
| OpenClaw reports "extension not found" or tries to access storage | This is a prompt version mismatch — the prompt explicitly tells OpenClaw not to use extension APIs; ensure backend is running the latest code |
