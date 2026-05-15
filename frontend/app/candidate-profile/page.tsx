"use client";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { GradientButton } from "@/components/ui/GradientButton";
import { getCandidateProfile, createCandidateProfile, updateCandidateProfile } from "@/lib/api";
import type { CandidateProfilePayload } from "@/types/api";

type Mode = "loading" | "create" | "edit";

interface FormState {
  label: string;
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  location_city: string;
  location_region: string;
  country: string;
  school: string;
  program: string;
  degree: string;
  graduation_month: string;
  graduation_year: string;
  gpa_optional: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  personal_website_url: string;
  other_links_json: string;
  work_authorization_country: string;
  authorized_to_work: string;
  requires_sponsorship: boolean;
  available_start_date: string;
  available_end_date: string;
  preferred_work_location: string;
  open_to_remote: boolean;
  default_why_interested: string;
  default_relevant_project: string;
  default_additional_info: string;
  default_cover_note: string;
  top_skills_json: string;
  top_projects_json: string;
}

const EMPTY: FormState = {
  label: "",
  first_name: "", last_name: "", preferred_name: "",
  email: "", phone: "",
  location_city: "", location_region: "", country: "",
  school: "", program: "", degree: "",
  graduation_month: "", graduation_year: "", gpa_optional: "",
  linkedin_url: "", github_url: "", portfolio_url: "",
  personal_website_url: "", other_links_json: "",
  work_authorization_country: "", authorized_to_work: "",
  requires_sponsorship: false,
  available_start_date: "", available_end_date: "",
  preferred_work_location: "", open_to_remote: false,
  default_why_interested: "", default_relevant_project: "",
  default_additional_info: "", default_cover_note: "",
  top_skills_json: "", top_projects_json: "",
};

function profileToForm(p: Awaited<ReturnType<typeof getCandidateProfile>>): FormState {
  if (!p) return EMPTY;
  return {
    label: p.label ?? "",
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    preferred_name: p.preferred_name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    location_city: p.location_city ?? "",
    location_region: p.location_region ?? "",
    country: p.country ?? "",
    school: p.school ?? "",
    program: p.program ?? "",
    degree: p.degree ?? "",
    graduation_month: p.graduation_month != null ? String(p.graduation_month) : "",
    graduation_year: p.graduation_year != null ? String(p.graduation_year) : "",
    gpa_optional: p.gpa_optional ?? "",
    linkedin_url: p.linkedin_url ?? "",
    github_url: p.github_url ?? "",
    portfolio_url: p.portfolio_url ?? "",
    personal_website_url: p.personal_website_url ?? "",
    other_links_json: p.other_links_json ?? "",
    work_authorization_country: p.work_authorization_country ?? "",
    authorized_to_work: p.authorized_to_work ?? "",
    requires_sponsorship: p.requires_sponsorship ?? false,
    available_start_date: p.available_start_date ?? "",
    available_end_date: p.available_end_date ?? "",
    preferred_work_location: p.preferred_work_location ?? "",
    open_to_remote: p.open_to_remote ?? false,
    default_why_interested: p.default_why_interested ?? "",
    default_relevant_project: p.default_relevant_project ?? "",
    default_additional_info: p.default_additional_info ?? "",
    default_cover_note: p.default_cover_note ?? "",
    top_skills_json: p.top_skills_json ?? "",
    top_projects_json: p.top_projects_json ?? "",
  };
}

function buildPayload(f: FormState): CandidateProfilePayload {
  const str = (v: string) => v.trim() === "" ? null : v.trim();
  const num = (v: string) => v.trim() === "" ? null : parseInt(v.trim(), 10) || null;
  return {
    label: f.label.trim() || "My Profile",
    first_name: str(f.first_name),
    last_name: str(f.last_name),
    preferred_name: str(f.preferred_name),
    email: str(f.email),
    phone: str(f.phone),
    location_city: str(f.location_city),
    location_region: str(f.location_region),
    country: str(f.country),
    school: str(f.school),
    program: str(f.program),
    degree: str(f.degree),
    graduation_month: num(f.graduation_month),
    graduation_year: num(f.graduation_year),
    gpa_optional: str(f.gpa_optional),
    linkedin_url: str(f.linkedin_url),
    github_url: str(f.github_url),
    portfolio_url: str(f.portfolio_url),
    personal_website_url: str(f.personal_website_url),
    other_links_json: str(f.other_links_json),
    work_authorization_country: str(f.work_authorization_country),
    authorized_to_work: str(f.authorized_to_work),
    requires_sponsorship: f.requires_sponsorship,
    available_start_date: str(f.available_start_date),
    available_end_date: str(f.available_end_date),
    preferred_work_location: str(f.preferred_work_location),
    open_to_remote: f.open_to_remote,
    default_why_interested: str(f.default_why_interested),
    default_relevant_project: str(f.default_relevant_project),
    default_additional_info: str(f.default_additional_info),
    default_cover_note: str(f.default_cover_note),
    top_skills_json: str(f.top_skills_json),
    top_projects_json: str(f.top_projects_json),
  };
}

const inputClass =
  "w-full bg-panel border border-border rounded-xl px-3 py-[10px] text-sm text-foreground placeholder:text-muted outline-none focus:border-accent-violet/50 transition-colors";
const selectClass =
  "w-full bg-panel border border-border rounded-xl px-3 py-[10px] text-sm text-foreground outline-none focus:border-accent-violet/50 transition-colors";
const textareaClass =
  "w-full bg-panel border border-border rounded-xl px-3 py-[10px] text-sm text-foreground placeholder:text-muted outline-none focus:border-accent-violet/50 transition-colors resize-y min-h-[96px]";
const labelClass = "text-xs text-muted mb-1 block";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export default function CandidateProfilePage() {
  const [mode, setMode] = useState<Mode>("loading");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getCandidateProfile()
      .then((p) => {
        if (p) {
          setForm(profileToForm(p));
          setMode("edit");
        } else {
          setMode("create");
        }
      })
      .catch(() => setMode("create"));
  }, []);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const setBool = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = buildPayload(form);
      if (mode === "create") {
        await createCandidateProfile(payload);
        setMode("edit");
      } else {
        await updateCandidateProfile(payload);
      }
      setSaveMsg({ ok: true, text: "Profile saved." });
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  if (mode === "loading") {
    return (
      <>
        <Topbar title="Candidate Profile" subtitle="Your reusable application identity" />
        <div className="hyrra-page-stack">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Candidate Profile"
        subtitle={mode === "create" ? "Set up your profile once, fill forms faster" : "Update your profile details"}
      />

      <div className="max-w-3xl hyrra-page-stack">

        {/* Identity */}
        <Card>
          <h3 className="text-sm font-semibold mb-4">Identity</h3>
          <div className="hyrra-section-stack">
            <Field label="Profile label *">
              <input className={inputClass} value={form.label} onChange={set("label")} placeholder="My Profile" />
            </Field>
            <div className="hyrra-form-grid">
              <Field label="First name">
                <input className={inputClass} value={form.first_name} onChange={set("first_name")} placeholder="Jane" />
              </Field>
              <Field label="Last name">
                <input className={inputClass} value={form.last_name} onChange={set("last_name")} placeholder="Smith" />
              </Field>
            </div>
            <Field label="Preferred name">
              <input className={inputClass} value={form.preferred_name} onChange={set("preferred_name")} placeholder="Optional" />
            </Field>
            <div className="hyrra-form-grid">
              <Field label="Email">
                <input className={inputClass} type="email" value={form.email} onChange={set("email")} placeholder="jane@example.com" />
              </Field>
              <Field label="Phone">
                <input className={inputClass} type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
              </Field>
            </div>
            <div className="hyrra-form-grid">
              <Field label="City">
                <input className={inputClass} value={form.location_city} onChange={set("location_city")} placeholder="Toronto" />
              </Field>
              <Field label="Province / State">
                <input className={inputClass} value={form.location_region} onChange={set("location_region")} placeholder="ON" />
              </Field>
              <Field label="Country">
                <input className={inputClass} value={form.country} onChange={set("country")} placeholder="Canada" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Education */}
        <Card>
          <h3 className="text-sm font-semibold mb-4">Education</h3>
          <div className="hyrra-section-stack">
            <Field label="School">
              <input className={inputClass} value={form.school} onChange={set("school")} placeholder="University of Waterloo" />
            </Field>
            <div className="hyrra-form-grid">
              <Field label="Program">
                <input className={inputClass} value={form.program} onChange={set("program")} placeholder="Computer Science" />
              </Field>
              <Field label="Degree">
                <input className={inputClass} value={form.degree} onChange={set("degree")} placeholder="Bachelor of Science" />
              </Field>
            </div>
            <div className="hyrra-form-grid">
              <Field label="Graduation month (1–12)">
                <input className={inputClass} type="number" min={1} max={12} value={form.graduation_month} onChange={set("graduation_month")} placeholder="4" />
              </Field>
              <Field label="Graduation year">
                <input className={inputClass} type="number" min={1900} max={2100} value={form.graduation_year} onChange={set("graduation_year")} placeholder="2026" />
              </Field>
              <Field label="GPA (optional)">
                <input className={inputClass} value={form.gpa_optional} onChange={set("gpa_optional")} placeholder="3.8 / 4.0" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Links */}
        <Card>
          <h3 className="text-sm font-semibold mb-4">Links</h3>
          <div className="hyrra-section-stack">
            <Field label="LinkedIn URL">
              <input className={inputClass} value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/in/yourhandle" />
            </Field>
            <Field label="GitHub URL">
              <input className={inputClass} value={form.github_url} onChange={set("github_url")} placeholder="https://github.com/yourhandle" />
            </Field>
            <Field label="Portfolio URL">
              <input className={inputClass} value={form.portfolio_url} onChange={set("portfolio_url")} placeholder="https://yourportfolio.com" />
            </Field>
            <Field label="Personal website">
              <input className={inputClass} value={form.personal_website_url} onChange={set("personal_website_url")} placeholder="https://yourdomain.com" />
            </Field>
            <Field label="Other links (JSON array)">
              <textarea
                className={textareaClass}
                value={form.other_links_json}
                onChange={set("other_links_json")}
                placeholder={'[{"label": "Devpost", "url": "https://devpost.com/yourhandle"}]'}
                rows={3}
              />
            </Field>
          </div>
        </Card>

        {/* Work & Availability */}
        <Card>
          <h3 className="text-sm font-semibold mb-4">Work & Availability</h3>
          <div className="hyrra-section-stack">
            <div className="hyrra-form-grid">
              <Field label="Work authorization country">
                <input className={inputClass} value={form.work_authorization_country} onChange={set("work_authorization_country")} placeholder="Canada" />
              </Field>
              <Field label="Authorization status">
                <select className={selectClass} value={form.authorized_to_work} onChange={set("authorized_to_work")}>
                  <option value="">— Select —</option>
                  <option value="yes">Yes — authorized</option>
                  <option value="no">No — not authorized</option>
                  <option value="with_sponsorship">Yes — with sponsorship</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="requires_sponsorship"
                type="checkbox"
                checked={form.requires_sponsorship}
                onChange={setBool("requires_sponsorship")}
                className="w-4 h-4 rounded accent-accent-violet cursor-pointer"
              />
              <label htmlFor="requires_sponsorship" className="text-sm text-foreground cursor-pointer">
                Requires sponsorship
              </label>
            </div>
            <div className="hyrra-form-grid">
              <Field label="Available from">
                <input className={inputClass} type="date" value={form.available_start_date} onChange={set("available_start_date")} />
              </Field>
              <Field label="Available until">
                <input className={inputClass} type="date" value={form.available_end_date} onChange={set("available_end_date")} />
              </Field>
            </div>
            <Field label="Preferred work location">
              <input className={inputClass} value={form.preferred_work_location} onChange={set("preferred_work_location")} placeholder="Toronto, ON" />
            </Field>
            <div className="flex items-center gap-3">
              <input
                id="open_to_remote"
                type="checkbox"
                checked={form.open_to_remote}
                onChange={setBool("open_to_remote")}
                className="w-4 h-4 rounded accent-accent-violet cursor-pointer"
              />
              <label htmlFor="open_to_remote" className="text-sm text-foreground cursor-pointer">
                Open to remote
              </label>
            </div>
          </div>
        </Card>

        {/* Reusable Answers */}
        <Card>
          <h3 className="text-sm font-semibold mb-1">Reusable Answers</h3>
          <p className="text-xs text-muted mb-4">
            These are pre-filled into application forms by the Apply Agent and always flagged for your review before use.
          </p>
          <div className="hyrra-section-stack">
            <Field label="Why interested (default)">
              <textarea
                className={textareaClass}
                value={form.default_why_interested}
                onChange={set("default_why_interested")}
                placeholder="I'm excited about this role because…"
                rows={4}
              />
            </Field>
            <Field label="Relevant project (default)">
              <textarea
                className={textareaClass}
                value={form.default_relevant_project}
                onChange={set("default_relevant_project")}
                placeholder="My most relevant project is…"
                rows={4}
              />
            </Field>
            <Field label="Additional info (default)">
              <textarea
                className={textareaClass}
                value={form.default_additional_info}
                onChange={set("default_additional_info")}
                placeholder="Anything else you'd like employers to know…"
                rows={4}
              />
            </Field>
            <Field label="Cover note (default)">
              <textarea
                className={textareaClass}
                value={form.default_cover_note}
                onChange={set("default_cover_note")}
                placeholder="Short note to attach to applications…"
                rows={4}
              />
            </Field>
          </div>
        </Card>

        {/* Technical Highlights */}
        <Card>
          <h3 className="text-sm font-semibold mb-1">Technical Highlights</h3>
          <p className="text-xs text-muted mb-4">
            Used to improve AI suggestion quality. Store as JSON arrays.
          </p>
          <div className="hyrra-section-stack">
            <Field label='Top skills (JSON array, e.g. ["Python", "React"])'>
              <textarea
                className={textareaClass}
                value={form.top_skills_json}
                onChange={set("top_skills_json")}
                placeholder='["Python", "React", "FastAPI"]'
                rows={3}
              />
            </Field>
            <Field label='Top projects (JSON array, e.g. [{"name": "X", "description": "..."}])'>
              <textarea
                className={textareaClass}
                value={form.top_projects_json}
                onChange={set("top_projects_json")}
                placeholder='[{"name": "Hyrra AI", "description": "Job intelligence platform"}]'
                rows={4}
              />
            </Field>
          </div>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-4">
          <GradientButton onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create Profile" : "Save Changes"}
          </GradientButton>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.ok ? "text-accent-cyan" : "text-danger"}`}>
              {saveMsg.text}
            </span>
          )}
        </div>

      </div>
    </>
  );
}
