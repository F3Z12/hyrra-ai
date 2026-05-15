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
  const JOB_TITLE_WORDS = [
    "intern",
    "internship",
    "co-op",
    "coop",
    "engineer",
    "developer",
    "analyst",
    "product",
    "manager",
    "designer",
    "data",
    "software",
    "backend",
    "frontend",
    "full stack",
    "machine learning",
    "ai",
    "enablement",
    "associate",
    "specialist",
    "consultant",
    "wealth",
    "business",
    "technology",
    "finance",
    "executive",
    "sales",
    "marketing",
    "operations",
    "coordinator",
    "director",
    "lead",
    "principal",
    "architect",
    "administrator",
    "representative",
    "customer",
    "solutions",
    "security",
    "devops",
    "qa",
    "research",
    "scientist"
  ];
  const SEASON_YEAR_PATTERN = /\b(fall|winter|spring|summer|20\d{2}|intern|co[-\s]?op|coop)\b/i;
  const BAD_TITLE_VALUES = new Set([
    "careers",
    "jobs",
    "home",
    "candidate home",
    "search jobs",
    "search for jobs",
    "job alerts",
    "why choose us",
    "settings",
    "english",
    "view application",
    "applied for this job",
    "read more",
    "accessibility",
    "faq",
    "labor posters",
    "our values",
    "job posting",
    "job description",
    "description",
    "department",
    "team",
    "location",
    "work mode",
    "employment type",
    "td careers",
    "td"
  ]);

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

  function hasExcludedAncestor(element) {
    const excludedSelector = [
      "header",
      "nav",
      "footer",
      "aside",
      "[role='navigation']",
      "[aria-label*='navigation' i]",
      "[class*='nav' i]",
      "[id*='nav' i]",
      "[class*='navbar' i]",
      "[id*='navbar' i]",
      "[class*='header' i]",
      "[id*='header' i]",
      "[class*='footer' i]",
      "[id*='footer' i]",
      "[class*='menu' i]",
      "[id*='menu' i]",
      "[class*='breadcrumb' i]",
      "[id*='breadcrumb' i]"
    ].join(",");
    return Boolean(element.closest(excludedSelector));
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

  function normalizeTitleForCompare(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function hasRoleWord(value) {
    const lower = normalizeTitleForCompare(value);
    return JOB_TITLE_WORDS.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(lower));
  }

  function isBadTitleCandidate(value, company = "") {
    const cleaned = cleanMetadataValue(value);
    if (!cleaned || cleaned.length < 5 || cleaned.length > 160) return true;

    const lower = normalizeTitleForCompare(cleaned);
    const companyLower = normalizeTitleForCompare(company);
    if (BAD_TITLE_VALUES.has(lower)) return true;
    if (companyLower && (lower === companyLower || lower === `${companyLower} careers`)) return true;
    if (/\byou applied for this job\b/i.test(cleaned)) return true;
    if (/\bcareers$/i.test(cleaned) && !hasRoleWord(cleaned)) return true;
    if (/^(as a|you will|we are|our|about)\b/i.test(cleaned)) return true;
    if ((cleaned.match(/[.!?]/g) || []).length > 1) return true;
    if (/[.!?]\s+\S/.test(cleaned) && cleaned.split(/\s+/).length > 10) return true;

    const punctuationCount = (cleaned.match(/[,:;|/\\()[\]{}]/g) || []).length;
    if (punctuationCount > Math.max(6, cleaned.length / 12)) return true;

    return false;
  }

  function isValidJobTitle(value, company = "") {
    const cleaned = cleanMetadataValue(value);
    if (isBadTitleCandidate(cleaned, company)) return false;

    const words = cleaned.split(/\s+/).filter(Boolean);
    const responsibilityVerbs = /\b(write|build|develop|design|support|collaborate|manage|analyze|create)\b/i;
    if (responsibilityVerbs.test(cleaned) && !hasRoleWord(cleaned)) return false;
    if (words.length > 18 && !hasRoleWord(cleaned)) return false;

    return hasRoleWord(cleaned) || SEASON_YEAR_PATTERN.test(cleaned);
  }

  function scoreTitleCandidate(candidate, company = "") {
    if (!isValidJobTitle(candidate.text, company)) return -Infinity;

    let score = 0;
    const text = cleanMetadataValue(candidate.text);
    const lower = text.toLowerCase();

    if (candidate.tagName === "H1") score += 70;
    if (candidate.tagName === "H2") score += 45;
    if (candidate.tagName === "H3") score += 25;
    if (candidate.inMain) score += 55;
    if (candidate.nearFacts) score += 35;
    if (candidate.source === "pageTitle") score += 15;
    if (candidate.source === "url") score -= 35;
    if (text.length >= 8 && text.length <= 140) score += 25;
    if (/[()]/.test(text)) score += 15;
    if (SEASON_YEAR_PATTERN.test(text)) score += 30;
    for (const word of JOB_TITLE_WORDS) {
      if (new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(lower)) score += 12;
    }
    if (/\bcareers?\b/i.test(text) && !hasRoleWord(text)) score -= 120;

    return score - (candidate.index || 0);
  }

  function parseTitleFromDocumentTitle(pageTitle, company = "") {
    const normalized = (pageTitle || "").replace(/\s+/g, " ").trim();
    const parts = normalized.split(/\s*[|–—]\s*/).map(cleanMetadataValue).filter(Boolean);
    const bestPart = parts.find((part) => isValidJobTitle(part, company));
    return bestPart || "";
  }

  function titleFromUrlSlug(company = "") {
    const segments = window.location.pathname.split("/").filter(Boolean).reverse();
    for (const segment of segments) {
      const decoded = decodeURIComponent(segment);
      const titled = titleCaseSlug(decoded);
      if (isValidJobTitle(titled, company)) return titled;
    }
    return "";
  }

  function extractBestJobTitle(company = "", pageTitleFallback = "") {
    const candidates = [];
    const factPattern = /\b(location|employment type|department|posted|end date|apply|application|work mode|work type)\b/i;

    document.querySelectorAll("h1,h2,h3,[class*='title' i],[data-testid*='title' i]").forEach((element, index) => {
      if (!isVisible(element) || hasExcludedAncestor(element)) return;
      if (element.closest("button,a")) return;

      const text = cleanMetadataValue((element.innerText || element.textContent || "").split("\n")[0]);
      const containerText = cleanText(element.closest("main,article,[role='main'],[class*='job' i],[class*='posting' i],[class*='detail' i]")?.innerText || "");
      candidates.push({
        text,
        tagName: element.tagName,
        inMain: Boolean(element.closest("main,article,[role='main']")),
        nearFacts: factPattern.test(containerText),
        source: "dom",
        index
      });
    });

    const pageTitleCandidate = parseTitleFromDocumentTitle(document.title || pageTitleFallback, company);
    if (pageTitleCandidate) {
      candidates.push({ text: pageTitleCandidate, tagName: "", inMain: false, nearFacts: false, source: "pageTitle", index: candidates.length });
    }

    if (pageTitleFallback && pageTitleFallback !== pageTitleCandidate) {
      candidates.push({ text: pageTitleFallback, tagName: "", inMain: false, nearFacts: false, source: "pageTitle", index: candidates.length });
    }

    const slugTitle = titleFromUrlSlug(company);
    if (slugTitle) {
      candidates.push({ text: slugTitle, tagName: "", inMain: false, nearFacts: false, source: "url", index: candidates.length });
    }

    const best = candidates
      .map((candidate) => ({ ...candidate, score: scoreTitleCandidate(candidate, company) }))
      .filter((candidate) => candidate.score > -Infinity)
      .sort((a, b) => b.score - a.score)[0];

    return cleanMetadataValue(best?.text || "");
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

  function cleanWWValue(value) {
    const cleaned = cleanMetadataValue(value);
    const blockedUiTokens = new Set([
      "swap_vert",
      "fiber_manual_record",
      "create_new_folder",
      "do_not_disturb",
      "playlist_add",
      "playlist_remove",
      "print",
      "select row",
      "check_circle",
      "fast_rewind",
      "keyboard_arrow_left",
      "keyboard_arrow_right",
      "fast_forward"
    ]);
    return blockedUiTokens.has(cleaned.toLowerCase()) ? "" : cleaned;
  }

  function getValueAfterLabel(lines, label) {
    const normalizedLabel = normalizeLabel(label).replace(/:$/, "");
    for (let index = 0; index < lines.length; index += 1) {
      const line = cleanWWValue(lines[index]);
      const normalizedLine = normalizeLabel(line).replace(/:$/, "");
      const inlinePattern = new RegExp(`^${escapeRegExp(label)}\\s*:?\\s+(.+)$`, "i");
      const inlineMatch = line.match(inlinePattern);
      if (inlineMatch) return cleanWWValue(inlineMatch[1]);
      if (normalizedLine !== normalizedLabel) continue;

      for (let offset = 1; offset <= 3 && index + offset < lines.length; offset += 1) {
        const candidate = cleanWWValue(lines[index + offset]);
        if (!candidate || /^fiber_manual_record$/i.test(candidate)) continue;
        return candidate;
      }
    }
    return "";
  }

  function getMultiLineValueAfterLabel(lines, label) {
    return getValueAfterLabel(lines, label);
  }

  function findWaterlooWorksDetailLines(lines) {
    let markerIndex = lines.findIndex((line, index) => {
      if (!/^job posting information$/i.test(cleanWWValue(line))) return false;
      const nearbyBefore = lines.slice(Math.max(0, index - 15), index).join("\n");
      const nearbyAfter = lines.slice(index, index + 30).join("\n");
      return /\b\d{6}\b/.test(nearbyBefore) && /work term|job type|job title/i.test(nearbyAfter);
    });

    if (markerIndex < 0) {
      markerIndex = lines.findIndex((line, index) => {
        if (!/^return to job search overview$/i.test(cleanWWValue(line))) return false;
        const nearby = lines.slice(index, index + 20).join("\n");
        return /\b\d{6}\b/.test(nearby) && /job posting information|job title|work term/i.test(nearby);
      });
    }

    if (markerIndex < 0) return [];

    let start = markerIndex;
    for (let index = markerIndex; index >= Math.max(0, markerIndex - 12); index -= 1) {
      if (/^return to job search overview$/i.test(cleanWWValue(lines[index]))) {
        start = index;
        break;
      }
      if (/^\d{6}$/.test(cleanWWValue(lines[index]))) {
        start = Math.max(0, index - 1);
      }
    }

    let end = lines.length;
    const footerPattern = /^(service team|myaccount|log out)$/i;
    for (let index = markerIndex + 1; index < lines.length; index += 1) {
      if (footerPattern.test(cleanWWValue(lines[index]))) {
        end = index;
        break;
      }
    }

    return lines.slice(start, end).map(cleanWWValue).filter(Boolean);
  }

  function extractWaterlooWorksSummary(lines) {
    const idIndex = lines.findIndex((line) => /^\d{6}$/.test(cleanWWValue(line)));
    if (idIndex < 0) return {};
    const title = cleanWWValue(lines[idIndex + 1] || "");
    const companyDivision = cleanWWValue(lines[idIndex + 2] || "");
    const [company, division] = companyDivision.split(/\s+-\s+/, 2).map(cleanWWValue);
    return {
      jobId: cleanWWValue(lines[idIndex]),
      title,
      company,
      division
    };
  }

  function extractWaterlooWorksMetadata(lines) {
    const summary = extractWaterlooWorksSummary(lines);
    const postingLine = lines.find((line) => /job posting:\s*\d+.*position:/i.test(line)) || "";
    const postingMatch = postingLine.match(/job posting:\s*(\d+)\s*-\s*position:\s*(.+)$/i);
    const city = getValueAfterLabel(lines, "Job - City");
    const province = getValueAfterLabel(lines, "Job - Province/State");
    const country = getValueAfterLabel(lines, "Job - Country");
    const region = getValueAfterLabel(lines, "Region");
    let location = "";

    if (city && province) {
      location = `${city}, ${province}`;
    } else if (city) {
      location = country && !/^canada$/i.test(country) ? `${city}, ${country}` : city;
    } else if (region) {
      location = region.replace(/^[A-Z]{2}\s+-\s+/, "");
    }

    const organization = getValueAfterLabel(lines, "Organization");
    const division = getValueAfterLabel(lines, "Division") || summary.division || "";

    return {
      title: getValueAfterLabel(lines, "Job Title") || cleanWWValue(postingMatch?.[2] || "") || summary.title || "",
      company: organization || summary.company || "",
      location,
      locationType: getValueAfterLabel(lines, "Employment Location Arrangement"),
      employmentType: getValueAfterLabel(lines, "Job Type"),
      department: division,
      jobId: cleanWWValue(postingMatch?.[1] || "") || summary.jobId || "",
      workTerm: getValueAfterLabel(lines, "Work Term"),
      deadline: getValueAfterLabel(lines, "Application Deadline") || getValueAfterLabel(lines, "App Deadline"),
      applicationMethod: getValueAfterLabel(lines, "Application Delivery"),
      applicationEmail: getMultiLineValueAfterLabel(lines, "If By Email, Send To")
    };
  }

  function buildWaterlooWorksPreview({ metadata, hostname, url, pageTitle, jobText }) {
    return [
      `Title: ${metadata.title || ""}`,
      `Company: ${metadata.company || ""}`,
      `Location: ${metadata.location || ""}`,
      `Work Mode: ${metadata.locationType || ""}`,
      `Employment Type: ${metadata.employmentType || ""}`,
      `Department: ${metadata.department || ""}`,
      `Source: ${hostname || ""}`,
      `URL: ${url || ""}`,
      `Page Title: ${pageTitle || ""}`,
      `Job ID: ${metadata.jobId || ""}`,
      `Work Term: ${metadata.workTerm || ""}`,
      `Application Deadline: ${metadata.deadline || ""}`,
      `Application Method: ${metadata.applicationMethod || ""}`,
      `Application Email: ${metadata.applicationEmail || ""}`,
      "",
      "Job Posting:",
      jobText || ""
    ].join("\n");
  }

  function extractWaterlooWorksJob(hostname) {
    const url = window.location.href;
    const pageTitle = document.title || "";
    const lines = getVisibleLines();
    const detailLines = findWaterlooWorksDetailLines(lines);
    const jobText = cleanText(detailLines.join("\n"));
    const metadata = extractWaterlooWorksMetadata(detailLines);

    return {
      text: buildWaterlooWorksPreview({ metadata, hostname, url, pageTitle, jobText }),
      domain: hostname,
      sourceLabel: metadata.company || hostname,
      hostname,
      url,
      pageTitle,
      title: metadata.title,
      company: metadata.company,
      location: metadata.location,
      employmentType: metadata.employmentType,
      locationType: metadata.locationType,
      department: metadata.department
    };
  }

  function extractPageMetadata() {
    const url = window.location.href;
    const hostname = window.location.hostname.replace(/^www\./, "");
    const pageTitle = document.title || "";
    const titleCompany = parseTitleAndCompanyFromPageTitle(pageTitle);
    const lines = getVisibleLines();
    const company = inferCompany(hostname, titleCompany.company);

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
      title: extractBestJobTitle(company, titleCompany.title),
      company,
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

  // ── Apply Demo context extractor ──────────────────────────────────────────
  // Used when popup detects the controlled Hyrra mock application page.
  // Returns stable form field metadata from data-apply-field attributes.
  // No heuristics — only works on pages with data-hyrra-apply-demo="true".
  window.extractApplyDemoContext = function extractApplyDemoContext() {
    const marker = document.querySelector('[data-hyrra-apply-demo="true"]');
    if (!marker) {
      return { isApplyDemo: false, jobId: null, targetUrl: "", pageTitle: "", formFields: [] };
    }

    // Job ID comes from the DOM attribute set by React state — never from localStorage.
    const jobIdRaw = marker.getAttribute("data-hyrra-job-id");
    const jobId = jobIdRaw ? (parseInt(jobIdRaw, 10) || null) : null;
    const targetUrl = window.location.href;
    const pageTitle = document.title ||
      (document.querySelector("h1") || {}).textContent?.trim() || "";

    const formFields = [];
    document.querySelectorAll("[data-apply-field]").forEach(function (el) {
      const fieldKey = el.dataset.applyField;
      if (!fieldKey) return;

      // Field type: select / textarea / input type
      var fieldType;
      if (el.tagName === "SELECT") fieldType = "select";
      else if (el.tagName === "TEXTAREA") fieldType = "textarea";
      else fieldType = el.type || "text";

      // Label resolution order:
      // 1. <label for="id"> text   2. aria-label   3. placeholder   4. field_key
      var label = fieldKey;
      var idAttr = el.id || el.name || fieldKey;
      var labelEl = idAttr ? document.querySelector('label[for="' + idAttr + '"]') : null;
      if (labelEl) {
        label = (labelEl.textContent || "").replace(/\s*\*\s*$/, "").trim() || fieldKey;
      } else {
        label = el.getAttribute("aria-label") || el.placeholder || fieldKey;
      }

      // Stable CSS selector using the data attribute (matches the wrapper too)
      var selector = '[data-apply-field="' + fieldKey + '"]';

      formFields.push({ field_key: fieldKey, label: label, field_type: fieldType, selector: selector });
    });

    return { isApplyDemo: true, jobId: jobId, targetUrl: targetUrl, pageTitle: pageTitle, formFields: formFields };
  };

  window.extractJobText = function extractJobText() {
    const hostname = window.location.hostname.replace(/^www\./, "");
    if (hostname.includes("waterlooworks.uwaterloo.ca")) {
      const waterlooWorksJob = extractWaterlooWorksJob(hostname);
      console.log("[Hyrra] Extracted WaterlooWorks metadata:", waterlooWorksJob);
      return waterlooWorksJob;
    }

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
