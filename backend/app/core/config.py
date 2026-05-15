"""
Core configuration for the backend app.

backend/.env is loaded automatically here so that a plain
`uvicorn app.main:app --reload` picks up the same values as
`uvicorn app.main:app --reload --env-file .env`.
Already-set environment variables are NOT overridden (override=False),
so explicit shell exports and --env-file still take precedence.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Two parents up from this file:  app/core/config.py → app/core → app → backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env", override=False)

# CORS origins allowed to access the API.
# Both localhost and 127.0.0.1 variants are listed because OpenClaw's managed Chrome
# profile treats them as distinct origins from the normal browser.
CORS_ORIGINS: list[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://hyrra-ai-frontend.onrender.com",
]

# ---------------------------------------------------------------------------
# OpenClaw runner (dev-only — NEVER enable in production)
# ---------------------------------------------------------------------------
# Set ENABLE_LOCAL_OPENCLAW_RUNNER=true in .env to enable the subprocess runner.
# This must never be true in production; it spawns a local OpenClaw process.
ENABLE_LOCAL_OPENCLAW_RUNNER: bool = (
    os.getenv("ENABLE_LOCAL_OPENCLAW_RUNNER", "false").lower() == "true"
)

# Hard cap on OpenClaw subprocess duration in seconds.
# 600s allows for slow page loads and multi-field forms; override via env var.
OPENCLAW_MAX_TIMEOUT: int = int(os.getenv("OPENCLAW_MAX_TIMEOUT", "600"))

# Explicit path to the OpenClaw binary.
# Set this in .env when the binary is installed via npm on Windows and is not
# on the PATH visible to the Python subprocess (e.g. APPDATA\npm\openclaw.cmd).
# If empty, the runner falls back to shutil.which and APPDATA npm path probes.
OPENCLAW_BIN: str = os.getenv("OPENCLAW_BIN", "").strip()

# Path to the Codex app-server binary used internally by OpenClaw.
# The subprocess inherits environment variables from the Python process, but on
# Windows the Python process may have been started without this variable if the
# backend is launched from an IDE or a shell that doesn't source the full npm
# environment.  Set this in .env so the runner injects it explicitly.
OPENCLAW_CODEX_APP_SERVER_BIN: str = os.getenv("OPENCLAW_CODEX_APP_SERVER_BIN", "").strip()
