# backend/core/security.py

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Header, HTTPException, Depends, status
import jwt
from passlib.context import CryptContext

from backend.core.config import settings
from backend.db.models import User
from backend.db.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

SENSITIVE_KEY_PARTS = (
    "token",
    "secret",
    "key",
    "password",
    "totp",
    "jwt",
    "refresh",
    "auth",
    "credential",
    "database_url",
    "db_url",
    "conn_str",
    "dsn",
)

PRESERVE_SENSITIVE_STATUS_KEYS = {
    "auth_token_available",
    "feed_token_available",
    "refresh_token_available",
    "path_configured",
    "auth_configured",
    "api_key_configured",
}


def sanitize_response(data):
    """
    Recursively redact sensitive values in response-like dict/list structures.

    Boolean availability/status fields are preserved when they are explicitly
    non-secret health indicators.
    """
    if isinstance(data, str):
        if "://" in data:
            from backend.core.database import redact_db_url
            return redact_db_url(data)
        return data

    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_text = str(key).lower()
            if _should_redact(key_text, value):
                if isinstance(value, str) and any(x in key_text for x in ("database_url", "db_url", "conn_str", "dsn")):
                    from backend.core.database import redact_db_url
                    sanitized[key] = redact_db_url(value)
                else:
                    sanitized[key] = "***REDACTED***"
            else:
                sanitized[key] = sanitize_response(value)
        return sanitized

    if isinstance(data, list):
        return [sanitize_response(item) for item in data]

    return data


def _is_sensitive_key(key: str) -> bool:
    return any(part in key for part in SENSITIVE_KEY_PARTS)


def _should_redact(key: str, value) -> bool:
    if not _is_sensitive_key(key):
        return False
    if key in PRESERVE_SENSITIVE_STATUS_KEYS and not isinstance(value, str):
        return False
    if key.endswith("_available") and isinstance(value, bool):
        return False
    if key.endswith("_configured") and isinstance(value, bool):
        return False
    return True


# ------------------------------------------------------------------
# Password Hashing and Verification
# ------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify standard plaintext password against hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


# ------------------------------------------------------------------
# JWT Generation and Validation
# ------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JSON Web Token containing claims and an expiration time."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT and return the dictionary payload, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.PyJWTError:
        return None


# ------------------------------------------------------------------
# Database Session Helper
# ------------------------------------------------------------------

_db_engine = None
_db_session_factory = None

def _get_db_session():
    global _db_engine, _db_session_factory
    from backend.core.database import create_engine_safe, get_session_factory, init_db_metadata
    if _db_engine is None:
        _db_engine = create_engine_safe()
        init_db_metadata(_db_engine)
        _db_session_factory = get_session_factory(_db_engine)
    return _db_session_factory()


def get_db():
    """FastAPI database session generator dependency."""
    db = _get_db_session()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------------------------
# Exceptions
# ------------------------------------------------------------------

class UserNotAuthorizedException(HTTPException):
    def __init__(self, detail: str = "Not authorized"):
        super().__init__(status_code=403, detail=detail)


class UserUnauthenticatedException(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


# ------------------------------------------------------------------
# Authentication and Authorization Dependencies
# ------------------------------------------------------------------

async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_admin_token: Optional[str] = Header(default=None),
    db = Depends(get_db)
) -> User:
    """
    FastAPI dependency to retrieve the currently logged-in user.
    Supports legacy X-Admin-Token as fallback, generating a virtual admin.
    """
    if authorization is not None and not isinstance(authorization, str):
        authorization = None
    if x_admin_token is not None and not isinstance(x_admin_token, str):
        x_admin_token = None

    # 1. Check legacy X-Admin-Token first to keep backwards compatibility
    if settings.admin_token and x_admin_token == settings.admin_token:
        # Return a virtual user representing admin
        virtual_admin = User(
            id=0,
            username="legacy_admin",
            role="ADMIN",
            is_active=True
        )
        return virtual_admin

    # 2. Check JWT bearer token
    if not authorization or not authorization.startswith("Bearer "):
        raise UserUnauthenticatedException("Not authenticated")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise UserUnauthenticatedException("Invalid token")
        
    username = payload.get("sub")
    if not username:
        raise UserUnauthenticatedException("Invalid token payload")
        
    # Resolve DB if it is a Depends object (e.g. in test direct calls)
    db_session = db
    close_db = False
    if db is None or (hasattr(db, "__class__") and db.__class__.__name__ == "Depends"):
        db_session = next(get_db())
        close_db = True

    try:
        repo = UserRepository()
        user = repo.get_user_by_username(db_session, username)
        if not user:
            raise UserUnauthenticatedException("User not found")
            
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
            
        return user
    finally:
        if close_db and db_session:
            db_session.close()


async def require_admin_token(
    x_admin_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
    db = Depends(get_db)
) -> None:
    """
    Legacy and production admin verification guard.
    Passes if X-Admin-Token matches settings.admin_token,
    or if valid JWT has ADMIN role. Protected routes remain protected even
    when ADMIN_TOKEN is not configured.
    """
    if authorization is not None and not isinstance(authorization, str):
        authorization = None
    if x_admin_token is not None and not isinstance(x_admin_token, str):
        x_admin_token = None

    # Resolve DB if it is a Depends object (e.g. in test direct calls)
    db_session = db
    close_db = False
    if db is None or (hasattr(db, "__class__") and db.__class__.__name__ == "Depends"):
        db_session = next(get_db())
        close_db = True

    try:
        # Allow if legacy admin token matches
        if settings.admin_token and x_admin_token == settings.admin_token:
            return

        # Or if valid JWT has ADMIN role
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            payload = decode_access_token(token)
            if payload and payload.get("role") == "ADMIN":
                username = payload.get("sub")
                if username:
                    repo = UserRepository()
                    user = repo.get_user_by_username(db_session, username)
                    if user and user.role == "ADMIN" and user.is_active:
                        return

        raise HTTPException(
            status_code=403,
            detail="Admin authentication required.",
        )
    finally:
        if close_db and db_session:
            db_session.close()


class RoleChecker:
    """FastAPI dependency factory to check user roles."""
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = [r.upper() for r in allowed_roles]

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.upper() not in self.allowed_roles:
            raise UserNotAuthorizedException(
                f"Role {current_user.role} is not authorized for this resource"
            )
        return current_user
