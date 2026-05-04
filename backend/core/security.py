from fastapi import Header, HTTPException

from backend.core.config import settings


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
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_text = str(key).lower()
            if _should_redact(key_text, value):
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


async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    """
    Optional demo admin guard.

    If ADMIN_TOKEN is unset, admin auth is disabled. If it is set, callers must
    provide the exact value in X-Admin-Token. Token values are never logged or
    returned.
    """
    if not settings.admin_token:
        return
    if x_admin_token != settings.admin_token:
        raise HTTPException(
            status_code=403,
            detail="Admin token required. Set X-Admin-Token header.",
        )
