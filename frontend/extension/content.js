(function () {
  const MAX_TEXT_LENGTH = 20000;
  const MIN_CONTAINER_LENGTH = 200;
  const JOB_KEYWORDS = [
    "responsibilities",
    "qualifications",
    "requirements",
    "about",
    "location",
    "compensation",
    "internship",
    "engineer",
    "experience",
    "benefits",
    "role",
    "team"
  ];

  function cleanText(text) {
    const lines = (text || "")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
      .filter(Boolean);

    const deduped = [];
    for (const line of lines) {
      if (deduped[deduped.length - 1] !== line) {
        deduped.push(line);
      }
    }

    return deduped.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_LENGTH);
  }

  function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function visibleText(element) {
    if (!isVisible(element)) return "";
    return cleanText(element.innerText || "");
  }

  function firstVisibleText(selector) {
    for (const element of document.querySelectorAll(selector)) {
      const text = visibleText(element);
      if (text) return text.split("\n")[0];
    }
    return "";
  }

  function titleCaseSlug(slug) {
    return (slug || "")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function parseTitleAndCompanyFromPageTitle(pageTitle) {
    const normalized = (pageTitle || "").replace(/\s+/g, " ").trim();
    const beforePipe = normalized.split("|")[0].trim();
    const atMatch = beforePipe.match(/^(.+?)\s+@\s+(.+)$/);

    if (!atMatch) {
      return { title: beforePipe, company: "" };
    }

    return {
      title: atMatch[1].trim(),
      company: atMatch[2].trim()
    };
  }

  function inferCompany(hostname, pageTitleCompany) {
    if (hostname === "jobs.ashbyhq.com") {
      const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0];
      const ashbyCompany = titleCaseSlug(firstPathSegment);
      if (ashbyCompany) return ashbyCompany;
    }

    if (pageTitleCompany) return pageTitleCompany;

    const domainParts = hostname.replace(/^www\./, "").split(".");
    return titleCaseSlug(domainParts[0] || "");
  }

  function normalizeLabel(text) {
    return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function cleanMetadataValue(value) {
    return (value || "")
      .replace(/\s+/g, " ")
      .replace(/^(?:-|:)+\s*/, "")
      .replace(/\s*(?:-|:)+$/, "")
      .trim()
      .replace(/[.,;]+$/, "")
      .trim();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isShortMetadataValue(value, options = {}) {
    const cleaned = cleanMetadataValue(value);
    if (!cleaned || cleaned.length > 120) return false;
    if (/[.!?]\s+\S/.test(cleaned)) return false;

    const lower = cleaned.toLowerCase();
    const blocked = [
      "salary",
      "pay",
      "wage",
      "compensation",
      "hourly",
      "range",
      "estimated",
      "benefits",
      "equity",
      "bonus",
      "ca$",
      "$",
      "usd",
      "cad",
      "per hour",
      "annually",
      "yearly"
    ];
    const verbs = [
      "write",
      "build",
      "develop",
      "implement",
      "design",
      "collaborate",
      "maintain",
      "improve",
      "ship",
      "create"
    ];
    if (blocked.some((word) => lower.includes(word))) return false;
    if (verbs.some((verb) => new RegExp(`\\b${verb}\\b`, "i").test(cleaned))) return false;

    const words = cleaned.split(/\s+/).filter(Boolean);
    const hasWorkMode = /\b(remote|hybrid|on[-\s]?site|onsite)\b/i.test(cleaned);
    if (!hasWorkMode && words.length > (options.maxWords || 8)) return false;

    return true;
  }

  function getVisibleLines() {
    return cleanText(document.body?.innerText || "")
      .split("\n")
      .map(cleanMetadataValue)
      .filter(Boolean);
  }

  function getInlineLabelValue(line, labels) {
    for (const label of labels) {
      const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:\\-\\u2013\\u2014]\\s*(.+)$`, "i");
      const match = line.match(pattern);
      if (match) return cleanMetadataValue(match[1]);
    }
    return "";
  }

  const METADATA_LABELS = [
    "Title",
    "Company",
    "Location",
    "Office",
    "Work Location",
    "Workplace",
    "Location Type",
    "Workplace Type",
    "Work Model",
    "Work Type",
    "Work Mode",
    "Employment Type",
    "Job Type",
    "Type",
    "Department",
    "Team",
    "Source",
    "URL",
    "Page Title"
  ].map(normalizeLabel);

  function isMetadataLabelLine(line) {
    const normalized = normalizeLabel(line).replace(/:$/, "");
    if (METADATA_LABELS.includes(normalized)) return true;
    return METADATA_LABELS.some((label) => {
      const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:\\-\\u2013\\u2014]`, "i");
      return pattern.test(line);
    });
  }

  function extractLabeledValue(lines, labels, options = {}) {
    const normalizedLabels = labels.map(normalizeLabel).sort((a, b) => b.length - a.length);

    for (let index = 0; index < lines.length; index += 1) {
      const line = cleanMetadataValue(lines[index]);
      const inlineValue = getInlineLabelValue(line, normalizedLabels);
      if (inlineValue && isShortMetadataValue(inlineValue, options)) return inlineValue;

      const normalizedLine = normalizeLabel(line).replace(/:$/, "");
      if (!normalizedLabels.includes(normalizedLine)) continue;

      for (let offset = 1; offset <= 4 && index + offset < lines.length; offset += 1) {
        const candidate = cleanMetadataValue(lines[index + offset]);
        const normalizedCandidate = normalizeLabel(candidate).replace(/:$/, "");
        if (!candidate || normalizedLabels.includes(normalizedCandidate) || isMetadataLabelLine(lines[index + offset])) continue;
        if (isShortMetadataValue(candidate, options)) return candidate;
        break;
      }
    }

    return "";
  }

  function pickAllowedValue(value, allowedPattern) {
    const cleaned = cleanMetadataValue(value);
    return cleaned && allowedPattern.test(cleaned) ? cleaned : "";
  }

  function extractPageMetadata() {
    const url = window.location.href;
    const hostname = window.location.hostname.replace(/^www\./, "");
    const pageTitle = document.title || "";
    const h1Text = firstVisibleText("h1");
    const titleCompany = parseTitleAndCompanyFromPageTitle(pageTitle);
    const lines = getVisibleLines();

    const location = extractLabeledValue(lines, ["Work Location", "Location", "Office", "Workplace"]);
    const locationType = pickAllowedValue(
      extractLabeledValue(lines, ["Location Type", "Workplace Type", "Work Model", "Work Type"], { maxWords: 4 }),
      /\b(remote|hybrid|on[-\s]?site|onsite)\b/i
    );
    const employmentType = pickAllowedValue(
      extractLabeledValue(lines, ["Employment Type", "Job Type", "Type"], { maxWords: 5 }),
      /\b(internship|intern|full[-\s]?time|part[-\s]?time|contract|co[-\s]?op)\b/i
    );
    const department = extractLabeledValue(lines, ["Department", "Team"], { maxWords: 6 });

    return {
      title: h1Text || titleCompany.title || "",
      company: inferCompany(hostname, titleCompany.company),
      location,
      employmentType,
      locationType,
      department,
      url,
      hostname,
      pageTitle
    };
  }

  function scoreText(text, selector, index) {
    const lower = text.toLowerCase();
    const lengthScore = Math.min(text.length, MAX_TEXT_LENGTH) / 100;
    const keywordScore = JOB_KEYWORDS.reduce((score, keyword) => {
      return score + (lower.includes(keyword) ? 75 : 0);
    }, 0);
    const selectorBoosts = {
      "main": 220,
      "article": 180,
      "[role=\"main\"]": 220,
      "[data-testid]": 120,
      "[class*=\"job\" i]": 170,
      "[class*=\"posting\" i]": 180,
      "[class*=\"description\" i]": 180,
      "[class*=\"ashby\" i]": 180,
      "body": -180
    };
    const hugePenalty = text.length > 45000 ? 350 : 0;
    const orderPenalty = index * 2;

    return lengthScore + keywordScore + (selectorBoosts[selector] || 0) - hugePenalty - orderPenalty;
  }

  function getBestVisibleContainerText() {
    const selectors = [
      "main",
      "article",
      '[role="main"]',
      "[data-testid]",
      '[class*="job" i]',
      '[class*="posting" i]',
      '[class*="description" i]',
      '[class*="ashby" i]',
      "body"
    ];

    let best = {
      text: cleanText(document.body.innerText || ""),
      score: -Infinity
    };

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((element, index) => {
        const text = visibleText(element);
        if (selector !== "body" && text.length < MIN_CONTAINER_LENGTH) return;

        const score = scoreText(text, selector, index);
        if (score > best.score) {
          best = { text, score };
        }
      });
    }

    return best.text || cleanText(document.body.innerText || "");
  }

  function buildPreview({ title, company, location, employmentType, locationType, department, hostname, url, pageTitle, jobText }) {
    return [
      `Title: ${title || ""}`,
      `Company: ${company || ""}`,
      `Location: ${location || ""}`,
      `Work Mode: ${locationType || ""}`,
      `Employment Type: ${employmentType || ""}`,
      `Department: ${department || ""}`,
      `Source: ${hostname || ""}`,
      `URL: ${url || ""}`,
      `Page Title: ${pageTitle || ""}`,
      "",
      "Job Posting:",
      jobText || ""
    ].join("\n");
  }

  window.extractJobText = function extractJobText() {
    const jobText = getBestVisibleContainerText();
    const metadata = extractPageMetadata();
    console.log("[Hyrra] Extracted metadata:", metadata);

    return {
      text: buildPreview({ ...metadata, jobText }),
      domain: metadata.hostname,
      sourceLabel: metadata.company || metadata.hostname,
      ...metadata
    };
  };
})();
