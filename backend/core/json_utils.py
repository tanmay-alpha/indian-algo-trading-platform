import math
from typing import Any


def json_safe(value: Any) -> Any:
    """
    Recursively convert values that are invalid in strict JSON responses.

    FastAPI can serialize Python NaN/Infinity by default in some paths, but
    browser clients and strict JSON tooling cannot rely on that. Keep response
    shapes unchanged and only replace non-finite floats with None.
    """
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    return value
