import re
from typing import Union

class BrokerErrorClassifier:
    @staticmethod
    def classify(error: Union[Exception, str]) -> str:
        """
        Classifies exception objects or error strings into unified safety categories:
        RATE_LIMIT, AUTH_FAILED, SESSION_EXPIRED, INSUFFICIENT_FUNDS,
        BROKER_REJECTED, NETWORK_TIMEOUT, VALIDATION_ERROR, UNKNOWN.
        """
        msg = str(error).upper()
        cls_name = ""
        if isinstance(error, Exception):
            cls_name = error.__class__.__name__.upper()

        # Class name patterns
        if "TIMEOUT" in cls_name or "CONNECT" in cls_name:
            return "NETWORK_TIMEOUT"
        if "AUTH" in cls_name or "CREDENTIAL" in cls_name:
            return "AUTH_FAILED"
        if "SESSION" in cls_name:
            return "SESSION_EXPIRED"
        if "LIMIT" in cls_name or "RATE" in cls_name:
            return "RATE_LIMIT"
        if "VALIDATION" in cls_name or "PYDANTIC" in cls_name:
            return "VALIDATION_ERROR"

        # Message content patterns
        if any(w in msg for w in ["RATE", "LIMIT", "TOO MANY", "429", "THROTTLE", "RESOURCE_EXHAUSTED"]):
            return "RATE_LIMIT"
        if any(w in msg for w in ["AUTH", "CREDENTIAL", "UNAUTHORIZED", "401", "TOKEN", "APIKEY", "SECRET", "PASSWORD", "SIGNATURE"]):
            return "AUTH_FAILED"
        if any(w in msg for w in ["SESSION", "EXPIRED", "LOGGED OUT", "LOGOUT", "INVALID SESSION"]):
            return "SESSION_EXPIRED"
        if any(w in msg for w in ["MARGIN", "FUNDS", "BALANCE", "INSUFFICIENT", "LIMIT EXCEEDED", "NSF"]):
            return "INSUFFICIENT_FUNDS"
        if any(w in msg for w in ["VALIDATION", "FORMAT", "INVALID TYPE", "PYDANTIC"]):
            return "VALIDATION_ERROR"
        if any(w in msg for w in ["REJECT", "BLOCKED", "INVALID", "FORBIDDEN", "403"]):
            return "BROKER_REJECTED"
        if any(w in msg for w in ["TIMEOUT", "TIME OUT", "504", "GATEWAY", "CONNECTION", "UNREACHABLE", "NETWORK"]):
            return "NETWORK_TIMEOUT"

        return "UNKNOWN"

    @staticmethod
    def get_safe_message(error: Exception) -> str:
        """
        Returns a redacted, safe message to prevent exposing sensitive internal
        messages/credentials/database URLs.
        """
        msg = str(error)
        
        # Redact database URLs (e.g. postgresql://user:pass@host/db)
        msg = re.sub(r"[a-zA-Z0-9\+\-\.]+://[^@\s]+:[^@\s]+@[^\s]+", "[REDACTED_URL]", msg)
        msg = re.sub(r"(postgres(?:ql)?://[^\s]+)", "[REDACTED_DB_URL]", msg)
        
        # Redact API keys, tokens, passwords, and secrets
        # Match pattern key=value or key: value
        patterns = [
            (r"(?i)(api[-_]?key|token|password|totp|secret|admin[-_]?token|jwt)[\"'\s]*[:=][\s\"']*[^\s,;&'\"]+", r"\1=[REDACTED]"),
            (r"(?i)(api[-_]?key|token|password|totp|secret|admin[-_]?token|jwt) is [^\s,;&'\"]+", r"\1 is [REDACTED]"),
        ]
        
        redacted = msg
        for pat, repl in patterns:
            redacted = re.sub(pat, repl, redacted)
            
        return redacted
