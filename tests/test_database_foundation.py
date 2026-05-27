# tests/test_database_foundation.py

import os
import tempfile
from pathlib import Path
from backend.core.config import Settings
from backend.core.database import (
    get_database_url,
    create_engine_safe,
    get_session_factory,
    init_db_metadata,
    Base
)
from backend.db.models import (
    Instrument,
    Watchlist,
    WatchlistItem,
    OrderRequestModel,
    OrderEventModel,
    OrderFillModel,
    AuditLog
)
from backend.execution.order_store import OrderStore

def test_backend_imports_without_database_url():
    # Verify that the modules can be imported without DATABASE_URL or active connections
    import backend.core.database as db
    import backend.db.models as models
    assert db.Base is not None
    assert models.Instrument is not None

from unittest.mock import patch

def test_config_accepts_fields():
    # Test setting custom DB config options with isolated sources
    with patch.object(Settings, "settings_customise_sources", classmethod(lambda cls, settings_cls, **kwargs: (kwargs["init_settings"],))):
        cfg = Settings(
            angel_api_key="mock",
            ANGEL_CLIENT_ID="mock",
            angel_password="mock",
            angel_totp_secret="mock",
            database_url="postgresql://user:pass@host:5432/dbname",
            database_echo=True,
            database_pool_size=10,
            database_backend="postgres"
        )
        assert cfg.database_url == "postgresql://user:pass@host:5432/dbname"
        assert cfg.database_echo is True
        assert cfg.database_pool_size == 10
        assert cfg.inferred_database_backend == "postgres"

def test_config_inferred_backend():
    # Test inferred backend database type with isolated sources
    with patch.object(Settings, "settings_customise_sources", classmethod(lambda cls, settings_cls, **kwargs: (kwargs["init_settings"],))):
        cfg_sqlite = Settings(
            angel_api_key="mock",
            ANGEL_CLIENT_ID="mock",
            angel_password="mock",
            angel_totp_secret="mock",
            database_url=None,
            database_backend=None
        )
        assert cfg_sqlite.inferred_database_backend == "sqlite"

        cfg_postgres_inferred = Settings(
            angel_api_key="mock",
            ANGEL_CLIENT_ID="mock",
            angel_password="mock",
            angel_totp_secret="mock",
            database_url="postgresql://user@host/db"
        )
        assert cfg_postgres_inferred.inferred_database_backend == "postgres"


def test_database_url_fallback():
    from backend.core.config import settings
    orig_url = settings.database_url
    orig_path = settings.db_path
    try:
        settings.database_url = None
        settings.db_path = ":memory:"
        assert get_database_url() == "sqlite:///:memory:"

        settings.db_path = "temp_dir/temp_db.db"
        assert get_database_url() == "sqlite:///temp_dir/temp_db.db"
    finally:
        settings.database_url = orig_url
        settings.db_path = orig_path

def test_create_engine_safe_directory_creation():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "nested_dir" / "test.db"
        url = f"sqlite:///{db_file}"
        
        # Directory nested_dir should not exist yet
        assert not db_file.parent.exists()
        
        engine = create_engine_safe(url=url)
        
        # create_engine_safe should have created the parent directory
        assert db_file.parent.exists()
        assert db_file.parent.is_dir()

def test_sqlalchemy_metadata_contains_tables():
    expected_tables = {
        "instruments",
        "watchlists",
        "watchlist_items",
        "order_requests",
        "order_events",
        "order_fills",
        "audit_logs"
    }
    metadata_tables = set(Base.metadata.tables.keys())
    for t in expected_tables:
        assert t in metadata_tables

def test_db_lifecycle_sqlite_memory():
    engine = create_engine_safe("sqlite:///:memory:")
    init_db_metadata(engine)
    
    Session = get_session_factory(engine)
    session = Session()
    
    try:
        # Create a sample instrument
        inst = Instrument(
            token="NSE_EQ_3045",
            symbol="SBIN",
            name="STATE BANK OF INDIA",
            lotsize=1,
            tick_size=0.05
        )
        session.add(inst)
        session.commit()
        
        fetched = session.query(Instrument).filter_by(token="NSE_EQ_3045").first()
        assert fetched is not None
        assert fetched.symbol == "SBIN"
        
        # Test cascade on watchlist
        wl = Watchlist(name="TestWatchlist")
        session.add(wl)
        session.commit()
        
        wl_item = WatchlistItem(watchlist_id=wl.id, token="123", symbol="INFY")
        session.add(wl_item)
        session.commit()
        
        assert len(wl.items) == 1
        assert wl.items[0].symbol == "INFY"
        
        session.delete(wl)
        session.commit()
        
        # WatchlistItem should have been deleted due to CASCADE
        assert session.query(WatchlistItem).filter_by(watchlist_id=wl.id).count() == 0
    finally:
        session.close()

def test_order_store_still_works():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_order_store.db")
        store = OrderStore(db_path=db_path)
        
        # Verify basic operations of existing OrderStore work fine
        res = store.add_order_request(
            request_id="req_123",
            client_order_id="client_123",
            idempotency_key="idem_123",
            symbol="SBIN",
            side="BUY",
            quantity=10,
            order_type="LIMIT",
            mode="PAPER",
            status="OPEN"
        )
        assert res is True
        
        order = store.get_order_request("req_123")
        assert order is not None
        assert order["status"] == "OPEN"
        assert order["symbol"] == "SBIN"


def test_postgres_url_conversion():
    from unittest.mock import patch
    from backend.core.config import settings
    orig_url = settings.database_url
    try:
        settings.database_url = "postgres://username:secret_pass@host:5432/dbname"
        assert get_database_url() == "postgresql://username:secret_pass@host:5432/dbname"
    finally:
        settings.database_url = orig_url


def test_redact_db_url():
    from backend.core.database import redact_db_url
    # Test typical postgres URL with username/password
    url1 = "postgresql://scott:tiger_password@localhost:5432/mydatabase"
    assert redact_db_url(url1) == "postgresql://scott:***@localhost:5432/mydatabase"
    
    # Test sqlite URL with no password
    url2 = "sqlite:///data/trades.db"
    assert redact_db_url(url2) == "sqlite:///data/trades.db"
    
    # Test invalid inputs and exceptions
    assert redact_db_url(None) == ""
    assert redact_db_url("") == ""


def test_sanitize_db_error():
    from backend.core.database import sanitize_db_error
    raw_url = "postgresql://scott:tiger_password@localhost:5432/mydatabase"
    
    # Error message contains raw url
    msg1 = f"connection to {raw_url} failed"
    sanitized1 = sanitize_db_error(msg1, raw_url)
    assert "tiger_password" not in sanitized1
    assert "scott:***" in sanitized1
    
    # Error message contains password explicitly
    msg2 = "FATAL: password authentication failed for tiger_password"
    sanitized2 = sanitize_db_error(msg2, raw_url)
    assert "tiger_password" not in sanitized2
    
    # Generic sensitive terms redaction
    msg3 = "An error occurred with API_KEY in database"
    sanitized3 = sanitize_db_error(msg3)
    assert sanitized3 == "Database connection error (credentials/sensitive info redacted)"


def test_create_engine_poolclass_nullpool():
    from sqlalchemy.pool import NullPool
    # When NullPool is passed, pool_size should not be set (which would raise TypeError)
    engine = create_engine_safe("sqlite:///:memory:", poolclass=NullPool)
    assert isinstance(engine.pool, NullPool)


def test_check_db_health_success_and_failure():
    from unittest.mock import MagicMock
    from backend.core.database import check_db_health
    
    # Mock successful connection
    mock_engine = MagicMock()
    conn_mock = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = conn_mock
    
    ok, err = check_db_health(mock_engine)
    assert ok is True
    assert err is None
    
    # Mock failed connection with sensitive info
    mock_engine.connect.side_effect = Exception("failed to connect with password=secret123")
    mock_engine.url = "postgresql://scott:secret123@localhost:5432/mydatabase"
    
    ok, err = check_db_health(mock_engine)
    assert ok is False
    assert "secret123" not in err
    assert "redacted" in err.lower() or "scott:***" in err


def test_sanitize_response_redacts_db_url():
    from backend.core.security import sanitize_response
    data = {
        "database_url": "postgresql://scott:tiger_password@localhost:5432/mydatabase",
        "nested": {
            "conn_str": "postgresql://admin:secret@host:5432/db",
            "url_in_value": "postgresql://user:pass@host/db",
            "other_url": "https://example.com/api"
        },
        "database_url_configured": True
    }
    sanitized = sanitize_response(data)
    assert sanitized["database_url"] == "postgresql://scott:***@localhost:5432/mydatabase"
    assert sanitized["nested"]["conn_str"] == "postgresql://admin:***@host:5432/db"
    assert sanitized["nested"]["url_in_value"] == "postgresql://user:***@host/db"
    assert sanitized["nested"]["other_url"] == "https://example.com/api"
    assert sanitized["database_url_configured"] is True


def test_sanitize_response_url_in_nested_lists():
    from backend.core.security import sanitize_response
    data = {
        "list_of_urls": [
            "postgresql://scott:tiger_password@localhost:5432/mydatabase",
            "sqlite:///some/path/to/db.sqlite",
            "just normal string"
        ]
    }
    sanitized = sanitize_response(data)
    assert sanitized["list_of_urls"][0] == "postgresql://scott:***@localhost:5432/mydatabase"
    assert sanitized["list_of_urls"][1] == "sqlite:///some/path/to/db.sqlite"
    assert sanitized["list_of_urls"][2] == "just normal string"


def test_redact_db_url_with_special_characters():
    from backend.core.database import redact_db_url
    # Special character in password like : or @
    url_special = "postgresql://user:p@s:s:w@rd@localhost:5432/dbname"
    # Wait, our regex expects: ^([a-zA-Z0-9+.-]+://)([^:/@]+):([^@/]+)(@.*)$
    # In user:p@s:s:w@rd@localhost, scheme is postgresql://
    # username is user
    # password is p@s:s:w@rd
    # remainder is @localhost:5432/dbname
    redacted = redact_db_url(url_special)
    assert "p@s:s:w@rd" not in redacted
    assert "user:***" in redacted

    # Also test URL-encoded version of special characters
    url_encoded = "postgresql://user:p%40ss%3Aw%40rd@localhost:5432/dbname"
    redacted_enc = redact_db_url(url_encoded)
    assert "p%40ss%3Aw%40rd" not in redacted_enc
    assert "user:***" in redacted_enc


def test_invalid_db_url_error_sanitization():
    from backend.core.database import sanitize_db_error
    raw_url = "postgresql://attacker_user:sensitive_password_123@invalid_host:5432/dbname"
    
    # Simulate ValueError or connection exception from SQLAlchemy/driver containing raw url/credentials
    # Use 'auth' instead of 'password' to test URL redaction path rather than generic sensitive terms fallback
    err_msg = f"OperationalError: (psycopg2.OperationalError) connection to server failed: FATAL: authentication failed for user 'attacker_user'\nURL was: {raw_url}"
    sanitized = sanitize_db_error(err_msg, raw_url)
    
    assert "sensitive_password_123" not in sanitized
    assert "attacker_user:***" in sanitized
    assert "attacker_user:sensitive_password_123" not in sanitized


def test_migration_command_failure_sanitization():
    # We can mock the migration failure to verify it gets sanitized correctly
    from backend.core.database import sanitize_db_error
    raw_url = "postgresql://migrator:mig_pass_abc@host:5432/db"
    
    # Exception containing password inside the trace
    try:
        raise ValueError(f"Alembic migration failed using database url {raw_url} due to timeout")
    except Exception as e:
        sanitized = sanitize_db_error(str(e), raw_url)
        
    assert "mig_pass_abc" not in sanitized
    assert "migrator:***" in sanitized


def test_create_engine_postgres_nullpool_bypasses_pool_size():
    from sqlalchemy.pool import NullPool
    from backend.core.database import create_engine_safe
    
    # Verify poolclass=NullPool with postgresql url does not crash with pool_size error
    engine = create_engine_safe("postgresql://user:pass@host:5432/db", poolclass=NullPool)
    assert isinstance(engine.pool, NullPool)
    # Check that pool_size is not in kwargs of engine creation / not set on engine
    assert getattr(engine.pool, "size", None) is None
