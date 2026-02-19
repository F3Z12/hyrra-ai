# PROJECT_OUTLINE.md
# WaterlooWorks Webapp — Project Outline

## 1) Goal
Convert my WaterlooWorks job analyzer script into a full-stack web application.

Users can:
- Upload **unlimited** WaterlooWorks job posting PDFs
- Click **Analyze** → download **1 combined CSV**
- Click **Generate Cover Letters** → download a **ZIP** of AI-generated cover letters

Stack:
- Backend: **FastAPI** (Python)
- Frontend: **Next.js** (React + TypeScript)
- AI: **OpenAI API** (BYOK — Bring Your Own Key)
- Resume input: **pasted text** (MVP)
- Storage: **none** (MVP), **SQL planned** (V2)

---

## 2) System Architecture
Frontend (Next.js):
- Upload PDFs
- Paste resume text
- (Optional) paste OpenAI API key for cover letters
- Download CSV / ZIP responses

Backend (FastAPI):
- Extract PDF text (pdfplumber)
- Normalize text
- Parse metadata fields
- Detect skills (keyword matching)
- Generate CSV
- Generate cover letters (OpenAI) and return ZIP

Outputs:
- `/v1/batch/analyze` → CSV download
- `/v1/batch/cover-letters` → ZIP download

No files are stored permanently (MVP).

---

## 3) MVP Requirements

### 3.1 Analyze Endpoint (Batch)
Endpoint:
- POST `/v1/batch/analyze`

Input:
- Multiple WaterlooWorks job posting PDFs

Processing:
- Extract + normalize text
- Parse metadata fields
- Detect skills via keyword matching

Output:
- Download: `analysis.csv`
- One row per job posting

CSV columns (v1):
- filename
- posting_id
- organization
- job_title
- term_duration
- skills
- raw_text_length
- parse_warnings

---

### 3.2 Cover Letter Endpoint (Batch)
Endpoint:
- POST `/v1/batch/cover-letters`

Input:
- Multiple job posting PDFs
- `resume_text` (from frontend textarea)
- `openai_api_key` (BYOK — required for public demo)

Processing:
- Extract job text
- Build prompt
- Call OpenAI API
- Generate one personalized cover letter per job
- Package results into ZIP in-memory

Output:
- Download: `cover_letters.zip`
- One `.txt` file per job posting (named by posting_id when available)

---

## 4) Backend Design Principles
Backend performs ALL logic:
- PDF parsing
- Metadata extraction
- Skill detection
- AI generation
- CSV generation
- ZIP generation

Frontend handles:
- File upload
- Resume input
- API key input (BYOK)
- File download + UI

This mirrors a production-style separation of concerns.

---

## 5) Storage and Accounts
MVP:
- No database
- No accounts
- No persistent storage/history

V2 planned:
- SQL database integration
- Store analysis + cover letters + history
- Optional user accounts/auth

---

## 6) Performance Model
Synchronous processing (MVP):
User request → backend processes batch → backend returns file.

V2 options:
- Background jobs / queues
- Async workers for large batches

---

## 7) Frontend Requirements
UI must allow:
- Upload multiple PDFs
- Paste resume text
- Provide OpenAI key for cover letters (BYOK)
- Click Analyze → download CSV
- Click Generate → download ZIP

---

## 8) Definition of Done (MVP)
Done when:
- Upload PDFs → correct CSV downloads
- Upload PDFs + resume + key → correct ZIP downloads
- Cover letters generated via OpenAI (BYOK)
- Frontend ↔ backend works end-to-end locally

---

## 9) Future Improvements (V2)
Planned enhancements:
- SQL database integration + history
- Resume file upload support
- Dashboard (view analysis in browser)
- Cloud deployment + proper limits
- Drag-and-drop upload UI
- Cover letter preview in browser
