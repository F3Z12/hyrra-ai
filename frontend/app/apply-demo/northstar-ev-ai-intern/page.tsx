"use client";

import { useState, useEffect } from "react";
import { listJobs, saveJob } from "@/lib/api";
import type { Job } from "@/types/api";
import "./apply-demo.css";

// ── Constants ────────────────────────────────────────────────────────────────

const DEMO_SOURCE_LABEL = "northstar-ev-ai-intern-demo";

// Full job posting text sent to the Hyrra backend when the user creates the demo job.
// The backend parses and stores it; the returned job.id is used for the Apply Agent session.
const NORTHSTAR_JOB_TEXT = `Northstar EV Systems — AI Automation Intern — Summer 2025
Location: Waterloo, ON (Hybrid)
Duration: 4 months
Team: Engineering Platforms

About Northstar EV Systems:
Northstar builds EV charging infrastructure and the software layer that keeps it running, from field diagnostics to admin dashboards to AI-assisted support ticketing. Our platform team ships automation tooling used by charge point operators across North America.

Role Overview:
As an AI Automation Intern, you will build and integrate AI agent workflows into our operations stack. You will work on support ticket classification, field report summarization, automated escalation routing, and internal tooling for the fleet management team.

Responsibilities:
- Build AI agent workflows using Python and LLM APIs
- Integrate automation pipelines into existing admin and ticketing systems
- Write tests and observability tooling for agentic workflows
- Collaborate with fleet operations and product teams
- Improve internal tooling for reporting and workflow automation

Required Skills:
- Python
- REST API integration
- Familiarity with LLM APIs such as OpenAI, Anthropic, or similar
- Git and basic software development workflow
- Clear technical communication

Preferred Skills:
- FastAPI or similar Python web frameworks
- Experience with browser automation, AI agents, or workflow tools
- Prior internship, co-op, or project experience

Qualifications:
- Enrolled in Computer Science, Software Engineering, or related program
- Expected graduation 2025 to 2027
- Authorized to work in Canada or eligible for a work permit`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NorthstarApplyPage() {
  const [jobId, setJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // On mount: look for an existing saved demo job so the user doesn't have to
  // recreate it every visit. Match by source_label (never by localStorage).
  useEffect(() => {
    listJobs()
      .then(({ jobs }) => {
        const existing = jobs.find((j: Job) => j.source_label === DEMO_SOURCE_LABEL);
        if (existing) setJobId(existing.id);
      })
      .catch(() => {/* silent — just fall through to the create button */})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateJob() {
    setCreating(true);
    setCreateError(null);
    try {
      const job = await saveJob(NORTHSTAR_JOB_TEXT, "text", DEMO_SOURCE_LABEL);
      setJobId(job.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create demo job.");
    } finally {
      setCreating(false);
    }
  }

  // data-hyrra-job-id is only set after a job ID is available.
  // OpenClaw reads this attribute from the DOM — never from localStorage.
  const rootAttrs: Record<string, string> = {
    "data-hyrra-apply-demo": "true",
    ...(jobId !== null ? { "data-hyrra-job-id": String(jobId) } : {}),
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f3f4f6", color: "#111827" }} {...rootAttrs}>

      {/* ── Header ── */}
      <header style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between" style={{ height: 64 }}>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight" style={{ color: "#111827" }}>
              NSTAR ⚡
            </span>
            <span className="text-sm" style={{ color: "#6b7280" }}>Careers</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: "#fef3c7",
                color: "#92400e",
                border: "1px solid #fde68a",
              }}
            >
              Demo Application Portal
            </span>
          </div>
        </div>
      </header>

      {/* ── Job ID status banner ── */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        {loading ? (
          <p className="text-sm" style={{ color: "#6b7280" }}>Checking demo state…</p>
        ) : jobId === null ? (
          <div
            className="flex items-start justify-between gap-4 rounded-xl px-5 py-4"
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fcd34d",
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "#92400e" }}>
                Create the demo job before starting Apply Agent.
              </p>
              <p className="text-xs mt-1" style={{ color: "#b45309" }}>
                This registers the Northstar EV job in Hyrra so an Apply Agent session can reference it.
              </p>
              {createError && (
                <p className="text-xs mt-1.5 font-medium" style={{ color: "#dc2626" }}>
                  {createError}
                </p>
              )}
            </div>
            <button
              onClick={handleCreateJob}
              disabled={creating}
              className="shrink-0 text-sm font-semibold rounded-lg px-4 py-2 transition-opacity"
              style={{
                backgroundColor: "#d97706",
                color: "#ffffff",
                opacity: creating ? 0.6 : 1,
                cursor: creating ? "not-allowed" : "pointer",
                border: "none",
              }}
            >
              {creating ? "Creating…" : "Create Demo Job"}
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 w-fit text-xs font-medium"
            style={{
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: "#10b981" }}
            />
            Demo job ready · job_id={jobId}
          </div>
        )}
      </div>

      {/* ── Main two-column body ── */}
      <main className="max-w-6xl mx-auto px-6 pt-8 pb-16">
        <div className="grid grid-cols-1 gap-10 items-start" style={{ gridTemplateColumns: "2fr 3fr" }}>

          {/* ── Left: Job details ── */}
          <div className="space-y-6">

            {/* Role header */}
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: "#111827" }}>
                AI Automation Intern
              </h1>
              <p className="text-base font-medium mt-1" style={{ color: "#374151" }}>
                Summer 2025 · 4-Month Co-op
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: "Northstar EV Systems", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
                  { label: "Waterloo, ON · Hybrid", bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
                  { label: "Engineering Platforms",  bg: "#faf5ff", color: "#6d28d9", border: "#ddd6fe" },
                ].map(({ label, bg, color, border }) => (
                  <span
                    key={label}
                    className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: bg, color, border: `1px solid ${border}` }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <JobSection title="About Northstar EV Systems">
              <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
                Northstar builds EV charging infrastructure and the software layer that keeps it
                running — from field diagnostics to admin dashboards to AI-assisted support
                ticketing. Our platform team ships automation tooling used by charge point operators
                across North America.
              </p>
            </JobSection>

            <JobSection title="Role Overview">
              <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
                As an AI Automation Intern, you will build and integrate AI agent workflows into
                our operations stack. You will work on support ticket classification, field report
                summarization, automated escalation routing, and internal tooling for the fleet
                management team.
              </p>
            </JobSection>

            <JobSection title="Responsibilities">
              <BulletList
                color="#60a5fa"
                items={[
                  "Build AI agent workflows using Python and LLM APIs",
                  "Integrate automation pipelines into existing admin and ticketing systems",
                  "Write tests and observability tooling for agentic workflows",
                  "Collaborate with fleet operations and product teams",
                  "Improve internal tooling for reporting and workflow automation",
                ]}
              />
            </JobSection>

            <JobSection title="Required Skills">
              <SkillTags
                items={["Python", "REST API integration", "LLM APIs (OpenAI / Anthropic)", "Git", "Technical communication"]}
                bg="#fef2f2" color="#b91c1c" border="#fecaca"
              />
            </JobSection>

            <JobSection title="Preferred Skills">
              <SkillTags
                items={["FastAPI", "Browser automation", "AI agents / workflow tools", "Prior internship or co-op"]}
                bg="#f9fafb" color="#374151" border="#e5e7eb"
              />
            </JobSection>

            <JobSection title="Qualifications">
              <BulletList
                color="#9ca3af"
                items={[
                  "Enrolled in Computer Science, Software Engineering, or related program",
                  "Expected graduation 2025–2027",
                  "Authorized to work in Canada or eligible for a work permit",
                ]}
              />
            </JobSection>

          </div>

          {/* ── Right: Application form ── */}
          <div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
            >
              {/* Form header */}
              <div
                className="px-6 py-4"
                style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}
              >
                <h2 className="text-base font-semibold" style={{ color: "#111827" }}>
                  Apply for this position
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                  Fields marked <span style={{ color: "#dc2626" }}>*</span> are required
                </p>
              </div>

              {/* Form body */}
              <form
                className="nstar-form px-6 py-6 space-y-5"
                onSubmit={(e) => e.preventDefault()}
              >

                {/* Full Name */}
                <FormField fieldKey="full_name" label="Full Name" required>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    data-apply-field="full_name"
                    placeholder="Jane Smith"
                    autoComplete="name"
                  />
                </FormField>

                {/* Email */}
                <FormField fieldKey="email" label="Email Address" required>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    data-apply-field="email"
                    placeholder="jane@example.com"
                    autoComplete="email"
                  />
                </FormField>

                {/* Phone */}
                <FormField fieldKey="phone" label="Phone Number">
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    data-apply-field="phone"
                    placeholder="+1 (555) 000-0000"
                    autoComplete="tel"
                  />
                </FormField>

                {/* School + Program (two-up) */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField fieldKey="school" label="School / University" required>
                    <input
                      type="text"
                      id="school"
                      name="school"
                      data-apply-field="school"
                      placeholder="University of Waterloo"
                    />
                  </FormField>
                  <FormField fieldKey="program" label="Program" required>
                    <input
                      type="text"
                      id="program"
                      name="program"
                      data-apply-field="program"
                      placeholder="Computer Science"
                    />
                  </FormField>
                </div>

                {/* Graduation Year */}
                <FormField fieldKey="graduation_year" label="Graduation Year">
                  <input
                    type="text"
                    id="graduation_year"
                    name="graduation_year"
                    data-apply-field="graduation_year"
                    placeholder="2026"
                    maxLength={4}
                    inputMode="numeric"
                  />
                </FormField>

                {/* LinkedIn */}
                <FormField fieldKey="linkedin_url" label="LinkedIn URL">
                  <input
                    type="url"
                    id="linkedin_url"
                    name="linkedin_url"
                    data-apply-field="linkedin_url"
                    placeholder="https://linkedin.com/in/yourprofile"
                    autoComplete="url"
                  />
                </FormField>

                {/* GitHub */}
                <FormField fieldKey="github_url" label="GitHub URL">
                  <input
                    type="url"
                    id="github_url"
                    name="github_url"
                    data-apply-field="github_url"
                    placeholder="https://github.com/yourusername"
                  />
                </FormField>

                {/* Work Authorization — select: blocked by fill-plan, OpenClaw must NOT touch */}
                <FormField fieldKey="work_auth" label="Work Authorization" required>
                  <select
                    id="work_auth"
                    name="work_auth"
                    data-apply-field="work_auth"
                  >
                    <option value="">Select…</option>
                    <option value="yes">Yes, authorized to work in Canada</option>
                    <option value="no">Not currently authorized</option>
                    <option value="with_sponsorship">Yes, with work permit / sponsorship</option>
                  </select>
                </FormField>

                {/* Why interested */}
                <FormField fieldKey="why_interested" label="Why are you interested in this role?">
                  <textarea
                    id="why_interested"
                    name="why_interested"
                    data-apply-field="why_interested"
                    placeholder="Tell us what excites you about this opportunity…"
                    rows={4}
                  />
                </FormField>

                {/* Relevant project */}
                <FormField fieldKey="relevant_project" label="Describe a relevant project or experience">
                  <textarea
                    id="relevant_project"
                    name="relevant_project"
                    data-apply-field="relevant_project"
                    placeholder="Describe a project or experience relevant to this role…"
                    rows={4}
                  />
                </FormField>

                {/* Additional info */}
                <FormField fieldKey="additional_info" label="Additional information">
                  <textarea
                    id="additional_info"
                    name="additional_info"
                    data-apply-field="additional_info"
                    placeholder="Anything else you'd like us to know…"
                    rows={3}
                  />
                </FormField>

                {/* Blocked submit */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    disabled
                    data-blocked-submit="true"
                    className="w-full py-3 rounded-xl text-sm font-semibold"
                    style={{
                      backgroundColor: "#e5e7eb",
                      color: "#9ca3af",
                      border: "1px solid #d1d5db",
                      cursor: "not-allowed",
                    }}
                  >
                    Submit Application — Complete Review First
                  </button>
                  <p className="text-center text-xs" style={{ color: "#9ca3af" }}>
                    This demo form cannot be submitted. Review happens inside Hyrra.
                  </p>
                </div>

              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function JobSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: "#111827" }}>{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "#4b5563" }}>
          <span
            className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 inline-block"
            style={{ backgroundColor: color }}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function SkillTags({
  items, bg, color, border,
}: {
  items: string[]; bg: string; color: string; border: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span
          key={s}
          className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: bg, color, border: `1px solid ${border}` }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function FormField({
  fieldKey,
  label,
  required,
  children,
}: {
  fieldKey: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-field-key={fieldKey}>
      <label
        htmlFor={fieldKey}
        className="block text-sm font-medium mb-1.5"
        style={{ color: "#374151" }}
      >
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: "#dc2626" }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}
