"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { SourcePill } from "@/components/ui/SourcePill";
import {
  getCandidateProfile,
  listJobs,
  listResumes,
  createApplySession,
  getApplySession,
  getApplyActionLog,
  resolveFieldSuggestion as apiResolveField,
  logApplyAction as apiLogAction,
  updateApplySession,
} from "@/lib/api";
import type {
  CandidateProfile,
  Job,
  Resume,
  ApplyAgentSession,
  ApplyAgentFieldSuggestion,
  ApplyAgentActionLog,
} from "@/types/api";

// ── Mock form fields ────────────────────────────────────────────────────

const MOCK_FORM_FIELDS = [
  { field_key: "full_name",        label: "Full Name",                               field_type: "text"     },
  { field_key: "email",            label: "Email Address",                           field_type: "email"    },
  { field_key: "phone",            label: "Phone Number",                            field_type: "text"     },
  { field_key: "school",           label: "School / University",                     field_type: "text"     },
  { field_key: "program",          label: "Program / Major",                         field_type: "text"     },
  { field_key: "graduation_year",  label: "Graduation Year",                         field_type: "text"     },
  { field_key: "linkedin_url",     label: "LinkedIn URL",                            field_type: "url"      },
  { field_key: "github_url",       label: "GitHub URL",                              field_type: "url"      },
  { field_key: "work_auth",        label: "Work Authorization",                      field_type: "select"   },
  { field_key: "why_interested",   label: "Why are you interested in this role?",    field_type: "textarea" },
  { field_key: "relevant_project", label: "Describe a relevant project.",            field_type: "textarea" },
  { field_key: "additional_info",  label: "Additional Information",                  field_type: "textarea" },
] as const;

// ── Types ────────────────────────────────────────────────────────────────

type Phase = "setup" | "review" | "complete";

interface FieldUi {
  editing:   boolean;
  editValue: string;
  loading:   boolean;
  error:     string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  accepted: "Accepted",
  edited:   "Edited",
  skipped:  "Skipped",
};

function timeLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const selectClass =
  "w-full bg-panel border border-border rounded-xl px-3 py-[10px] text-sm text-foreground outline-none focus:border-accent-violet/50 transition-colors";

const LS_KEY = "hyrra_apply_agent_last_session_id";

function readSavedSessionId(): number | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSavedSessionId(id: number) {
  try { localStorage.setItem(LS_KEY, String(id)); } catch { /* storage blocked */ }
}

function clearSavedSessionId() {
  try { localStorage.removeItem(LS_KEY); } catch { /* storage blocked */ }
}

// ── Main page ────────────────────────────────────────────────────────────

export default function ApplyAgentPage() {
  // ── Setup state ──
  const [loadingSetup,  setLoadingSetup]  = useState(true);
  const [profile,       setProfile]       = useState<CandidateProfile | null>(null);
  const [jobs,          setJobs]          = useState<Job[]>([]);
  const [resumes,       setResumes]       = useState<Resume[]>([]);
  const [jobId,         setJobId]         = useState<string>("");
  const [resumeId,      setResumeId]      = useState<string>("");
  const [apiKey,        setApiKey]        = useState("");
  const [starting,      setStarting]      = useState(false);
  const [startError,    setStartError]    = useState<string | null>(null);
  // localStorage resume
  const [savedId,       setSavedId]       = useState<number | null>(null);
  const [resuming,      setResuming]      = useState(false);
  const [resumeError,   setResumeError]   = useState<string | null>(null);

  // ── Review / complete state ──
  const [phase,       setPhase]       = useState<Phase>("setup");
  const [session,     setSession]     = useState<ApplyAgentSession | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, ApplyAgentFieldSuggestion>>({});
  const [actionLog,   setActionLog]   = useState<ApplyAgentActionLog[]>([]);
  const [fieldUi,     setFieldUi]     = useState<Record<string, FieldUi>>({});
  const [completing,  setCompleting]  = useState(false);
  const [completeErr, setCompleteErr] = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

  // ── Load setup data ──
  useEffect(() => {
    setSavedId(readSavedSessionId());
    Promise.all([getCandidateProfile(), listJobs(), listResumes()])
      .then(([p, jRes, rRes]) => {
        setProfile(p);
        setJobs(jRes.jobs);
        setResumes(rRes.resumes);
      })
      .catch(() => {/* silently show empty state */})
      .finally(() => setLoadingSetup(false));
  }, []);

  // ── Derived ──
  const resolvedCount = Object.values(suggestions).filter((s) => s.resolved_status !== null).length;
  const totalCount    = MOCK_FORM_FIELDS.length;
  const allResolved   = totalCount > 0 && resolvedCount === totalCount;

  // ── Shared: load a session + action log into review/complete state ──
  function mountSession(sess: ApplyAgentSession, logEntries: ApplyAgentActionLog[]) {
    setSession(sess);
    const sugMap: Record<string, ApplyAgentFieldSuggestion> = {};
    const uiMap:  Record<string, FieldUi>                   = {};
    for (const s of sess.suggestions) {
      sugMap[s.field_key] = s;
      uiMap[s.field_key]  = { editing: false, editValue: "", loading: false, error: null };
    }
    setSuggestions(sugMap);
    setFieldUi(uiMap);
    setActionLog(logEntries);
    setPhase(sess.status === "completed" ? "complete" : "review");
  }

  // ── Start session ──
  async function handleStart() {
    if (!profile || !jobId) return;
    setStarting(true);
    setStartError(null);
    try {
      const sess = await createApplySession({
        candidate_profile_id: profile.id,
        job_id:               Number(jobId),
        resume_id:            resumeId ? Number(resumeId) : null,
        api_key:              apiKey.trim() || null,
        form_fields:          [...MOCK_FORM_FIELDS],
      });
      writeSavedSessionId(sess.session_id);
      setSavedId(sess.session_id);
      mountSession(sess, []);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Failed to start session.");
    } finally {
      setStarting(false);
    }
  }

  // ── Resume session from localStorage ──
  async function handleResume() {
    if (!savedId) return;
    setResuming(true);
    setResumeError(null);
    try {
      const [sess, logRes] = await Promise.all([
        getApplySession(savedId),
        getApplyActionLog(savedId),
      ]);
      mountSession(sess, logRes.actions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resume session.";
      setResumeError(msg);
    } finally {
      setResuming(false);
    }
  }

  // ── Clear saved session ──
  function handleClearSaved() {
    clearSavedSessionId();
    setSavedId(null);
    setResumeError(null);
  }

  // ── Field UI helpers ──
  function patchUi(key: string, patch: Partial<FieldUi>) {
    setFieldUi((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function startEdit(key: string) {
    const sug = suggestions[key];
    // Prefill with the current resolved value first, then the original suggestion
    const prefill = sug?.final_value ?? sug?.suggested_value ?? "";
    patchUi(key, { editing: true, editValue: prefill, error: null });
  }

  function cancelEdit(key: string) {
    patchUi(key, { editing: false, editValue: "", error: null });
  }

  // ── Action handlers ──
  async function handleAccept(key: string) {
    const sug = suggestions[key];
    if (!session || !sug) return;
    patchUi(key, { loading: true, error: null });
    try {
      const resolved = await apiResolveField(session.session_id, key, {
        resolved_status: "accepted",
        final_value:     sug.suggested_value,
      });
      const logEntry = await apiLogAction(session.session_id, {
        field_key:        key,
        action_type:      "accepted",
        agent_suggestion: sug.suggested_value,
        final_value:      sug.suggested_value,
      });
      setSuggestions((prev) => ({ ...prev, [key]: resolved }));
      setActionLog((prev) => [...prev, logEntry]);
      patchUi(key, { loading: false });
    } catch (e) {
      patchUi(key, { loading: false, error: e instanceof Error ? e.message : "Action failed." });
    }
  }

  async function handleConfirmEdit(key: string) {
    const sug  = suggestions[key];
    const ui   = fieldUi[key];
    if (!session || !sug || !ui) return;
    const finalValue = ui.editValue.trim() || null;
    patchUi(key, { loading: true, error: null });
    try {
      const resolved = await apiResolveField(session.session_id, key, {
        resolved_status: "edited",
        final_value:     finalValue,
      });
      const logEntry = await apiLogAction(session.session_id, {
        field_key:        key,
        action_type:      "edited",
        agent_suggestion: sug.suggested_value,
        final_value:      finalValue,
      });
      setSuggestions((prev) => ({ ...prev, [key]: resolved }));
      setActionLog((prev) => [...prev, logEntry]);
      patchUi(key, { loading: false, editing: false, editValue: "" });
    } catch (e) {
      patchUi(key, { loading: false, error: e instanceof Error ? e.message : "Action failed." });
    }
  }

  async function handleSkip(key: string) {
    const sug = suggestions[key];
    if (!session || !sug) return;
    patchUi(key, { loading: true, error: null });
    try {
      const resolved = await apiResolveField(session.session_id, key, {
        resolved_status: "skipped",
        final_value:     null,
      });
      const logEntry = await apiLogAction(session.session_id, {
        field_key:        key,
        action_type:      "skipped",
        agent_suggestion: sug.suggested_value,
        final_value:      null,
      });
      setSuggestions((prev) => ({ ...prev, [key]: resolved }));
      setActionLog((prev) => [...prev, logEntry]);
      patchUi(key, { loading: false, editing: false });
    } catch (e) {
      patchUi(key, { loading: false, error: e instanceof Error ? e.message : "Action failed." });
    }
  }

  // ── Mark complete ──
  async function handleComplete() {
    if (!session) return;
    setCompleting(true);
    setCompleteErr(null);
    try {
      await updateApplySession(session.session_id, "completed");
      setPhase("complete");
    } catch (e) {
      setCompleteErr(e instanceof Error ? e.message : "Failed to mark complete.");
    } finally {
      setCompleting(false);
    }
  }

  // ── Copy all ──
  function handleCopyAll() {
    const lines = MOCK_FORM_FIELDS.map((f) => {
      const s   = suggestions[f.field_key];
      const val = s?.resolved_status === "skipped"
        ? "Skipped"
        : s?.final_value ?? s?.suggested_value ?? "";
      return `${f.label}: ${val}`;
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: loading
  // ══════════════════════════════════════════════════════════════════════

  if (loadingSetup) {
    return (
      <>
        <Topbar title="Apply Agent" subtitle="AI-assisted application form filler" />
        <div className="hyrra-page-stack">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: setup phase
  // ══════════════════════════════════════════════════════════════════════

  if (phase === "setup") {
    return (
      <>
        <Topbar title="Apply Agent" subtitle="Set up a session and get field suggestions" />

        <div className="max-w-xl hyrra-page-stack">

          {/* Resume previous session */}
          {savedId !== null && (
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold mb-0.5">Previous session found</h3>
                  <p className="text-xs text-muted">Session #{savedId} — resume where you left off without re-entering your API key.</p>
                  {resumeError && (
                    <p className="text-xs text-danger mt-2">{resumeError}</p>
                  )}
                </div>
                <button
                  onClick={handleClearSaved}
                  className="text-xs text-muted hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
                  title="Remove saved session"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <GradientButton size="sm" onClick={handleResume} disabled={resuming}>
                  {resuming ? "Resuming…" : "Resume previous session"}
                </GradientButton>
              </div>
            </Card>
          )}

          {/* Profile status */}
          <Card>
            <h3 className="text-sm font-semibold mb-3">Candidate Profile</h3>
            {profile ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">{profile.label}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "No name set"}
                    {profile.email ? ` · ${profile.email}` : ""}
                  </p>
                </div>
                <Link href="/candidate-profile" className="text-xs text-accent-violet hover:underline">
                  Edit
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
                <p className="text-sm text-yellow-400 font-medium">No candidate profile found.</p>
                <p className="text-xs text-muted mt-1">
                  You need a profile before starting a session.{" "}
                  <Link href="/candidate-profile" className="text-accent-violet hover:underline">
                    Create profile →
                  </Link>
                </p>
              </div>
            )}
          </Card>

          {/* Job selector */}
          <Card>
            <h3 className="text-sm font-semibold mb-3">Select Job <span className="text-danger">*</span></h3>
            {jobs.length === 0 ? (
              <p className="text-xs text-muted">No jobs saved yet. Add a job on the Jobs page first.</p>
            ) : (
              <select className={selectClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">— Choose a job —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.company}
                  </option>
                ))}
              </select>
            )}
          </Card>

          {/* Resume selector (optional) */}
          <Card>
            <h3 className="text-sm font-semibold mb-3">Select Resume <span className="text-muted">(optional)</span></h3>
            <select className={selectClass} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">— No resume —</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-2">
              Adding a resume improves suggestion quality for education and skills fields.
            </p>
          </Card>

          {/* OpenAI API key (optional) */}
          <Card>
            <h3 className="text-sm font-semibold mb-3">
              OpenAI API Key <span className="text-muted">(optional)</span>
            </h3>
            <input
              type="password"
              className="w-full bg-panel border border-border rounded-xl px-3 py-[10px] text-sm text-foreground placeholder:text-muted outline-none focus:border-accent-violet/50 transition-colors"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
            <p className="text-xs text-muted mt-2">
              Used only for textarea field suggestions (why interested, projects). Not stored.
            </p>
          </Card>

          {/* Start button */}
          <div className="flex flex-col gap-3">
            <GradientButton
              onClick={handleStart}
              disabled={!profile || !jobId || starting}
            >
              {starting ? "Starting session…" : "Start Apply Session"}
            </GradientButton>
            {!profile && (
              <p className="text-xs text-yellow-400">Create a candidate profile to enable this button.</p>
            )}
            {startError && <p className="text-xs text-danger">{startError}</p>}
          </div>

        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: complete phase
  // ══════════════════════════════════════════════════════════════════════

  if (phase === "complete") {
    return (
      <>
        <Topbar
          title="Apply Agent — Complete"
          subtitle={`Session ${session?.session_id} · ${session?.job_title ?? ""} @ ${session?.job_company ?? ""}`}
        />

        <div className="hyrra-page-stack">
          <div className="flex items-center justify-between">
            <p className="text-sm text-accent-cyan font-semibold">
              Session marked complete. All {totalCount} fields resolved.
            </p>
            <GradientButton variant="secondary" size="sm" onClick={handleCopyAll}>
              {copied ? "Copied!" : "Copy all values"}
            </GradientButton>
          </div>

          <Card>
            <h3 className="text-sm font-semibold mb-4">Field Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs text-muted font-medium pb-2 pr-4">Field</th>
                    <th className="text-left text-xs text-muted font-medium pb-2 pr-4">Final value</th>
                    <th className="text-left text-xs text-muted font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_FORM_FIELDS.map((f) => {
                    const s   = suggestions[f.field_key];
                    const val = s?.resolved_status === "skipped"
                      ? "—"
                      : s?.final_value ?? s?.suggested_value ?? "—";
                    const status = s?.resolved_status ?? "pending";
                    const statusColor =
                      status === "accepted" ? "text-emerald-400"
                      : status === "edited"   ? "text-yellow-400"
                      : status === "skipped"  ? "text-zinc-400"
                      :                        "text-danger";
                    return (
                      <tr key={f.field_key} className="border-b border-white/[0.04]">
                        <td className="py-2.5 pr-4 text-muted text-xs whitespace-nowrap">{f.label}</td>
                        <td className="py-2.5 pr-4 text-foreground text-xs max-w-xs truncate">{val}</td>
                        <td className={`py-2.5 text-xs font-semibold capitalize ${statusColor}`}>{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: review phase
  // ══════════════════════════════════════════════════════════════════════

  return (
    <>
      <Topbar
        title="Apply Agent — Review"
        subtitle={`${session?.job_title ?? "Job"} @ ${session?.job_company ?? ""}`}
      />

      <div className="hyrra-page-stack">

        {/* Progress row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                {resolvedCount} of {totalCount} fields resolved
              </span>
              {/* Progress bar */}
              <div className="flex-1 max-w-[200px] h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-violet to-accent-cyan rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted mt-1">
              Accept, Edit, or Skip each field. Your decisions are logged below.
            </p>
          </div>
          {allResolved && (
            <div className="flex items-center gap-3">
              {completeErr && <span className="text-xs text-danger">{completeErr}</span>}
              <GradientButton onClick={handleComplete} disabled={completing} size="sm">
                {completing ? "Saving…" : "Mark Complete"}
              </GradientButton>
            </div>
          )}
        </div>

        {/* Two-column layout: cards + log */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Left: field cards ── */}
          <div className="flex flex-col gap-4">
            {MOCK_FORM_FIELDS.map((f) => {
              const sug = suggestions[f.field_key];
              const ui  = fieldUi[f.field_key] ?? { editing: false, editValue: "", loading: false, error: null };
              const resolved = sug?.resolved_status !== null && sug?.resolved_status !== undefined;

              return (
                <div
                  key={f.field_key}
                  data-field-key={f.field_key}
                  data-confidence={sug?.confidence ?? 0}
                  data-needs-review={String(sug?.needs_review ?? true)}
                  data-source={sug?.source ?? "none"}
                  className={`rounded-2xl border hyrra-card-padding transition-all duration-200 ${
                    resolved && !ui.editing
                      ? "bg-white/[0.02] border-white/5 opacity-80"
                      : "bg-gradient-to-b from-[#16171d] to-[#101116] border-white/5"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-foreground">{f.label}</span>
                      {sug && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <ConfidenceBadge confidence={sug.confidence} needsReview={sug.needs_review} />
                          <SourcePill source={sug.source} />
                        </div>
                      )}
                    </div>
                    {resolved && !ui.editing && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        sug?.resolved_status === "accepted" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                        : sug?.resolved_status === "edited" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                        :                                     "text-zinc-400 bg-white/5 border-white/10"
                      }`}>
                        {sug?.resolved_status === "accepted" ? "Accepted"
                          : sug?.resolved_status === "edited" ? "Edited"
                          : "Skipped"}
                      </span>
                    )}
                  </div>

                  {/* Suggestion value */}
                  {!ui.editing && (
                    <div className="mb-3">
                      {resolved && sug?.resolved_status === "skipped" ? (
                        <p className="text-xs text-zinc-500 italic">Skipped</p>
                      ) : resolved ? (
                        <p className="text-sm text-foreground bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5">
                          {sug?.final_value ?? sug?.suggested_value ?? "—"}
                        </p>
                      ) : sug?.suggested_value ? (
                        <p className="text-sm text-foreground bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5">
                          {sug.suggested_value}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">No suggestion available — enter manually.</p>
                      )}
                    </div>
                  )}

                  {/* Reasoning */}
                  {!resolved && sug?.reasoning && !ui.editing && (
                    <p className="text-xs text-muted mb-3">{sug.reasoning}</p>
                  )}

                  {/* Review warning */}
                  {!resolved && sug?.needs_review && !ui.editing && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-[10px] text-yellow-400">⚠ Review before accepting</span>
                    </div>
                  )}

                  {/* Edit input */}
                  {ui.editing && (
                    <div className="mb-3">
                      {f.field_type === "textarea" ? (
                        <textarea
                          className="w-full bg-panel border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent-violet/50 transition-colors resize-y min-h-[80px]"
                          value={ui.editValue}
                          onChange={(e) => patchUi(f.field_key, { editValue: e.target.value })}
                          placeholder="Enter your answer…"
                          autoFocus
                        />
                      ) : (
                        <input
                          type={f.field_type === "email" ? "email" : f.field_type === "url" ? "url" : "text"}
                          className="w-full bg-panel border border-border rounded-xl px-3 py-[10px] text-sm text-foreground placeholder:text-muted outline-none focus:border-accent-violet/50 transition-colors"
                          value={ui.editValue}
                          onChange={(e) => patchUi(f.field_key, { editValue: e.target.value })}
                          placeholder="Enter value…"
                          autoFocus
                        />
                      )}
                    </div>
                  )}

                  {/* Per-field error */}
                  {ui.error && (
                    <p className="text-xs text-danger mb-2">{ui.error}</p>
                  )}

                  {/* Action buttons — 3-way: editing | resolved-idle | unresolved */}
                  {ui.editing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <GradientButton
                        size="sm"
                        onClick={() => handleConfirmEdit(f.field_key)}
                        disabled={ui.loading}
                      >
                        {ui.loading ? "Saving…" : "Confirm"}
                      </GradientButton>
                      <GradientButton
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelEdit(f.field_key)}
                        disabled={ui.loading}
                      >
                        Cancel
                      </GradientButton>
                    </div>
                  ) : resolved ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(f.field_key)}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground hover:bg-white/5 transition-all duration-200"
                      >
                        {sug?.resolved_status === "skipped" ? "Add value" : "Edit again"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        data-agent-action="accept"
                        onClick={() => handleAccept(f.field_key)}
                        disabled={ui.loading || !sug?.suggested_value}
                        className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                          sug?.needs_review
                            ? "border border-yellow-500/30 text-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10"
                            : "border border-emerald-500/30 text-emerald-400 bg-emerald-400/5 hover:bg-emerald-400/10"
                        }`}
                      >
                        {ui.loading ? "…" : "Accept"}
                      </button>
                      <button
                        onClick={() => startEdit(f.field_key)}
                        disabled={ui.loading}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground hover:bg-white/5 transition-all duration-200 disabled:opacity-40"
                      >
                        {sug?.suggested_value ? "Edit" : "Enter manually"}
                      </button>
                      <button
                        onClick={() => handleSkip(f.field_key)}
                        disabled={ui.loading}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-200 disabled:opacity-40"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Right: action log ── */}
          <div className="sticky top-[90px]">
            <Card>
              <h3 className="text-sm font-semibold mb-3">Action Log</h3>
              {actionLog.length === 0 ? (
                <p className="text-xs text-muted">No actions yet. Accept, Edit, or Skip fields to see the log.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
                  {actionLog.map((entry) => {
                    const fieldMeta = MOCK_FORM_FIELDS.find((f) => f.field_key === entry.field_key);
                    const actionColor =
                      entry.action_type === "accepted" ? "text-emerald-400"
                      : entry.action_type === "edited"   ? "text-yellow-400"
                      :                                    "text-zinc-400";
                    return (
                      <div
                        key={entry.action_id}
                        className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-foreground font-medium truncate">
                            {fieldMeta?.label ?? entry.field_key}
                          </span>
                          <span className={`font-semibold shrink-0 capitalize ${actionColor}`}>
                            {ACTION_LABEL[entry.action_type] ?? entry.action_type}
                          </span>
                        </div>
                        {entry.action_type !== "skipped" && entry.final_value && (
                          <p className="text-muted truncate">{entry.final_value}</p>
                        )}
                        <p className="text-zinc-600 mt-0.5">{timeLabel(entry.logged_at)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
    </>
  );
}
