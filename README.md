# README.md
# WaterlooWorks Job Analyzer Web App

A full-stack web app that batch-analyzes WaterlooWorks job posting PDFs and generates tailored cover letters.

Built with FastAPI, Next.js (TypeScript), and OpenAI.

---

## Features (MVP)

Upload multiple WaterlooWorks job posting PDFs and:

• Analyze → download a structured CSV (analysis.csv)  
• Generate Cover Letters → download a ZIP (cover_letters.zip) with one .txt per job  

Unlimited batch uploads.

---

## Tech Stack

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:
- FastAPI
- Python
- pdfplumber

AI:
- OpenAI API (Bring Your Own Key)

---

## API Endpoints

Analyze jobs:

POST /v1/batch/analyze

Returns:
analysis.csv


Generate cover letters:

POST /v1/batch/cover-letters

Requires:
- resume_text
- openai_api_key

Returns:
cover_letters.zip

---

## Local Setup

### 1) Backend

```bash
cd backend
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload
```

Backend runs at:

http://127.0.0.1:8000

API docs:

http://127.0.0.1:8000/docs

---

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

http://localhost:3000

---

## Demo PDFs (optional)

Place demo PDFs in:

frontend/public/demo_pdfs/

Optional ZIP for easy download:

frontend/public/demo_pdfs.zip

---

## Architecture

Frontend → FastAPI backend → OpenAI → file generation → browser download

No persistent storage in v1.

---

## Roadmap (V2)

- SQL database integration
- Resume upload support
- Cover letter preview in browser
- Public deployment
- Background job queue
