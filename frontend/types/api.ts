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
