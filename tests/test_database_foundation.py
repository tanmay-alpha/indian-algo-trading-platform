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
