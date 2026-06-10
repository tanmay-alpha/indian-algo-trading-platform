import sys
import pytest
from pathlib import Path

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
    monkeypatch.setattr(settings, "admin_token", "test-admin-token")
    monkeypatch.setattr(
        settings,
        "jwt_secret_key",
        "x" * 40,
    )
    
    module_name = request.module.__name__
    if "test_instrument_master_db" in module_name:
        instrument_registry._db_disabled = False
    else:
        instrument_registry._db_disabled = True
    yield
