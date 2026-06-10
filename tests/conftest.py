import os
import sys
import pytest
from pathlib import Path

# These must be set BEFORE any backend imports so that config validation
# at startup accepts them. Tests need at least 32 chars and must not start
# with "admin"/"test" (validated by config_validation.validate_security_config).
os.environ.setdefault("ADMIN_TOKEN", "ci-test-admin-token-do-not-use-in-prod")
os.environ.setdefault("JWT_SECRET_KEY", "x" * 40)
os.environ.setdefault("ENVIRONMENT", "DEVELOPMENT")
os.environ.setdefault("TRADING_MODE", "PAPER")
os.environ.setdefault("LIVE_TRADING_ENABLED", "false")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")
os.environ.setdefault("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("MAX_ORDER_QTY", "1000")
os.environ.setdefault("MAX_ORDER_NOTIONAL", "100000")
os.environ.setdefault("SYMBOLS", '["NIFTY","SBIN"]')
os.environ.setdefault("DATABASE_URL", "sqlite:///./ci_test.db")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

@pytest.fixture(autouse=True)
def configure_test_environment(request, monkeypatch):
    # Isolate unit tests from registry database queries by default
    from backend.gateway import instrument_registry
    from backend.core.rate_limit import limiter
    from backend.core.config import settings

    limiter.enabled = False
    # These are already set via env vars above; refresh in case settings was
    # reloaded by another test.
    monkeypatch.setattr(settings, "admin_token", "ci-test-admin-token-do-not-use-in-prod")
    monkeypatch.setattr(settings, "jwt_secret_key", "x" * 40)

    module_name = request.module.__name__
    if "test_instrument_master_db" in module_name:
        instrument_registry._db_disabled = False
    else:
        instrument_registry._db_disabled = True
    yield
