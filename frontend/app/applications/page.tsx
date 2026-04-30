"use client";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { MatchScoreBadge } from "@/components/ui/MatchScoreBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Plus, FileText, Calendar } from "lucide-react";
import { listApplications, updateApplication, listJobs, listResumes, createApplication } from "@/lib/api";
import { truncate } from "@/lib/utils";
import type { Application, Job, Resume } from "@/types/api";

const COLUMNS = [
  { key: "saved", label: "Saved", dot: "bg-muted-dark" },
  { key: "applied", label: "Applied", dot: "bg-accent-violet" },
  { key: "interviewing", label: "Interviewing", dot: "bg-accent-cyan" },
  { key: "offer", label: "Offer", dot: "bg-success" },
  { key: "rejected", label: "Rejected", dot: "bg-danger" },
];

const NEXT_STATUS: Record<string, string> = {
  saved: "applied",
  applied: "interviewing",
  interviewing: "offer",
};

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [form, setForm] = useState({ job_id: 0, resume_id: 0, notes: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listApplications().then((r) => setApps(r.applications)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openModal = () => {
    Promise.all([listJobs(), listResumes()]).then(([j, r]) => {
      setJobs(j.jobs);
      setResumes(r.resumes);
      if (j.jobs.length > 0) setForm((f) => ({ ...f, job_id: j.jobs[0].id }));
      if (r.resumes.length > 0) setForm((f) => ({ ...f, resume_id: r.resumes[0].id }));
    });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.job_id) return;
    setSaving(true);
    try {
      await createApplication({ job_id: form.job_id, resume_id: form.resume_id || undefined, status: "saved", notes: form.notes });
      setModalOpen(false);
      load();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const advanceStatus = async (app: Application) => {
    const next = NEXT_STATUS[app.status];
    if (!next) return;
    try {
      await updateApplication(app.id, { status: next });
      load();
    } catch { /* ignore */ }
  };

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: apps.filter((a) => a.status === col.key),
  }));

  return (
    <>
      <Topbar
        title="Applications"
        subtitle="Pipeline of every role you're tracking"
        action={<GradientButton size="sm" onClick={openModal}><Plus size={14} /> New application</GradientButton>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-muted">Loading…</div>
      ) : (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[1000px]" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '16px' }}>
          {grouped.map((col) => (
            <div key={col.key} className="space-y-3 bg-[#111217]/50 border border-white/5 rounded-2xl p-4 min-h-[600px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs text-muted-dark font-mono">{col.items.length}</span>
                </div>
                <button onClick={openModal} className="text-muted-dark hover:text-foreground transition-colors cursor-pointer"><Plus size={14} /></button>
              </div>

              {col.items.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-6 text-center text-xs text-muted-dark">No items</div>
              ) : (
                col.items.map((app) => (
                  <Card key={app.id} hover className="cursor-pointer" onClick={() => advanceStatus(app)}>
                    <div className="text-sm font-semibold text-foreground">{app.job_title || "Job"}</div>
                    <div className="text-xs text-muted mb-2">{app.job_company}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-dark mb-1">
                      {app.resume_name && <span className="flex items-center gap-1"><FileText size={10} /> {app.resume_name}</span>}
                      {app.date_applied && <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(app.date_applied).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    </div>
                    {app.notes && <p className="text-[11px] text-accent-violet/70 mt-1">{truncate(app.notes, 60)}</p>}
                    {NEXT_STATUS[app.status] && <p className="text-[9px] text-muted-dark mt-2 opacity-50">Click to advance →</p>}
                  </Card>
                ))
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Application">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Job</label>
            <select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: Number(e.target.value) })} className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground">
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title || "Untitled"} – {j.company}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Resume</label>
            <select value={form.resume_id} onChange={(e) => setForm({ ...form, resume_id: Number(e.target.value) })} className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm text-foreground">
              <option value={0}>None</option>
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full resize-none" placeholder="Any notes…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={() => setModalOpen(false)}>Cancel</GradientButton>
            <GradientButton onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create"}</GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
