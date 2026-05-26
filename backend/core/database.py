# backend/core/database.py

import os
from pathlib import Path
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.core.config import settings

# Base class for SQLAlchemy models
Base = declarative_base()

def get_database_url() -> str:
    """Get database URL from settings or fall back to SQLite."""
    url = settings.database_url
    if not url:
        # Fallback to local SQLite URL using settings.db_path
        db_path = settings.db_path
        if db_path == ":memory:":
            url = "sqlite:///:memory:"
        else:
            url = f"sqlite:///{db_path}"
    return url

def create_engine_safe(url: Optional[str] = None, **kwargs):
    """Create a SQLAlchemy engine safely, ensuring SQLite parent dirs exist if needed.
    
    Prevents early connection attempts and configures engine properties without leaking credentials.
    """
    if url is None:
        url = get_database_url()
        
    # If SQLite, ensure the parent directory of the database file exists
    if url.startswith("sqlite:///"):
        db_path_str = url[len("sqlite:///"):]
        if db_path_str != ":memory:":
            db_path = Path(db_path_str)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            
    # Apply connection argument defaults for SQLite
    if url.startswith("sqlite"):
        if "connect_args" not in kwargs:
            kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # Postgres connection options
        if "pool_size" not in kwargs and settings.database_pool_size:
            kwargs["pool_size"] = settings.database_pool_size
            
    if "echo" not in kwargs:
        kwargs["echo"] = settings.database_echo
        
    return create_engine(url, **kwargs)

def get_session_factory(engine):
    """Create a configured sessionmaker bound to the given engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db_metadata(engine) -> None:
    """Create all tables defined in declarative metadata."""
    Base.metadata.create_all(bind=engine)
