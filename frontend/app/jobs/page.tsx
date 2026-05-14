"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Plus, MapPin, Building2, Eye, Clock, Trash2, Pencil } from "lucide-react";
import { listJobs, saveJob, updateJob, listApplications, createApplication, updateApplication, deleteJob } from "@/lib/api";
import { timeAgo, initials } from "@/lib/utils";
import type { Job, Application } from "@/types/api";

type EditableJob = Job & { raw_text?: string };

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ job_text: "", source_type: "text", source_label: "" });
  const [error, setError] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    company: "",
    location: "",
    employment_type: "",
    source_label: "",
    raw_text: "",
  });
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

  const openEditModal = (e: React.MouseEvent, job: Job) => {
    e.preventDefault();
    e.stopPropagation();
    setEditJob(job);
    setEditError("");
    setEditForm({
      title: job.title ?? "",
      company: job.company ?? "",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "",
      source_label: job.source_label ?? "",
      raw_text: (job as EditableJob).raw_text ?? "",
    });
    setEditModalOpen(true);
  };

  const handleUpdateJob = async () => {
    if (!editJob) return;
    setEditSaving(true);
    setEditError("");
    try {
      await updateJob(editJob.id, editForm);
      setEditModalOpen(false);
      setEditJob(null);
      load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update job.");
    } finally {
      setEditSaving(false);
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
        action={<GradientButton onClick={() => setModalOpen(true)}><Plus size={16} /> Save job</GradientButton>}
      />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-3.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
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
        <Card><EmptyState title="No jobs found" description="Try changing your filters or adding a new job." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredJobs.map((job) => {
            const status = getAppStatus(job.id);
            return (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card hover className="flex flex-col lg:flex-row lg:items-center gap-5 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-violet/20 to-accent-cyan/20 text-accent-violet flex items-center justify-center text-lg font-bold shrink-0 border border-white/5">
                  {initials(job.company || "??")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">{job.title || "Untitled Position"}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted mt-1.5">
                    {job.company && <span className="flex items-center gap-1.5"><Building2 size={13} /> {job.company}</span>}
                    {job.location && <span className="flex items-center gap-1.5"><MapPin size={13} /> {job.location}</span>}
                    <span className="text-muted-dark flex items-center gap-1.5"><Clock size={13} /> {timeAgo(job.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:pl-4 lg:border-l border-white/5 pt-3 lg:pt-0 border-t lg:border-t-0 mt-3 lg:mt-0 shrink-0">
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
                  <div className="hyrra-icon-action">
                    <Eye size={16} />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => openEditModal(e, job)}
                    className="hyrra-icon-action cursor-pointer"
                    title="Edit Job"
                  >
                    <Pencil size={16} />
                  </button>
                  <div 
                    onClick={(e) => handleDeleteJob(e, job.id)}
                    className="hyrra-icon-action hover:text-danger hover:bg-danger/10 cursor-pointer"
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
          <div className="hyrra-form-grid">
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

      {/* Edit Job Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Job" wide>
        <div className="space-y-4">
          <div className="hyrra-form-grid">
            <div>
              <label className="text-xs text-muted mb-1 block">Title</label>
              <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Company</label>
              <input type="text" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Location</label>
              <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Employment type</label>
              <input type="text" value={editForm.employment_type} onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })} className="w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Source label</label>
            <input type="text" value={editForm.source_label} onChange={(e) => setEditForm({ ...editForm, source_label: e.target.value })} placeholder="e.g. LinkedIn, Internal Career Page" className="w-full" />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Raw job text</label>
            <textarea
              rows={10}
              value={editForm.raw_text}
              onChange={(e) => setEditForm({ ...editForm, raw_text: e.target.value })}
              className="w-full resize-none"
            />
          </div>
          {editError && <p className="text-xs text-danger">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</GradientButton>
            <GradientButton onClick={handleUpdateJob} disabled={editSaving}>{editSaving ? "Saving..." : "Save Changes"}</GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
