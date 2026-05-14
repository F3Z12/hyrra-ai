import type {
  Job,
  Resume,
  Application,
  MatchResult,
  AIExplanation,
  MatchTextResult,
  OutreachContact,
  CreateOutreachContactPayload,
  UpdateOutreachContactPayload,
  OutreachMessage,
  CreateOutreachMessagePayload,
  UpdateOutreachMessagePayload,
  GenerateOutreachMessagePayload,
  GeneratedOutreachMessageResponse,
} from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_BACKEND_BASE ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Jobs ──────────────────────────────────────────────────────────────
export const listJobs = () => request<{ jobs: Job[] }>("/v1/jobs");
export const getJob = (id: number) => request<Job>(`/v1/jobs/${id}`);
export const saveJob = (job_text: string, source_type = "text", source_label = "") =>
  request<Job>("/v1/jobs", { method: "POST", body: JSON.stringify({ job_text, source_type, source_label }) });
export const updateJob = (id: number, data: Partial<Job> & { raw_text?: string }) =>
  request<Job>(`/v1/jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteJob = (id: number) => request<{ deleted: boolean }>(`/v1/jobs/${id}`, { method: "DELETE" });

// ── Resumes ───────────────────────────────────────────────────────────
export const listResumes = () => request<{ resumes: Resume[] }>("/v1/resumes");
export const getResume = (id: number) => request<Resume>(`/v1/resumes/${id}`);
export const createResume = (name: string, raw_text: string) =>
  request<Resume>("/v1/resumes", { method: "POST", body: JSON.stringify({ name, raw_text }) });
export const uploadResumePdf = async (name: string, file: File) => {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file);

  const res = await fetch(`${BASE}/v1/resumes/upload-pdf`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<Resume>;
};
export const deleteResume = (id: number) => request<{ deleted: boolean }>(`/v1/resumes/${id}`, { method: "DELETE" });

// ── Applications ──────────────────────────────────────────────────────
export const listApplications = () => request<{ applications: Application[] }>("/v1/applications");
export const createApplication = (data: { job_id: number; resume_id?: number; status?: string; notes?: string }) =>
  request<Application>("/v1/applications", { method: "POST", body: JSON.stringify(data) });
export const updateApplication = (id: number, data: Record<string, unknown>) =>
  request<Application>(`/v1/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteApplication = (id: number) =>
  request<{ deleted: boolean }>(`/v1/applications/${id}`, { method: "DELETE" });

// Outreach
export const listOutreachContactsForJob = (jobId: number) =>
  request<{ contacts: OutreachContact[] }>(`/v1/outreach/jobs/${jobId}/contacts`);
export const createOutreachContact = (payload: CreateOutreachContactPayload) =>
  request<OutreachContact>("/v1/outreach/contacts", { method: "POST", body: JSON.stringify(payload) });
export const updateOutreachContact = (contactId: number, payload: UpdateOutreachContactPayload) =>
  request<OutreachContact>(`/v1/outreach/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteOutreachContact = (contactId: number) =>
  request<{ deleted: boolean }>(`/v1/outreach/contacts/${contactId}`, { method: "DELETE" });
export const listOutreachMessagesForJob = (jobId: number) =>
  request<{ messages: OutreachMessage[] }>(`/v1/outreach/jobs/${jobId}/messages`);
export const listOutreachMessagesForContact = (contactId: number) =>
  request<{ messages: OutreachMessage[] }>(`/v1/outreach/contacts/${contactId}/messages`);
export const generateOutreachMessage = (payload: GenerateOutreachMessagePayload) =>
  request<GeneratedOutreachMessageResponse>("/v1/outreach/messages/generate", { method: "POST", body: JSON.stringify(payload) });
export const createOutreachMessage = (payload: CreateOutreachMessagePayload) =>
  request<OutreachMessage>("/v1/outreach/messages", { method: "POST", body: JSON.stringify(payload) });
export const updateOutreachMessage = (messageId: number, payload: UpdateOutreachMessagePayload) =>
  request<OutreachMessage>(`/v1/outreach/messages/${messageId}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteOutreachMessage = (messageId: number) =>
  request<{ deleted: boolean }>(`/v1/outreach/messages/${messageId}`, { method: "DELETE" });

// ── Matches ───────────────────────────────────────────────────────────
export const listMatches = () => request<{ matches: MatchResult[] }>("/v1/matches");
export const createMatch = (job_id: number, resume_id: number) =>
  request<MatchResult>("/v1/matches", { method: "POST", body: JSON.stringify({ job_id, resume_id }) });
export const scoreText = (job_text: string, resume_text: string) =>
  request<MatchTextResult>("/v1/matches/score-text", { method: "POST", body: JSON.stringify({ job_text, resume_text }) });
export const deleteMatch = (id: number) => request<{ deleted: boolean }>(`/v1/matches/${id}`, { method: "DELETE" });

// ── AI ────────────────────────────────────────────────────────────────
export const explainMatch = (job_id: number, resume_id: number, api_key: string) =>
  request<{ match_score: number; recommendation: string; explanation: AIExplanation }>(
    "/v1/ai/explain-match",
    { method: "POST", body: JSON.stringify({ job_id, resume_id, api_key }) }
  );
export const generateCoverLetter = (job_id: number, resume_id: number, api_key: string) =>
  fetch(`${BASE}/v1/ai/cover-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id, resume_id, api_key }),
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? `Request failed: ${res.status}`);
    }
    return res.blob();
  });
