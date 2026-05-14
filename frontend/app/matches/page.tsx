"use client";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { SkillTag } from "@/components/ui/SkillTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Sparkles, FileText, Clock } from "lucide-react";
import { listMatches, listJobs, listResumes, createMatch, explainMatch } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import type { MatchResult, Job, Resume, AIExplanation } from "@/types/api";

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  // New match modal
  const [newMatchOpen, setNewMatchOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selJob, setSelJob] = useState(0);
  const [selResume, setSelResume] = useState(0);
  const [matching, setMatching] = useState(false);

  // AI modal
  const [aiModal, setAiModal] = useState(false);
  const [aiTarget, setAiTarget] = useState<MatchResult | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [aiError, setAiError] = useState("");

  const load = () => {
    setLoading(true);
    listMatches().then((r) => setMatches(r.matches.sort((a, b) => b.match_score - a.match_score))).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNewMatch = () => {
    Promise.all([listJobs(), listResumes()]).then(([j, r]) => {
      setJobs(j.jobs); setResumes(r.resumes);
      if (j.jobs.length) setSelJob(j.jobs[0].id);
      if (r.resumes.length) setSelResume(r.resumes[0].id);
    });
    setNewMatchOpen(true);
  };

  const handleNewMatch = async () => {
    if (!selJob || !selResume) return;
    setMatching(true);
    try { await createMatch(selJob, selResume); setNewMatchOpen(false); load(); } catch { /* ignore */ }
    finally { setMatching(false); }
  };

  const openAi = (m: MatchResult) => {
    setAiTarget(m); setExplanation(null); setAiError(""); setAiModal(true);
  };

  const runExplain = async () => {
    if (!aiTarget || !apiKey.trim()) return;
    setAiLoading(true); setAiError("");
    try {
      const r = await explainMatch(aiTarget.job_id, aiTarget.resume_id, apiKey);
      setExplanation(r.explanation);
    } catch (e: unknown) { setAiError(e instanceof Error ? e.message : "Failed."); }
    finally { setAiLoading(false); }
  };

  return (
    <>
      <Topbar
        title="Matches"
        subtitle={`${matches.length} match analyses · ranked by score`}
        action={<GradientButton onClick={openNewMatch}><Sparkles size={16} /> Run new match</GradientButton>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-muted">Loading…</div>
      ) : matches.length === 0 ? (
        <Card><EmptyState title="No matches yet" description="Run your first match from the Jobs page." /></Card>
      ) : (
        <div className="hyrra-section-stack">
          {matches.map((m) => (
            <Card key={m.id} hover>
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-base font-semibold text-foreground truncate">{m.job_title || "Job"}</span>
                    <MatchScoreBadge score={m.match_score} />
                  </div>
                  <div className="text-sm text-muted mb-2">{m.job_company}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-dark mb-3">
                    {m.resume_name && <span className="flex items-center gap-1.5"><FileText size={12} /> {m.resume_name}</span>}
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {timeAgo(m.created_at)}</span>
                  </div>
                  <span className="text-xs text-muted bg-white/5 px-2.5 py-1.5 rounded-md border border-white/5">
                    Recommendation: <strong className="text-foreground font-medium ml-1">{m.recommendation}</strong>
                  </span>
                </div>

                {/* Skills */}
                <div className="w-full lg:w-64 shrink-0 lg:pl-6 lg:border-l border-white/5">
                  {m.matched_skills.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">Matched skills</span>
                      <div className="flex flex-wrap gap-1">{m.matched_skills.slice(0, 6).map((s) => <SkillTag key={s} skill={s} variant="matched" />)}</div>
                    </div>
                  )}
                  {m.missing_required_skills.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">Missing skills</span>
                      <div className="flex flex-wrap gap-1">{m.missing_required_skills.slice(0, 4).map((s) => <SkillTag key={s} skill={s} variant="missing" />)}</div>
                    </div>
                  )}
                </div>

                {/* AI button */}
                <div className="lg:pl-6 lg:border-l border-white/5">
                  <GradientButton variant="secondary" size="sm" onClick={() => openAi(m)}>
                    <Sparkles size={14} /> View explanation
                  </GradientButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New match modal */}
      <Modal open={newMatchOpen} onClose={() => setNewMatchOpen(false)} title="Run New Match">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Job</label>
            <select value={selJob} onChange={(e) => setSelJob(Number(e.target.value))} className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground">
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title || "Untitled"} – {j.company}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Resume</label>
            <select value={selResume} onChange={(e) => setSelResume(Number(e.target.value))} className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground">
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <GradientButton variant="secondary" onClick={() => setNewMatchOpen(false)}>Cancel</GradientButton>
            <GradientButton onClick={handleNewMatch} disabled={matching}>{matching ? "Matching…" : "Run Match"}</GradientButton>
          </div>
        </div>
      </Modal>

      {/* AI explanation modal */}
      <Modal open={aiModal} onClose={() => setAiModal(false)} title="AI Match Explanation" wide>
        {explanation ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">{explanation.summary}</p>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-xs text-success font-medium">Strengths</span><ul className="mt-1 space-y-1">{explanation.strengths.map((s, i) => <li key={i} className="text-xs text-muted">✓ {s}</li>)}</ul></div>
              <div><span className="text-xs text-danger font-medium">Weaknesses</span><ul className="mt-1 space-y-1">{explanation.weaknesses.map((w, i) => <li key={i} className="text-xs text-muted">✗ {w}</li>)}</ul></div>
            </div>
            {explanation.improvement_suggestions.length > 0 && (
              <div><span className="text-xs text-accent-cyan font-medium">Suggestions</span><ul className="mt-1 space-y-1">{explanation.improvement_suggestions.map((s, i) => <li key={i} className="text-xs text-muted">→ {s}</li>)}</ul></div>
            )}
            <p className="text-xs text-muted"><strong className="text-foreground">Strategy:</strong> {explanation.positioning_strategy}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted">Enter your OpenAI API key to generate an AI explanation. Your key is not stored.</p>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="w-full" />
            {aiError && <p className="text-xs text-danger">{aiError}</p>}
            <div className="flex justify-end gap-3">
              <GradientButton variant="secondary" onClick={() => setAiModal(false)}>Cancel</GradientButton>
              <GradientButton onClick={runExplain} disabled={aiLoading || !apiKey.trim()}>{aiLoading ? "Generating…" : "Generate"}</GradientButton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
