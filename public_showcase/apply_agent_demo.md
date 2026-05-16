# Apply Agent + OpenClaw — Feature Showcase

> **Status: Proof of Concept.** This feature demonstrates the architecture and safety model for AI-assisted form filling. It currently targets a controlled demo application page. Generalization to arbitrary application pages is planned next.

## Demo Video

**[Watch the end-to-end demo on Google Drive](https://drive.google.com/file/d/1LdkdDU8ftsA2dHXzZoC9mQrUeeC6z9Ep/view?usp=sharing)**

The recording shows: Chrome extension detecting the mock application page → Apply Agent session creation → fill plan generation (safe / review-required / blocked) → OpenClaw navigating its managed browser to the page → safe fields filled via keyboard events → structured JSON result returned to the backend → blocked and sensitive fields confirmed untouched.

---

## What This Is

A proof-of-concept system showing how an AI job application assistant can fill structured form fields with human oversight — using a Chrome extension, a FastAPI backend, and OpenClaw browser automation — without ever submitting a form or auto-filling sensitive data.

The key architectural decision: **the backend is the sole source of truth.** The Chrome extension reads page context and delegates to the backend. The backend generates all prompts and fill decisions. OpenClaw executes instructions but never makes autonomous decisions about what to fill or submit.

---

## End-to-End Architecture

```
Your browser (normal Chrome)
───────────────────────────────────────────────────────────────────
  Mock application page  ←  data-hyrra-apply-demo="true" on root
  Hyrra extension popup
        │
        │  1. Detects page via DOM marker (no heuristics)
        │  2. Reads field keys, labels, input types, CSS selectors
        │     from data-apply-field attributes
        │  3. Reads job ID from data-hyrra-job-id DOM attribute
        │     (never from localStorage)
        │
        ▼
  POST /v1/apply-agent/sessions
        │
        ▼
  FastAPI Backend
  ─────────────────────────────────────────────────────────────────
  Suggestion cascade (priority order, strictly enforced):
    1. Candidate profile direct fields     → source: "profile",       confidence 95
    2. Profile reusable long-answer drafts → source: "profile",       confidence 85
    3. Resume parsed/extracted data        → source: "resume",        confidence 60
    4. Deterministic regex extraction      → source: "deterministic", confidence 80
    5. OpenAI BYOK (textarea fields only)  → source: "ai",            confidence 70
    6. No suggestion available             → source: "none",          confidence 0

  Fill plan classification (three-gate check per field):
    safe            confidence ≥ 80  AND  needs_review = false  AND  source ∈ {profile, deterministic}
    review_required anything AI-generated, resume-sourced, or flagged for human sign-off
    blocked         select / checkbox / radio / file inputs, work authorization,
                    confidence < threshold, or any field the user explicitly skipped

  Generates OpenClaw task prompt entirely server-side.
  No client-supplied strings are passed to the subprocess.
        │
        ▼
  POST /sessions/{id}/run-openclaw-fill
        │
        └──── Spawns: openclaw agent --agent main --message <prompt> --json
                            │
                            ▼
                    OpenClaw managed browser
                    ─────────────────────────────────────────────────
                    (isolated Chrome profile — no Hyrra extension,
                     no access to user's localStorage or session data)

                    Navigates to target_url
                    Verifies data-hyrra-apply-demo="true" in DOM
                    For each safe field:
                      click → Ctrl+A → type value via keyboard
                      (keyboard events, not JS value injection,
                       so React onChange fires correctly)
                      inject .hyrra-review-required class + "Auto-filled" marker
                    Reports: { session_id, filled: [...], failed: [...], url }
                            │
                            ▼
  Backend receives JSON result
  Writes agent_filled / agent_failed entries to immutable audit log
  Returns structured result to extension popup
───────────────────────────────────────────────────────────────────
User reviews filled form in managed browser
Nothing is submitted
```

---

## Fill Plan Classification — Detail

Every field suggestion goes through three independent gates before being classified as `safe`:

| Gate | Requirement | Rationale |
|---|---|---|
| Confidence | ≥ 80% | Prevents low-quality suggestions from being auto-applied |
| Source | `profile` or `deterministic` only | AI and resume-inferred values always require review |
| Needs review | `false` | Explicit flag set per field type and content category |

Fields that fail any gate are **blocked** — OpenClaw never sees them, and they are not mentioned in the prompt.

---

## What the Demo Shows

With a fully filled candidate profile and no API key provided:

| Field | Result | Reason |
|---|---|---|
| Full Name | Filled | profile, confidence 95, needs_review=false |
| Email | Filled | profile, confidence 95, needs_review=false |
| Phone | Filled | profile, confidence 95, needs_review=false |
| School | Filled | profile, confidence 95, needs_review=false |
| Program | Filled | profile, confidence 95, needs_review=false |
| Graduation Year | Filled | profile, confidence 95, needs_review=false |
| LinkedIn URL | Filled | profile, confidence 95, needs_review=false |
| GitHub URL | Filled | profile, confidence 95, needs_review=false |
| Work Authorization | **Blocked** | `<select>` input — never auto-filled |
| Why interested? | **Blocked** | Long-answer; needs_review=true |
| Relevant project | **Blocked** | Long-answer; needs_review=true |
| Additional info | **Blocked** | Long-answer; needs_review=true |

Expected chip counts in the extension popup: **8 safe · 0 review · 4 blocked**.

---

## Safety Design

Every safety constraint is enforced at a different layer so no single point of failure can bypass it:

**Backend (fill plan layer):**
- Select, checkbox, radio, and file inputs are classified `blocked` before the prompt is generated
- Work authorization and legal fields are blocked regardless of confidence
- AI-generated fields (`source: "ai"`) always carry `needs_review: true` and cannot appear in the `safe` bucket
- The OpenClaw prompt is generated entirely server-side — no user or client input is interpolated

**Prompt (instruction layer):**
- OpenClaw is explicitly instructed: *never click Submit, Apply, Next, or Continue*
- OpenClaw is instructed to skip and report any field not in its fill list
- Page verification step: if `data-hyrra-apply-demo="true"` is absent from the DOM, OpenClaw stops and reports failure

**Demo page (UI layer):**
- Submit button is rendered as `<button type="button" disabled>` — it is not a form submit and cannot be activated programmatically

**Audit log (accountability layer):**
- Every suggestion generated, every field filled by OpenClaw, every user Accept/Edit/Skip action, and every agent failure is written to an append-only log
- The log is queryable at `GET /v1/apply-agent/sessions/{id}/log`

---

## Current Limitations

**Controlled demo page only.** Field detection uses `data-apply-field` attributes that exist only on the Hyrra mock application page. Arbitrary real application pages require a different extraction strategy (label heuristics, ARIA attributes, placeholder matching).

**Field-by-field OpenClaw execution is slower than optimal.** OpenClaw reasons about each field through its agent loop. For structured fields with known values this introduces unnecessary latency — a deterministic batched DOM executor would be significantly faster.

**Review-required written-answer fields are blocked, not draft-filled.** Fields like "Why are you interested in this role?" are currently excluded from the fill plan entirely. A better experience would draft-fill them from the candidate profile or AI, display a visible "AI draft — review required" overlay, and allow the user to edit before accepting.

**Separate managed browser.** OpenClaw operates in its own isolated Chrome profile. The user sees the filling happen in a separate browser window, not in their current tab. Closer integration is future work.

**No multi-step form support.** Application flows that span multiple pages, have conditional sections, or require navigation between steps are not yet handled.

---

## Next Direction

**Deterministic batched executor for `safe` fields.**
Skip the OpenClaw subprocess entirely for fields where the value is known. Batch-fill via direct DOM events — instant, no agent latency.

**Visible "AI draft — review required" markers for `review_required` fields.**
Draft-fill long-answer fields from the candidate profile or AI, and overlay a prominent review banner. OpenClaw never touches these — the user edits and accepts manually in the Hyrra review interface.

**New `agent_required` category.**
For fields that are unknown, dynamically rendered, or require label inference — OpenClaw handles only these. The three-tier model becomes four: `safe` → `review_required` → `agent_required` → `blocked`.

**Generalized field detection.**
Extend the content script beyond the controlled demo page using label heuristics, ARIA attributes, placeholder text matching, and confidence scoring for arbitrary application pages.

**Multi-step form support.**
Detect "Next / Continue" navigation patterns, pause for human checkpoint between steps, and resume filling on the following page.

**Enhanced audit log viewer.**
Surface the per-session action log in the Hyrra review UI so the user can inspect every fill decision without hitting the API directly.
