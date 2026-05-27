# backend/core/database.py

from pathlib import Path
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.core.config import settings
from urllib.parse import urlparse, urlunparse

# Base class for SQLAlchemy models
Base = declarative_base()

def redact_db_url(url: str) -> str:
    """Redact credentials from a database URL."""
    if not url:
        return ""
    # Try with regex first for general robustness (handles special chars in pass)
    import re
    # Matches scheme://username:password@ and captures scheme/username/remainder
    # It avoids greedily grabbing past the '@' of the credentials block by stopping before '/' or '@'
    pattern = re.compile(r"^([a-zA-Z0-9+.-]+://)([^:/@]+):([^@/]+)(@.*)$")
    match = pattern.match(url)
    if match:
        return f"{match.group(1)}{match.group(2)}:***{match.group(4)}"

    try:
        parsed = urlparse(url)
        if parsed.password:
            # Mask the password
            netloc = parsed.username or ""
            netloc += ":***"
            if parsed.hostname:
                netloc += f"@{parsed.hostname}"
                if parsed.port:
                    netloc += f":{parsed.port}"
            else:
                netloc += f"@{parsed.netloc.split('@')[-1]}"
            parsed = parsed._replace(netloc=netloc)
            return urlunparse(parsed)
        return url
    except Exception:
        return "database_url_redacted"

def sanitize_db_error(message: str, raw_url: Optional[str] = None) -> str:
    """Sanitize database error messages by removing raw credentials or the raw URL."""
    if not message:
        return ""
    if raw_url:
        try:
            redacted = redact_db_url(raw_url)
            if raw_url in message:
                message = message.replace(raw_url, redacted)
            parsed = urlparse(raw_url)
            if parsed.password:
                if parsed.password in message:
                    message = message.replace(parsed.password, "***")
                # Also check URL-encoded version of password
                from urllib.parse import quote_plus
                quoted = quote_plus(parsed.password)
                if quoted in message:
                    message = message.replace(quoted, "***")
        except Exception:
            pass
            
    # Also search for password/username patterns inside the error message directly!
    import re
    # Match any URL-like structure in the error message and redact it
    url_pattern = re.compile(r"([a-zA-Z0-9+.-]+://)([^:/@]+):([^@/]+)@")
    message = url_pattern.sub(r"\1\2:***@", message)
    
    sensitive_terms = ("api_key", "password", "secret", "jwt", "refresh", "feed", "token")
    if any(term in message.lower() for term in sensitive_terms):
        return "Database connection error (credentials/sensitive info redacted)"
    return message

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
            
    # Handle postgres:// to postgresql:// conversion for SQLAlchemy 1.4+
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
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
        # Ensure a connection timeout (e.g. 5 seconds) to avoid long blocking calls
        if "connect_args" not in kwargs:
            kwargs["connect_args"] = {"connect_timeout": 5}
        elif isinstance(kwargs["connect_args"], dict) and "connect_timeout" not in kwargs["connect_args"]:
            kwargs["connect_args"]["connect_timeout"] = 5

        # pool_size is only valid if we are not using a custom poolclass (like NullPool in migrations)
        if "poolclass" not in kwargs:
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

def check_db_health(engine) -> tuple[bool, Optional[str]]:
    """Check connection health of the database engine."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except Exception as e:
        raw_url = str(engine.url) if engine and engine.url else None
        return False, sanitize_db_error(str(e), raw_url)
