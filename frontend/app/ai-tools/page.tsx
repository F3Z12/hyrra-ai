"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { Modal } from "@/components/ui/Modal";
import { Sparkles, FileText, PenLine, ArrowRight, Copy, Lock } from "lucide-react";
import { listJobs, listResumes, explainMatch, generateCoverLetter } from "@/lib/api";
import type { Job, Resume, AIExplanation } from "@/types/api";

export default function AIToolsPage() {
  const [actionModal, setActionModal] = useState<"explain" | "cover" | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selJob, setSelJob] = useState(0);
  const [selResume, setSelResume] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [lastGenJob, setLastGenJob] = useState("");

  const openAction = (action: "explain" | "cover") => {
    setError("");
    Promise.all([listJobs(), listResumes()]).then(([j, r]) => {
      setJobs(j.jobs); setResumes(r.resumes);
      if (j.jobs.length) setSelJob(j.jobs[0].id);
      if (r.resumes.length) setSelResume(r.resumes[0].id);
    });
    setActionModal(action);
  };

  const runAction = async () => {
    if (!selJob || !selResume || !apiKey.trim()) return;
    setLoading(true); setError("");
    try {
      const job = jobs.find((j) => j.id === selJob);
      if (actionModal === "explain") {
        const r = await explainMatch(selJob, selResume, apiKey);
        setExplanation(r.explanation);
      } else {
        const r = await generateCoverLetter(selJob, selResume, apiKey);
        setCoverLetter(r.cover_letter);
        setLastGenJob(`${job?.title || "Job"} · ${job?.company || ""}`);
      }
      setActionModal(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed."); }
    finally { setLoading(false); }
  };

  const tools = [
    {
      icon: <Sparkles size={20} className="text-accent-violet" />,
      title: "Explain Match",
      desc: "Get a precise breakdown of why a job and resume match — strengths, gaps, and concrete next steps.",
      action: () => openAction("explain"),
      label: "Run analysis",
      gradient: "from-accent-violet/20 to-transparent",
    },
    {
      icon: <FileText size={20} className="text-accent-cyan" />,
      title: "Generate Cover Letter",
      desc: "Craft a tailored, ATS-friendly cover letter grounded in your resume and the role's actual requirements.",
      action: () => openAction("cover"),
      label: "Generate",
      gradient: "from-accent-cyan/20 to-transparent",
    },
    {
      icon: <PenLine size={20} className="text-muted-dark" />,
      title: "Improve Resume for This Job",
      desc: "Suggest ATS-friendly improvements based only on your real experience — no fabricated content, ever.",
      action: undefined,
      label: "Coming soon",
      gradient: "from-white/5 to-transparent",
      disabled: true,
    },
  ];

  return (
    <>
      <Topbar title="AI Tools" subtitle="Augment your job hunt with focused, opinionated AI" />

      <div className="hyrra-grid-3 mb-8">
        {tools.map((tool) => (
          <Card key={tool.title} className={`relative overflow-hidden bg-gradient-to-b ${tool.gradient}`}>
            {tool.disabled && (
              <span className="absolute top-4 right-4 bg-warning/10 text-warning text-[10px] font-medium px-2 py-0.5 rounded-full border border-warning/20 flex items-center gap-1"><Lock size={9} /> SOON</span>
            )}
            <div className="mb-4 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">{tool.icon}</div>
            <h3 className="text-base font-semibold mb-2">{tool.title}</h3>
            <p className="text-xs text-muted leading-relaxed mb-5">{tool.desc}</p>
            {tool.disabled ? (
              <span className="text-xs text-muted-dark font-medium">Coming soon</span>
            ) : (
              <GradientButton variant="secondary" size="sm" onClick={tool.action}>
                {tool.label} <ArrowRight size={12} />
              </GradientButton>
            )}
          </Card>
        ))}
      </div>

      {/* AI Explanation result */}
      {explanation && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles size={14} className="text-accent-violet" /> AI Analysis Result</h3>
          <p className="text-sm text-muted mb-4">{explanation.summary}</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><span className="text-xs text-success font-medium">Strengths</span><ul className="mt-1 space-y-1">{explanation.strengths.map((s, i) => <li key={i} className="text-xs text-muted">✓ {s}</li>)}</ul></div>
            <div><span className="text-xs text-danger font-medium">Weaknesses</span><ul className="mt-1 space-y-1">{explanation.weaknesses.map((w, i) => <li key={i} className="text-xs text-muted">✗ {w}</li>)}</ul></div>
          </div>
          <p className="text-xs text-muted"><strong className="text-foreground">Strategy:</strong> {explanation.positioning_strategy}</p>
        </Card>
      )}

      {/* Cover letter result */}
      {coverLetter && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Latest cover letter</h3>
              {lastGenJob && <p className="text-xs text-muted">Generated for {lastGenJob}</p>}
            </div>
            <div className="flex gap-2">
              <GradientButton variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(coverLetter)}><Copy size={12} /> Copy</GradientButton>
              <GradientButton variant="secondary" size="sm" onClick={() => {
                const blob = new Blob([coverLetter], { type: "text/plain" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cover_letter.txt"; a.click();
              }}>Download .txt</GradientButton>
            </div>
          </div>
          <pre className="text-sm text-muted whitespace-pre-wrap font-sans leading-relaxed bg-background/50 rounded-xl p-5 border border-border">{coverLetter}</pre>
        </Card>
      )}

      {/* Action modal */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal === "explain" ? "Run AI Analysis" : "Generate Cover Letter"}>
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
          <div>
            <label className="text-xs text-muted mb-1 block">OpenAI API Key</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="w-full" />
            <p className="text-[10px] text-muted-dark mt-1">Your key is used for this request only and is not stored.</p>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <GradientButton variant="secondary" onClick={() => setActionModal(null)}>Cancel</GradientButton>
            <GradientButton onClick={runAction} disabled={loading}>{loading ? "Generating…" : actionModal === "explain" ? "Run Analysis" : "Generate"}</GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
