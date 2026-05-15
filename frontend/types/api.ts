export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  employment_type: string;
  source_type: string;
  source_label: string | null;
  parsed_profile: ParsedJobProfile | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedJobProfile {
  title: string;
  company: string;
  location: string;
  employment_type: string;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  qualifications: string[];
  preferred_qualifications: string[];
  keywords: string[];
  parse_warnings: string[];
}

export interface Resume {
  id: number;
  name: string;
  raw_text: string;
  parsed_profile: ParsedResumeProfile | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedResumeProfile {
  skills: string[];
  projects: string[];
  experience_keywords: string[];
  education_keywords: string[];
  keywords: string[];
  parse_warnings: string[];
}

export interface Application {
  id: number;
  job_id: number;
  resume_id: number | null;
  status: string;
  notes: string | null;
  date_applied: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  job_title: string | null;
  job_company: string | null;
  resume_name: string | null;
}

export interface OutreachContact {
  id: number;
  job_id: number;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  source: string | null;
  confidence_score: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateOutreachContactPayload {
  job_id: number;
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  source?: string | null;
  confidence_score?: number | null;
  notes?: string | null;
}

export type UpdateOutreachContactPayload = Partial<Omit<CreateOutreachContactPayload, "job_id">>;

export type OutreachMessageStatus = "draft" | "copied" | "sent" | "replied" | "closed";
export type OutreachMessageType = "email" | "linkedin_dm" | "follow_up" | "referral_request";

export interface OutreachMessage {
  id: number;
  job_id: number;
  contact_id: number | null;
  message_type: OutreachMessageType;
  subject: string | null;
  body: string;
  status: OutreachMessageStatus;
  follow_up_date: string | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  contact_name: string | null;
}

export interface CreateOutreachMessagePayload {
  job_id: number;
  contact_id?: number | null;
  message_type: OutreachMessageType;
  subject?: string | null;
  body: string;
  status?: OutreachMessageStatus;
  follow_up_date?: string | null;
  sent_at?: string | null;
}

export interface UpdateOutreachMessagePayload {
  contact_id?: number | null;
  message_type?: OutreachMessageType;
  subject?: string | null;
  body?: string;
  status?: OutreachMessageStatus;
  follow_up_date?: string | null;
  sent_at?: string | null;
}

export interface GenerateOutreachMessagePayload {
  job_id: number;
  contact_id?: number | null;
  resume_id?: number | null;
  match_id?: number | null;
  message_type: OutreachMessageType;
  api_key: string;
  save_as_draft: boolean;
  extra_context?: string | null;
}

export interface GeneratedOutreachMessageResponse {
  message_id: number | null;
  job_id: number;
  contact_id: number | null;
  message_type: OutreachMessageType;
  subject: string | null;
  body: string;
  status: "draft";
  created_at: string | null;
  job_title: string | null;
  job_company: string | null;
  contact_name: string | null;
  contact_title: string | null;
  resume_name: string | null;
}

export interface MatchResult {
  id: number;
  job_id: number;
  resume_id: number;
  match_score: number;
  recommendation: string;
  matched_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  keyword_overlap: string[];
  reasoning: string;
  suggested_angle: string;
  created_at: string;
  updated_at: string;
  job_title: string | null;
  job_company: string | null;
  resume_name: string | null;
}

export interface AIExplanation {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvement_suggestions: string[];
  positioning_strategy: string;
  resume_bullets: string[];
  cover_letter_angle: string;
}

export interface MatchTextResult {
  job_profile: ParsedJobProfile;
  resume_profile: ParsedResumeProfile;
  match_result: {
    match_score: number;
    recommendation: string;
    matched_skills: string[];
    missing_required_skills: string[];
    missing_preferred_skills: string[];
    keyword_overlap: string[];
    reasoning: string;
    suggested_angle: string;
  };
}

// ── Candidate Profile ────────────────────────────────────────────────────

export interface CandidateProfile {
  id: number;
  label: string;
  resume_id: number | null;
  // Identity
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  location_city: string | null;
  location_region: string | null;
  country: string | null;
  // Education
  school: string | null;
  program: string | null;
  degree: string | null;
  graduation_month: number | null;
  graduation_year: number | null;
  gpa_optional: string | null;
  // Links
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  personal_website_url: string | null;
  other_links_json: string | null;
  // Work authorization / availability
  work_authorization_country: string | null;
  authorized_to_work: string | null;
  requires_sponsorship: boolean | null;
  available_start_date: string | null;
  available_end_date: string | null;
  preferred_work_location: string | null;
  open_to_remote: boolean | null;
  // Reusable application answer context
  default_why_interested: string | null;
  default_relevant_project: string | null;
  default_additional_info: string | null;
  default_cover_note: string | null;
  // Technical highlights
  top_skills_json: string | null;
  top_projects_json: string | null;
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
}

// ── Apply Agent ──────────────────────────────────────────────────────────

export type ApplyAgentSessionStatus = "created" | "in_progress" | "completed" | "abandoned";
export type ApplyAgentResolvedStatus = "accepted" | "edited" | "skipped";
export type ApplyAgentActionType = "accepted" | "edited" | "skipped" | "manual_entry";
export type ApplyAgentSuggestionSource = "profile" | "resume" | "deterministic" | "ai" | "none";

export interface ApplyAgentFieldSuggestion {
  id: number;
  session_id: number;
  field_key: string;
  label: string;
  field_type: string;
  suggested_value: string | null;
  confidence: number;
  needs_review: boolean;
  source: ApplyAgentSuggestionSource;
  reasoning: string | null;
  resolved_status: ApplyAgentResolvedStatus | null;
  final_value: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface ApplyAgentSession {
  session_id: number;
  candidate_profile_id: number;
  job_id: number;
  resume_id: number | null;
  status: ApplyAgentSessionStatus;
  job_title: string | null;
  job_company: string | null;
  profile_label: string | null;
  resume_name: string | null;
  suggestions: ApplyAgentFieldSuggestion[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplyAgentActionLog {
  action_id: number;
  session_id: number;
  field_key: string;
  action_type: ApplyAgentActionType;
  agent_suggestion: string | null;
  final_value: string | null;
  logged_at: string | null;
}

export interface CreateApplySessionPayload {
  candidate_profile_id: number;
  job_id: number;
  resume_id?: number | null;
  api_key?: string | null;
  form_fields: { field_key: string; label: string; field_type: string }[];
}

export interface ResolveFieldPayload {
  resolved_status: ApplyAgentResolvedStatus;
  final_value?: string | null;
}

export interface LogActionPayload {
  field_key: string;
  action_type: ApplyAgentActionType;
  agent_suggestion?: string | null;
  final_value?: string | null;
}

export interface UpdateApplySessionPayload {
  status: ApplyAgentSessionStatus;
}

export interface CandidateProfilePayload {
  label: string;
  resume_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  country?: string | null;
  school?: string | null;
  program?: string | null;
  degree?: string | null;
  graduation_month?: number | null;
  graduation_year?: number | null;
  gpa_optional?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  personal_website_url?: string | null;
  other_links_json?: string | null;
  work_authorization_country?: string | null;
  authorized_to_work?: string | null;
  requires_sponsorship?: boolean | null;
  available_start_date?: string | null;
  available_end_date?: string | null;
  preferred_work_location?: string | null;
  open_to_remote?: boolean | null;
  default_why_interested?: string | null;
  default_relevant_project?: string | null;
  default_additional_info?: string | null;
  default_cover_note?: string | null;
  top_skills_json?: string | null;
  top_projects_json?: string | null;
}
