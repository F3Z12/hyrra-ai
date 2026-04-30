# Hyrra AI — Private Developer Repository

Hyrra AI is an AI-powered job intelligence and application engine. This repository contains the full proprietary source code for the platform.

## Architecture & Structure
The project is split into three main components:

- **`backend/`**: FastAPI python server. Handles job/resume extraction, matching engine, SQLite persistence, and OpenAI integration.
- **`frontend/`**: Next.js React application. Provides the dashboard for tracking applications, viewing matches, and managing resumes.
- **`frontend/extension/`**: Chrome Extension MVP for extracting visible job posting text from career sites.

## Local Setup

### 1. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

### 2. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

### 3. Chrome Extension Setup
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer Mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `frontend/extension` folder from this repository.
5. The Hyrra AI extension is now active and can communicate with your local backend.

## Security Warning
> [!CAUTION]  
> - **DO NOT COMMIT `.env` FILES.** OpenAI API keys must remain strictly local.
> - **DO NOT COMMIT `hyrra.db` or `job_intelligence.db`.** This file contains personal resumes and job data. Ensure it remains in `.gitignore`.
