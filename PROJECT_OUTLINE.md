# Hyrra AI — Project Outline

## 1) Goal
Hyrra AI is an AI-powered job intelligence and application engine.

Users can:
- Upload job posting PDFs or paste raw text.
- Save and track job applications in a Kanban board.
- Upload resumes and parse profiles.
- Run deterministic match scoring.
- Generate AI-powered cover letters and match explanations.

Stack:
- Backend: **FastAPI** (Python)
- Frontend: **Next.js** (React + TypeScript)
- AI: **OpenAI API** (BYOK — Bring Your Own Key)
- Storage: **SQLite** (Local-first MVP)
- Sourcing: **Chrome Extension**

---

## 2) System Architecture
Frontend (Next.js Dashboard):
- Manage Jobs, Resumes, Matches, and Applications.
- Kanban board for application tracking.

Backend (FastAPI):
- Extract PDF text (pdfplumber)
- Normalize text
- Extract candidate/job profiles
- Compute match scores
- Generate cover letters (OpenAI)

Storage (SQLite):
- Relational tables: Jobs, Resumes, Matches, Applications.

Extension (Chrome):
- Inject into active tabs to scrape visible job descriptions.
- Transmit directly to the local backend.
