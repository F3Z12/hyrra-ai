"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Plus, MapPin, Building2, Eye, Clock, Trash2 } from "lucide-react";
import { listJobs, saveJob, listApplications, createApplication, updateApplication, deleteJob } from "@/lib/api";
import { timeAgo, initials } from "@/lib/utils";
import type { Job, Application } from "@/types/api";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ job_text: "", source_type: "text", source_label: "" });
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const load = () => {
    setLoading(true);
    Promise.all([listJobs(), listApplications()]).then(([j, a]) => {
      setJobs(j.jobs);
      setApps(a.applications);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async () => {
    if (!form.job_text.trim()) { setError("Job text cannot be empty."); return; }
    setSaving(true); setError("");
    try {
      await saveJob(form.job_text, form.source_type, form.source_label);
      setModalOpen(false);
      setForm({ job_text: "", source_type: "text", source_label: "" });
      load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to save job."); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (jobId: number, newStatus: string) => {
    const app = apps.find(a => a.job_id === jobId);
    try {
      if (app) {
        await updateApplication(app.id, { status: newStatus });
      } else if (newStatus !== "saved") {
        await createApplication({ job_id: jobId, status: newStatus });
      }
      load();
    } catch { /* ignore */ }
  };

  const handleDeleteJob = async (e: React.MouseEvent, jobId: number) => {
    e.preventDefault(); // Prevent navigating to job details
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteJob(jobId);
      load();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to delete job.");
    }
  };

  const filters = ["all", "saved", "applied", "interviewing", "offer", "rejected"];
  const STATUS_LABELS: Record<string, string> = {
    saved: "Saved", applied: "Applied", interviewing: "Interviewing", offer: "Offer", rejected: "Rejected"
  };

  const getAppStatus = (jobId: number) => {
    const app = apps.find(a => a.job_id === jobId);
    return app ? app.status : "saved";
  };

  const filteredJobs = filter === "all" ? jobs : jobs.filter(j => getAppStatus(j.id) === filter);

  return (
    <>
      <Topbar
        title="Jobs"
        subtitle="Saved roles and opportunities"
        action={<GradientButton size="sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Save job</GradientButton>}
      />

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
              filter === f
                ? "bg-accent-violet/15 text-accent-violet border-accent-violet/30"
                : "bg-transparent text-muted border-border hover:border-border-hover hover:text-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-muted">Loading…</div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState title="No jobs found" description="Try changing your filters or adding a new job." />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredJobs.map((job) => {
            const status = getAppStatus(job.id);
            return (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card hover className="flex flex-col sm:flex-row sm:items-center gap-5 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-violet/20 to-accent-cyan/20 text-accent-violet flex items-center justify-center text-lg font-bold shrink-0 border border-white/5">
                  {initials(job.company || "??")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">{job.title || "Untitled Position"}</div>
                  <div className="flex items-center gap-4 text-sm text-muted mt-1.5">
                    {job.company && <span className="flex items-center gap-1.5"><Building2 size={13} /> {job.company}</span>}
                    {job.location && <span className="flex items-center gap-1.5"><MapPin size={13} /> {job.location}</span>}
                    <span className="text-muted-dark flex items-center gap-1.5"><Clock size={13} /> {timeAgo(job.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:pl-4 sm:border-l border-white/5 pt-3 sm:pt-0 border-t sm:border-t-0 mt-3 sm:mt-0">
                  <select 
                    value={status} 
                    onChange={(e) => {
                      e.preventDefault();
                      handleStatusChange(job.id, e.target.value);
                    }}
                    onClick={(e) => e.preventDefault()}
                    className="bg-[#15161c] border border-white/10 rounded-md text-xs px-2 py-1 text-muted hover:text-foreground cursor-pointer focus:outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {job.source_label && (
                    <span className="text-xs text-muted-dark bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">{job.source_label}</span>
                  )}
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-foreground transition-colors">
                    <Eye size={16} />
                  </div>
                  <div 
                    onClick={(e) => handleDeleteJob(e, job.id)}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Delete Job"
                  >
                    <Trash2 size={16} />
                  </div>
                </div>
              </Card>
            </Link>
            );
          })}
        </div>
      )}

      {/* Save Job Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Save Job Posting" wide>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Job posting text *</label>
            <textarea
              rows={10}
              value={form.job_text}
              onChange={(e) => setForm({ ...form, job_text: e.target.value })}
              placeholder="Paste the full job description here…"
              className="w-full resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Source type</label>
              <input type="text" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Source label</label>
              <input type="text" value={form.source_label} onChange={(e) => setForm({ ...form, source_label: e.target.value })} placeholder="e.g. LinkedIn, Internal Career Page" className="w-full" />
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={() => setModalOpen(false)}>Cancel</GradientButton>
            <GradientButton onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Job"}</GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
