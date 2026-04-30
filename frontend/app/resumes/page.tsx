"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { SkillTag } from "@/components/ui/SkillTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Plus, FileText, Trash2, FolderOpen, Upload } from "lucide-react";
import { listResumes, createResume, uploadResumePdf, deleteResume } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import type { Resume } from "@/types/api";

type AddMode = "paste" | "upload";

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("paste");
  const [form, setForm] = useState({ name: "", raw_text: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    listResumes().then((r) => setResumes(r.resumes)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resetAddForm = () => {
    setForm({ name: "", raw_text: "" });
    setPdfFile(null);
    setError("");
    setAddMode("paste");
  };

  const closeModal = () => {
    setModalOpen(false);
    resetAddForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Resume name is required."); return; }
    if (addMode === "paste" && !form.raw_text.trim()) { setError("Resume text is required."); return; }
    if (addMode === "upload" && !pdfFile) { setError("PDF file is required."); return; }
    if (addMode === "upload" && pdfFile && pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
      setError("File must be a PDF.");
      return;
    }

    setSaving(true); setError("");
    try {
      if (addMode === "upload" && pdfFile) {
        await uploadResumePdf(form.name, pdfFile);
      } else {
        await createResume(form.name, form.raw_text);
      }
      setModalOpen(false);
      resetAddForm();
      load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteResume(id); load(); } catch { /* ignore */ }
  };

  return (
    <>
      <Topbar
        title="Resumes"
        subtitle="Your saved resumes and parsed profiles"
        action={<GradientButton size="sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Add resume</GradientButton>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-muted">Loading...</div>
      ) : resumes.length === 0 ? (
        <EmptyState title="No resumes yet" description="Add your first resume to start matching." />
      ) : (
        <div className="hyrra-grid-3">
          {resumes.map((r) => {
            const profile = r.parsed_profile;
            const wordCount = r.raw_text.split(/\s+/).length;
            return (
              <Card key={r.id} hover>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 text-accent-cyan flex items-center justify-center"><FileText size={18} /></div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{r.name}</div>
                      <div className="text-xs text-muted">{wordCount} words - {timeAgo(r.updated_at)}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="text-muted-dark hover:text-danger transition-colors cursor-pointer"><Trash2 size={14} /></button>
                </div>

                {profile?.skills && profile.skills.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Skills detected</span>
                    <div className="flex flex-wrap gap-1 mt-1">{profile.skills.slice(0, 10).map((s) => <SkillTag key={s} skill={s} />)}</div>
                    {profile.skills.length > 10 && <span className="text-[10px] text-muted-dark mt-1 block">+{profile.skills.length - 10} more</span>}
                  </div>
                )}
                {profile?.projects && profile.projects.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] text-muted uppercase tracking-wider flex items-center gap-1"><FolderOpen size={10} /> {profile.projects.length} projects detected</span>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                  <Link href="/matches">
                    <GradientButton size="sm">Run Match</GradientButton>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title="Add Resume" wide>
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-border bg-panel p-1">
            <button
              type="button"
              onClick={() => { setAddMode("paste"); setError(""); }}
              className={`px-4 py-2 text-xs font-semibold rounded-full transition-colors ${addMode === "paste" ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              <FileText size={14} className="inline mr-2" />
              Paste Text
            </button>
            <button
              type="button"
              onClick={() => { setAddMode("upload"); setError(""); }}
              className={`px-4 py-2 text-xs font-semibold rounded-full transition-colors ${addMode === "upload" ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              <Upload size={14} className="inline mr-2" />
              Upload PDF
            </button>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Resume name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Software Engineering Resume" className="w-full" />
          </div>
          {addMode === "paste" ? (
            <div>
              <label className="text-xs text-muted mb-1 block">Resume text *</label>
              <textarea
                rows={12}
                value={form.raw_text}
                onChange={(e) => setForm({ ...form, raw_text: e.target.value })}
                placeholder="Paste your full resume text here..."
                className="w-full resize-none"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted mb-1 block">PDF file *</label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="w-full"
              />
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <GradientButton variant="secondary" onClick={closeModal}>Cancel</GradientButton>
            <GradientButton onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Resume"}</GradientButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
