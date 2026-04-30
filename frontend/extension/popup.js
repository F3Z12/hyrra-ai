const BACKEND_URL = "http://127.0.0.1:8000/v1/jobs";
const DASHBOARD_URL = "http://localhost:3000/jobs";

const jobText = document.getElementById("jobText");
const sourceLabel = document.getElementById("sourceLabel");
const statusEl = document.getElementById("status");
const saveButton = document.getElementById("saveButton");
const refreshButton = document.getElementById("refreshButton");
const dashboardLink = document.getElementById("dashboardLink");

let currentDomain = "";
let currentSourceLabel = "";

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function setLoading(isLoading) {
  saveButton.disabled = isLoading;
  refreshButton.disabled = isLoading;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFromActiveTab() {
  setLoading(true);
  setStatus("Extracting visible job text...");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab found.");

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.extractJobText()
    });

    const payload = result?.result || {};
    console.log("[Hyrra] Extracted metadata:", {
      title: payload.title || "",
      company: payload.company || "",
      location: payload.location || "",
      employmentType: payload.employmentType || "",
      locationType: payload.locationType || "",
      department: payload.department || "",
      url: payload.url || "",
      hostname: payload.hostname || payload.domain || "",
      pageTitle: payload.pageTitle || ""
    });
    currentDomain = payload.domain || new URL(tab.url || "").hostname.replace(/^www\./, "");
    currentSourceLabel = payload.sourceLabel || currentDomain;
    jobText.value = payload.text || "";
    sourceLabel.textContent = currentSourceLabel ? `Source: ${currentSourceLabel}` : "Source: current page";

    if (jobText.value.trim()) {
      setStatus("Review or edit the text, then save it to Hyrra.", "");
    } else {
      setStatus("No visible text was extracted. Paste the job description manually.", "error");
    }
  } catch (error) {
    sourceLabel.textContent = "Source: current page";
    setStatus(error instanceof Error ? error.message : "Could not extract text from this page.", "error");
  } finally {
    setLoading(false);
  }
}

async function saveJob() {
  const text = jobText.value.trim();
  if (!text) {
    setStatus("Job description text is required.", "error");
    return;
  }

  setLoading(true);
  setStatus("Saving job...");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_text: text,
        source_type: "chrome_extension",
        source_label: currentSourceLabel || currentDomain || "chrome_extension"
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Failed to save job.");
    }

    setStatus("Saved successfully!", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to connect to backend.", "error");
  } finally {
    setLoading(false);
  }
}

dashboardLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: DASHBOARD_URL });
});

refreshButton.addEventListener("click", extractFromActiveTab);
saveButton.addEventListener("click", saveJob);

document.addEventListener("DOMContentLoaded", extractFromActiveTab);
