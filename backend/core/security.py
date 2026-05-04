SENSITIVE_KEY_PARTS = (
    "token",
    "secret",
    "key",
    "password",
    "totp",
    "jwt",
    "refresh",
)

PRESERVE_SENSITIVE_STATUS_KEYS = {
    "auth_token_available",
    "feed_token_available",
    "refresh_token_available",
    "path_configured",
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
            if _is_sensitive_key(key_text) and key_text not in PRESERVE_SENSITIVE_STATUS_KEYS:
                sanitized[key] = "***REDACTED***"
            else:
                sanitized[key] = sanitize_response(value)
        return sanitized

    if isinstance(data, list):
        return [sanitize_response(item) for item in data]

    return data


def _is_sensitive_key(key: str) -> bool:
    return any(part in key for part in SENSITIVE_KEY_PARTS)
