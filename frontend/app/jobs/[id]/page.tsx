"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { SkillTag } from "@/components/ui/SkillTag";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapPin, Building2, Clock, Sparkles, FileText, GitCompareArrows, ClipboardList, ArrowLeft, Trash2 } from "lucide-react";
import { getJob, listResumes, createMatch, explainMatch, generateCoverLetter, createApplication, deleteJob } from "@/lib/api";
import type { Job, Resume, MatchResult, AIExplanation } from "@/types/api";
import Link from "next/link";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Match state
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matching, setMatching] = useState(false);

  // AI states
  const [apiKeyModal, setApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [aiAction, setAiAction] = useState<"explain" | "cover" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [aiError, setAiError] = useState("");

  // Application
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    Promise.all([getJob(Number(id)), listResumes()])
      .then(([j, r]) => {
        setJob(j);
        setResumes(r.resumes);
        if (r.resumes.length > 0) setSelectedResumeId(r.resumes[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleMatch = async () => {
    if (!selectedResumeId) return;
    setMatching(true);
    try {
      const m = await createMatch(Number(id), selectedResumeId);
      setMatchResult(m);
    } catch { /* ignore */ }
    finally { setMatching(false); }
  };

  const openAiAction = (action: "explain" | "cover") => {
    setAiAction(action);
    setAiError("");
    setApiKeyModal(true);
  };

  const runAiAction = async () => {
    if (!apiKey.trim() || !selectedResumeId) return;
    setAiLoading(true); setAiError("");
    try {
      if (aiAction === "explain") {
        const r = await explainMatch(Number(id), selectedResumeId, apiKey);
        setExplanation(r.explanation);
      } else {
        const r = await generateCoverLetter(Number(id), selectedResumeId, apiKey);
        setCoverLetter(r.cover_letter);
      }
      setApiKeyModal(false);
    } catch (e: unknown) { setAiError(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiLoading(false); }
  };

  const handleTrack = async () => {
    if (!selectedResumeId) return;
    setTracking(true);
    try {
      await createApplication({ job_id: Number(id), resume_id: selectedResumeId, status: "saved" });
      setTracked(true);
    } catch { /* ignore */ }
    finally { setTracking(false); }
  };

  const handleDeleteJob = async () => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteJob(Number(id));
      router.push("/jobs");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to delete job.");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-32 text-muted">Loading…</div>;
  if (!job) return <EmptyState title="Job not found" />;

  const profile = job.parsed_profile;

  return (
    <>
      <Topbar title={job.title || "Job Details"} subtitle={`${job.company}${job.location ? ` · ${job.location}` : ""}`} />

      <Link href="/jobs" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft size={12} /> Back to Jobs
      </Link>

      <div className="grid grid-cols-3 gap-6">
        {/* Left — Job details */}
        <div className="col-span-2 space-y-5">
          {/* Meta */}
          <Card>
            <div className="flex items-center gap-4 mb-4">
              {job.company && <span className="flex items-center gap-1.5 text-xs text-muted"><Building2 size={13} /> {job.company}</span>}
              {job.location && <span className="flex items-center gap-1.5 text-xs text-muted"><MapPin size={13} /> {job.location}</span>}
              {job.employment_type && <span className="flex items-center gap-1.5 text-xs text-muted"><Clock size={13} /> {job.employment_type}</span>}
            </div>

            {profile?.required_skills && profile.required_skills.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs text-muted mb-2 font-medium">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">{profile.required_skills.map((s) => <SkillTag key={s} skill={s} variant="neutral" />)}</div>
              </div>
            )}
            {profile?.preferred_skills && profile.preferred_skills.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs text-muted mb-2 font-medium">Preferred Skills</h4>
                <div className="flex flex-wrap gap-1.5">{profile.preferred_skills.map((s) => <SkillTag key={s} skill={s} variant="neutral" />)}</div>
              </div>
            )}
          </Card>

          {profile?.responsibilities && profile.responsibilities.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold mb-3">Responsibilities</h4>
              <ul className="space-y-1.5 text-sm text-muted">{profile.responsibilities.map((r, i) => <li key={i} className="flex gap-2"><span className="text-accent-violet mt-1">•</span>{r}</li>)}</ul>
            </Card>
          )}
          {profile?.qualifications && profile.qualifications.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold mb-3">Qualifications</h4>
              <ul className="space-y-1.5 text-sm text-muted">{profile.qualifications.map((q, i) => <li key={i} className="flex gap-2"><span className="text-accent-cyan mt-1">•</span>{q}</li>)}</ul>
            </Card>
          )}

          {/* Match result */}
          {matchResult && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-sm font-semibold">Match Result</h4>
                <MatchScoreBadge score={matchResult.match_score} />
                <span className="text-xs text-muted">{matchResult.recommendation}</span>
              </div>
              {matchResult.matched_skills.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-muted block mb-1.5">Matched skills</span>
                  <div className="flex flex-wrap gap-1.5">{matchResult.matched_skills.map((s) => <SkillTag key={s} skill={s} variant="matched" />)}</div>
                </div>
              )}
              {matchResult.missing_required_skills.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-muted block mb-1.5">Missing skills</span>
                  <div className="flex flex-wrap gap-1.5">{matchResult.missing_required_skills.map((s) => <SkillTag key={s} skill={s} variant="missing" />)}</div>
                </div>
              )}
              <p className="text-xs text-muted mt-2">{matchResult.reasoning}</p>
            </Card>
          )}

          {/* AI Explanation */}
          {explanation && (
            <Card>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles size={14} className="text-accent-violet" /> AI Analysis</h4>
              <p className="text-sm text-muted mb-4">{explanation.summary}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-success font-medium">Strengths</span>
                  <ul className="mt-1 space-y-1">{explanation.strengths.map((s, i) => <li key={i} className="text-xs text-muted">✓ {s}</li>)}</ul>
                </div>
                <div>
                  <span className="text-xs text-danger font-medium">Weaknesses</span>
                  <ul className="mt-1 space-y-1">{explanation.weaknesses.map((w, i) => <li key={i} className="text-xs text-muted">✗ {w}</li>)}</ul>
                </div>
              </div>
              {explanation.improvement_suggestions.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs text-accent-cyan font-medium">Suggestions</span>
                  <ul className="mt-1 space-y-1">{explanation.improvement_suggestions.map((s, i) => <li key={i} className="text-xs text-muted">→ {s}</li>)}</ul>
                </div>
              )}
            </Card>
          )}

          {/* Cover letter */}
          {coverLetter && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2"><FileText size={14} className="text-accent-cyan" /> Generated Cover Letter</h4>
                <GradientButton variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(coverLetter)}>Copy</GradientButton>
              </div>
              <pre className="text-sm text-muted whitespace-pre-wrap font-sans leading-relaxed">{coverLetter}</pre>
            </Card>
          )}
        </div>

        {/* Right — Actions sidebar */}
        <div className="space-y-4">
          <Card>
            <h4 className="text-xs text-muted mb-3 font-medium">Resume</h4>
            {resumes.length === 0 ? (
              <p className="text-xs text-muted-dark">No resumes saved. <Link href="/resumes" className="text-accent-violet hover:underline">Add one</Link></p>
            ) : (
              <select
                value={selectedResumeId ?? ""}
                onChange={(e) => setSelectedResumeId(Number(e.target.value))}
                className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:border-accent-violet focus:outline-none"
              >
                {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </Card>

          <div className="space-y-2">
            <GradientButton className="w-full" onClick={handleMatch} disabled={matching || !selectedResumeId}>
              <GitCompareArrows size={14} /> {matching ? "Matching…" : "Run Match"}
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={() => openAiAction("explain")} disabled={!selectedResumeId}>
              <Sparkles size={14} /> Explain Match
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={() => openAiAction("cover")} disabled={!selectedResumeId}>
              <FileText size={14} /> Cover Letter
            </GradientButton>
            <GradientButton variant="secondary" className="w-full" onClick={handleTrack} disabled={tracking || tracked}>
              <ClipboardList size={14} /> {tracked ? "Tracked ✓" : tracking ? "Tracking…" : "Track Application"}
            </GradientButton>
            <GradientButton variant="ghost" className="w-full opacity-50 cursor-not-allowed" disabled>
              Improve Resume · Soon
            </GradientButton>
            <div className="pt-4 mt-4 border-t border-white/5">
              <GradientButton variant="ghost" className="w-full text-danger hover:text-danger hover:bg-danger/10" onClick={handleDeleteJob}>
                <Trash2 size={14} /> Delete Job
              </GradientButton>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      <Modal open={apiKeyModal} onClose={() => setApiKeyModal(false)} title={aiAction === "explain" ? "Enter OpenAI Key" : "Enter OpenAI Key"}>
        <div className="space-y-4">
          <p className="text-xs text-muted">Your key is used for this request only and is not stored.</p>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full"
          />
          {aiError && <p className="text-xs text-danger">{aiError}</p>}
          <div className="flex justify-end gap-3">
            <GradientButton variant="secondary" onClick={() => setApiKeyModal(false)}>Cancel</GradientButton>
            <GradientButton onClick={runAiAction} disabled={aiLoading || !apiKey.trim()}>
              {aiLoading ? "Generating…" : aiAction === "explain" ? "Explain" : "Generate"}
            </GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
