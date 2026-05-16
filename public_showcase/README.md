# Hyrra AI — AI Job Intelligence & Application Engine

> **Repository Note**: This repository serves as a **product showcase and architectural case study** for Hyrra AI. The core implementation source code is private.

## Overview

Hyrra AI is a comprehensive, AI-powered job application copilot built for modern professionals. It bridges the gap between discovering a job on a career site and submitting a highly tailored application. By combining intelligent text extraction, deterministic matching algorithms, and LLM-powered enrichment, Hyrra AI helps users understand exactly how their resume aligns with a job posting and provides actionable steps to improve their chances.

The platform has grown to include an **Apply Agent** — a human-supervised browser automation layer that generates a confidence-ranked fill plan for job application forms and delegates safe, structured fields to a managed browser, while blocking sensitive inputs and requiring human review at every step.

## The Problem

The modern job search is fragmented and tedious. Candidates must manually track jobs across multiple boards, guess which skills an ATS system will prioritize, and spend hours drafting custom cover letters and filling out repetitive application forms. Existing tools often trap users in walled gardens or require them to surrender their private data.

## The Solution

Hyrra AI provides a local-first, BYOK workflow. Using a dedicated Chrome extension, users can instantly ingest job descriptions from any career page into their personal dashboard. The platform parses the job, compares it against stored resumes, generates a strict ATS match score, uses AI to explain skill gaps and draft cover letters, and — in the latest proof of concept — can pre-fill application form fields using a structured, safety-gated pipeline.

## Key Features

- **Instant Job Ingestion**: Extract job descriptions directly from any website via the Chrome Extension.
- **Smart Resume Parsing**: Upload PDFs or paste raw text to automatically extract skills, projects, and qualifications.
- **Deterministic Match Scoring**: Instantly view how well a resume aligns with a job description based on strict, word-boundary-aware skill matching.
- **AI Match Explanation**: Understand exactly why a match score was given, with AI-generated feedback on strengths, weaknesses, and improvement suggestions.
- **Cover Letter Generation**: Automatically draft context-aware cover letters tailored to the intersection of the job's requirements and the candidate's experience.
- **Application Tracking**: A built-in Kanban board to track the lifecycle of every application from "Saved" to "Offer".
- **Apply Agent + OpenClaw *(Proof of Concept)***: The Chrome extension detects a job application page and extracts structured form fields. The FastAPI backend creates an Apply Agent session, runs a suggestion cascade (candidate profile → resume → deterministic → AI), and produces a confidence-ranked fill plan classifying every field as `safe`, `review_required`, or `blocked`. A local OpenClaw managed browser then fills the safe fields — name, email, school, LinkedIn, GitHub — while sensitive inputs like work authorization are blocked entirely. Nothing is submitted automatically. Every suggestion, fill action, and decision is written to an immutable audit log.

## Apply Agent — Proof of Concept Demo

**[Watch the demo on Google Drive](https://drive.google.com/file/d/1LdkdDU8ftsA2dHXzZoC9mQrUeeC6z9Ep/view?usp=sharing)**

The demo shows the full end-to-end flow: Chrome extension detecting the mock application page → Apply Agent session creation → fill plan generation with safe / review-required / blocked classification → OpenClaw filling the managed browser → structured JSON result returned to the backend. See [`apply_agent_demo.md`](apply_agent_demo.md) for the full architecture breakdown, safety model, current limitations, and next-direction roadmap.

## System Architecture

The system is decoupled into a frontend presentation layer, a stateless extraction/enrichment backend, and a persistence layer.

- **Chrome Extension**: Injects into the active tab to extract visible job posting text for job saving, and detects controlled application pages to launch Apply Agent sessions. Reads structured form field metadata directly from DOM attributes — no `localStorage` dependency.
- **Backend (FastAPI)**: Serves as the core engine. Normalizes incoming text, extracts structured profiles, computes match scores, handles optional OpenAI enrichments, manages Apply Agent sessions and fill plans, and orchestrates the local OpenClaw subprocess.
- **Frontend Dashboard (Next.js)**: A responsive interface providing a unified view of the job search pipeline, the Apply Agent review workflow (Accept / Edit / Skip per field), and the immutable action log.
- **Database (SQLite)**: A lightweight, local-first storage layer. Core entities: `Job`, `Resume`, `Application`, `MatchResult`, `CandidateProfile`, `ApplyAgentSession`, `ApplyAgentFieldSuggestion`, `ApplyAgentActionLog`.

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI, SQLAlchemy, Pydantic, python-dotenv
- **Database**: SQLite (local-first)
- **AI & Parsing**: OpenAI API (BYOK), pdfplumber
- **Browser Automation**: OpenClaw (local subprocess, dev/POC only)
- **Extension**: Chrome Manifest V3

## Chrome Extension Workflow

**Job saving mode:**
1. User navigates to a job posting.
2. User clicks the Hyrra extension, which extracts the main body text.
3. User verifies or edits the text in the extension popup.
4. User clicks "Save Job", storing the job in their Hyrra database.

**Apply Agent mode:**
1. User opens a supported application page.
2. Extension detects the page marker and reads structured field metadata from the DOM.
3. Extension creates an Apply Agent session on the backend.
4. Backend returns a fill plan with per-field confidence, source, and review flags.
5. User triggers OpenClaw; the managed browser fills safe fields.
6. User reviews results in the Hyrra dashboard before the session is marked complete.

## AI Matching & Enrichment

Hyrra uses a two-step approach to matching:
1. **Deterministic Parsing**: A strict regex and word-boundary engine identifies industry-standard skills — no LLMs involved at this stage.
2. **LLM Enrichment**: OpenAI is used for high-level reasoning — explaining *why* a candidate is a strong fit, generating targeted cover letters, and (optionally) drafting written-answer fields in the Apply Agent flow.

## Privacy & Safety

- Jobs, resumes, and application data are stored locally. No data leaves the machine by default.
- OpenAI API keys are used per-request and never stored.
- The Apply Agent **never submits a form automatically**. Sensitive fields (work authorization, select inputs, checkboxes) are excluded at the fill-plan level before any browser interaction occurs.
- All Apply Agent actions are written to an append-only audit log queryable at any time.
