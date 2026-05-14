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
