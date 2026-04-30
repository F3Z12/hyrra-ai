"""
Database setup — SQLAlchemy + SQLite.

Provides engine, session factory, Base class, and initialization.
Tables are created automatically on app startup via init_db().
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./job_intelligence.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """
    FastAPI dependency that provides a database session.

    Yields a session and ensures it is closed after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create all tables defined by ORM models.

    Called once on app startup. Safe to call multiple times —
    SQLAlchemy will skip tables that already exist.
    """
    from app.database import models  # noqa: F401 — import to register models
    Base.metadata.create_all(bind=engine)
