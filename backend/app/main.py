"""
FastAPI application entry point.

Creates the app, configures CORS, registers API routers,
and initializes the database on startup.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.database.db import init_db
from app.api.jobs import router as jobs_router
from app.api.resumes import router as resumes_router
from app.api.applications import router as applications_router
from app.api.matches import router as matches_router
from app.api.ai import router as ai_router
from app.api.outreach import router as outreach_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    init_db()
    yield


app = FastAPI(
    title="Hyrra AI API",
    description="Backend API for job analysis, storage, matching, and application tracking.",
    version="2.0.0",
    lifespan=lifespan,
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(jobs_router, prefix="/v1/jobs", tags=["Jobs"])
app.include_router(resumes_router, prefix="/v1/resumes", tags=["Resumes"])
app.include_router(applications_router, prefix="/v1/applications", tags=["Applications"])
app.include_router(matches_router, prefix="/v1/matches", tags=["Matches"])
app.include_router(ai_router, prefix="/v1/ai", tags=["AI"])
app.include_router(outreach_router, prefix="/v1/outreach", tags=["Outreach"])
