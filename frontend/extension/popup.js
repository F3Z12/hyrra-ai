// ── Config ────────────────────────────────────────────────────────────────────
const API          = "http://127.0.0.1:8000";
const DASHBOARD    = "http://127.0.0.1:3000";
const BACKEND_URL  = API + "/v1/jobs";        // kept for job-saver mode
const DASHBOARD_URL = "http://localhost:3000/jobs"; // job-saver panel link
const SESSION_STORE_KEY = "hyrra_apply_session_id";

// ── Shared helpers ────────────────────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectAndRun(tabId, func) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func });
  return res?.result;
}

async function apiFetch(path, init) {
  const res = await fetch(API + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.detail || "Request failed: " + res.status), { status: res.status, body });
  return body;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    Object.assign(ta.style, { position: "fixed", left: "-9999px", top: 0 });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// JOB SAVER MODE (original)
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

const jobTextEl    = document.getElementById("jobText");
const sourceLabelEl = document.getElementById("sourceLabel");
const statusEl     = document.getElementById("status");
const saveButton   = document.getElementById("saveButton");
const refreshButton = document.getElementById("refreshButton");
const dashboardLink = document.getElementById("dashboardLink");

let currentDomain = "";
let currentSourceLabel = "";

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = "status " + (type || "");
}

function setLoading(isLoading) {
  saveButton.disabled = isLoading;
  refreshButton.disabled = isLoading;
}

async function extractFromActiveTab() {
  setLoading(true);
  setStatus("Extracting visible job text...");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab found.");

    const payload = await injectAndRun(tab.id, () => window.extractJobText()) || {};

    currentDomain = payload.domain || new URL(tab.url || "").hostname.replace(/^www\./, "");
    currentSourceLabel = payload.sourceLabel || currentDomain;
    jobTextEl.value = payload.text || "";
    sourceLabelEl.textContent = currentSourceLabel ? "Source: " + currentSourceLabel : "Source: current page";

    setStatus(
      jobTextEl.value.trim()
        ? "Review or edit the text, then save it to Hyrra."
        : "No visible text was extracted. Paste the job description manually.",
      jobTextEl.value.trim() ? "" : "error"
    );
  } catch (err) {
    sourceLabelEl.textContent = "Source: current page";
    setStatus(err instanceof Error ? err.message : "Could not extract text from this page.", "error");
  } finally {
    setLoading(false);
  }
}

async function saveJob() {
  const text = jobTextEl.value.trim();
  if (!text) { setStatus("Job description text is required.", "error"); return; }

  setLoading(true);
  setStatus("Saving job...");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_text: text,
        source_type: "chrome_extension",
        source_label: currentSourceLabel || currentDomain || "chrome_extension",
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Failed to save job.");
    }
    setStatus("Saved successfully!", "success");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Failed to connect to backend.", "error");
  } finally {
    setLoading(false);
  }
}

dashboardLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: DASHBOARD_URL });
});
refreshButton.addEventListener("click", extractFromActiveTab);
saveButton.addEventListener("click", saveJob);

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// APPLY DEMO MODE
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

// State
let applyCtx       = null;   // extractApplyDemoContext result from the tab
let applyState     = "initial"; // initial | preparing | session_ready | running | completed | error
let applySessionId = null;   // integer session id
let applyFillPlan  = null;   // fill-plan response (includes openclaw_prompt)
let openclawResult = null;   // run-openclaw-fill response
let applyErrorMsg  = null;   // displayed in red when applyState === "error"

// DOM refs for apply panel
const applyJobStatusEl   = document.getElementById("applyJobStatus");
const applySessionInfoEl = document.getElementById("applySessionInfo");
const applySessionLabelEl = document.getElementById("applySessionLabel");
const applyCountsEl      = document.getElementById("applyCounts");
const applyStatusEl      = document.getElementById("applyStatus");
const applyDetailsEl     = document.getElementById("applyDetails");
const applyDetailsContentEl = document.getElementById("applyDetailsContent");
const btnPrepare         = document.getElementById("btnPrepare");
const btnRunOpenclaw     = document.getElementById("btnRunOpenclaw");
const btnCopyTask        = document.getElementById("btnCopyTask");
const btnOpenDashboard   = document.getElementById("btnOpenDashboard");
const applySecondaryRow  = document.getElementById("applySecondaryRow");
const applyDashboardBtn  = document.getElementById("applyDashboardBtn");

function renderApplyPanel() {
  // ── Job ID status ──
  if (applyCtx?.jobId) {
    applyJobStatusEl.textContent = "Demo job ready · ID: " + applyCtx.jobId;
    applyJobStatusEl.className = "apply-job-status apply-job-status--ready";
  } else {
    applyJobStatusEl.textContent = "Create/load the demo job on the page first.";
    applyJobStatusEl.className = "apply-job-status apply-job-status--missing";
  }

  // ── Session info ──
  if (applySessionId) {
    applySessionInfoEl.style.display = "";
    applySessionLabelEl.textContent = "Session #" + applySessionId + " ready";

    if (applyFillPlan) {
      const safe = applyFillPlan.fillable_count || 0;
      // Split blocked into "needs review" (ai/flagged) and hard-blocked
      const blockedFields = applyFillPlan.blocked || [];
      const reviewCount = blockedFields.filter(function (f) {
        return f.reason.includes("flagged for human review") || f.reason.includes("'ai'");
      }).length;
      const hardBlocked = (applyFillPlan.blocked_count || 0) - reviewCount;

      applyCountsEl.innerHTML =
        '<span class="count-chip count-chip--safe">' + safe + " safe</span>" +
        '<span class="count-chip count-chip--review">' + reviewCount + " review</span>" +
        '<span class="count-chip count-chip--blocked">' + hardBlocked + " blocked</span>";
    } else {
      applyCountsEl.innerHTML = "";
    }
  } else {
    applySessionInfoEl.style.display = "none";
  }

  // ── Status message ──
  const isLoading = applyState === "preparing" || applyState === "running";
  if (applyErrorMsg) {
    applyStatusEl.textContent = applyErrorMsg;
    applyStatusEl.className = "status error";
  } else if (applyState === "preparing") {
    applyStatusEl.textContent = "Preparing session…";
    applyStatusEl.className = "status";
  } else if (applyState === "running") {
    applyStatusEl.textContent = "Running OpenClaw. Keep the managed browser open.";
    applyStatusEl.className = "status";
  } else if (applyState === "completed" && openclawResult) {
    if (openclawResult.status === "ok") {
      applyStatusEl.textContent = "OpenClaw completed (" + openclawResult.duration_ms + "ms).";
      applyStatusEl.className = "status success";
    } else if (openclawResult.status === "timeout") {
      applyStatusEl.textContent = "OpenClaw timed out: " + (openclawResult.error || "");
      applyStatusEl.className = "status error";
    } else {
      applyStatusEl.textContent = openclawResult.error || "OpenClaw returned an error.";
      applyStatusEl.className = "status error";
    }
  } else {
    applyStatusEl.textContent = "";
    applyStatusEl.className = "status";
  }

  // ── Buttons ──
  const hasSession = !!applySessionId;
  btnPrepare.style.display = hasSession ? "none" : "";
  btnPrepare.disabled = isLoading;

  btnRunOpenclaw.style.display = hasSession ? "" : "none";
  btnRunOpenclaw.disabled = isLoading;

  // Secondary row (Copy Task + Open Dashboard) — show once session exists
  applySecondaryRow.style.display = hasSession ? "" : "none";
  btnCopyTask.disabled = isLoading || !applyFillPlan?.openclaw_prompt;

  // OpenClaw result details
  if (applyState === "completed" && openclawResult) {
    applyDetailsEl.style.display = "";
    applyDetailsContentEl.textContent = JSON.stringify(openclawResult, null, 2);
  } else {
    applyDetailsEl.style.display = "none";
  }
}

// ── Apply demo button handlers ─────────────────────────────────────────────

async function prepareSession() {
  if (!applyCtx) return;

  applyState = "preparing";
  applyErrorMsg = null;
  renderApplyPanel();

  try {
    if (!applyCtx.jobId) {
      throw new Error("Demo job ID missing. Click \"Create Demo Job\" on the page first.");
    }

    // Fetch candidate profile
    const profile = await apiFetch("/v1/candidate-profile").catch(function (err) {
      if (err.status === 404 || (err.body?.detail || "").includes("No candidate profile")) {
        throw new Error(
          "Create your candidate profile in Hyrra first.\n" + DASHBOARD + "/candidate-profile"
        );
      }
      throw err;
    });

    // Create Apply Agent session
    const session = await apiFetch("/v1/apply-agent/sessions", {
      method: "POST",
      body: JSON.stringify({
        candidate_profile_id: profile.id,
        job_id: applyCtx.jobId,
        resume_id: null,
        api_key: null,
        form_fields: applyCtx.formFields,
        target_url: applyCtx.targetUrl,
      }),
    });

    applySessionId = session.session_id;

    // Persist while browser is open
    try {
      await chrome.storage.session.set({ [SESSION_STORE_KEY]: applySessionId });
    } catch { /* storage.session may not be available in all builds */ }

    // Fetch fill plan
    await fetchFillPlan();

    applyState = "session_ready";
  } catch (err) {
    applyState = "error";
    applyErrorMsg = err instanceof Error ? err.message : String(err);
  }

  renderApplyPanel();
}

async function fetchFillPlan() {
  applyFillPlan = await apiFetch("/v1/apply-agent/sessions/" + applySessionId + "/fill-plan");
}

async function runOpenClawFill() {
  if (!applySessionId) return;

  applyState = "running";
  applyErrorMsg = null;
  openclawResult = null;
  renderApplyPanel();

  try {
    const result = await apiFetch(
      "/v1/apply-agent/sessions/" + applySessionId + "/run-openclaw-fill",
      { method: "POST", body: JSON.stringify({ timeout_seconds: 600 }) }
    ).catch(function (err) {
      if (err.status === 403) {
        throw new Error(
          "Local OpenClaw runner is disabled. " +
          "Set ENABLE_LOCAL_OPENCLAW_RUNNER=true in .env and restart the backend."
        );
      }
      throw err;
    });

    openclawResult = result;
    applyState = "completed";
  } catch (err) {
    applyState = "error";
    applyErrorMsg = err instanceof Error ? err.message : String(err);
  }

  renderApplyPanel();
}

async function copyOpenClawTask() {
  if (!applyFillPlan?.openclaw_prompt) {
    applyStatusEl.textContent = "No prompt available. Prepare a session first.";
    applyStatusEl.className = "status error";
    return;
  }
  try {
    await copyToClipboard(applyFillPlan.openclaw_prompt);
    const orig = btnCopyTask.textContent;
    btnCopyTask.textContent = "Copied!";
    setTimeout(function () { btnCopyTask.textContent = orig; }, 1500);
  } catch {
    applyStatusEl.textContent = "Could not copy to clipboard.";
    applyStatusEl.className = "status error";
  }
}

function openDashboard() {
  const url = applySessionId
    ? DASHBOARD + "/apply-agent?session=" + applySessionId
    : DASHBOARD + "/apply-agent";
  chrome.tabs.create({ url });
}

btnPrepare.addEventListener("click", prepareSession);
btnRunOpenclaw.addEventListener("click", runOpenClawFill);
btnCopyTask.addEventListener("click", copyOpenClawTask);
btnOpenDashboard.addEventListener("click", openDashboard);
applyDashboardBtn.addEventListener("click", openDashboard);

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// INIT  —  detect mode and show the right panel
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

async function init() {
  const tab = await getActiveTab();
  if (!tab?.id) { showJobPanel(); extractFromActiveTab(); return; }

  try {
    const ctx = await injectAndRun(tab.id, () => window.extractApplyDemoContext());

    if (ctx?.isApplyDemo) {
      applyCtx = ctx;
      showApplyPanel();

      // Attempt to restore a previous session from chrome.storage.session
      try {
        const stored = await chrome.storage.session.get(SESSION_STORE_KEY);
        const storedId = stored[SESSION_STORE_KEY];
        if (storedId) {
          applySessionId = storedId;
          applyState = "session_ready";
          // Re-fetch fill plan silently; ignore errors (session may have expired)
          await fetchFillPlan().catch(function () {
            applyFillPlan = null;
          });
        }
      } catch { /* storage.session unavailable */ }

      renderApplyPanel();
    } else {
      showJobPanel();
      extractFromActiveTab();
    }
  } catch {
    showJobPanel();
    extractFromActiveTab();
  }
}

function showJobPanel() {
  document.getElementById("job-panel").style.display = "";
  document.getElementById("apply-panel").style.display = "none";
}

function showApplyPanel() {
  document.getElementById("job-panel").style.display = "none";
  document.getElementById("apply-panel").style.display = "";
}

document.addEventListener("DOMContentLoaded", init);
