# WaterlooWorks Webapp — Project Outline

## 1) Goal
Convert my WaterlooWorks job analyzer script into a full-stack web app.

User can:
- Upload many job posting PDFs
- Click Analyze → download 1 combined CSV
- Click Generate Cover Letters → download a ZIP of cover letters (one per PDF)

Stack:
- Backend: FastAPI
- Frontend: Next.js
- Resume input: .txt (MVP)

## 2) MVP Requirements

### 2.1 Analyze (Batch)
Input:
- Multiple WaterlooWorks job posting PDFs

Output:
- Single CSV download
  - one row per job posting
  - columns: (we will decide exact column list)

Endpoint:
- POST /v1/batch/analyze
Response:
- file download: analysis.csv

### 2.2 Generate Cover Letters (Batch)
Input:
- Multiple job posting PDFs
- resume_text (from resume.txt or pasted text)
- prompt_template (backend-side file, like current project)

Output:
- ZIP download
  - one cover letter file per job posting

Endpoint:
- POST /v1/batch/cover-letters
Response:
- file download: cover_letters.zip

## 3) Backend Principle
Backend does everything:
- Extract PDF text
- Parse metadata + detect skills
- Generate cover letters
Frontend only uploads and downloads.

## 4) Storage + Accounts
MVP:
- No accounts
- No database
- No saving history

V2 (planned):
- Add SQL database (store analyses + letters + history)
- Possibly add accounts/auth

## 5) Performance Model (MVP)
- Synchronous processing:
  - request runs until batch is done
  - then returns CSV/ZIP

Server safety limits (not “user caps”):
- per-file max size
- total request max size
- request timeout limits
(these prevent server crashes)

## 6) Build Order
1) Backend skeleton + /health
2) Batch analyze endpoint → returns CSV
3) Batch cover letters endpoint → returns ZIP
4) Frontend UI to upload + download

## 7) Definition of Done (MVP)
- Upload PDFs → download analysis CSV
- Upload PDFs + resume.txt → download cover_letters.zip
- Works end-to-end locally
