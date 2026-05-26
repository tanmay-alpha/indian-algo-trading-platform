import os
import tempfile
import sqlite3
from pathlib import Path
import pytest
from unittest import mock

from alembic.config import Config
from alembic import command
from backend.core.database import Base
from backend.execution.order_store import OrderStore

ROOT = Path(__file__).resolve().parents[1]

def test_alembic_files_exist():
    assert (ROOT / "alembic.ini").exists()
    assert (ROOT / "migrations" / "env.py").exists()
    assert (ROOT / "migrations" / "script.py.mako").exists()
    assert (ROOT / "migrations" / "versions").exists()

def test_alembic_ini_no_secrets():
    ini_content = (ROOT / "alembic.ini").read_text()
    # Check that it doesn't contain a real postgres/mysql url or passwords
    assert "driver://user:pass" not in ini_content
    # It should contain the sqlite memory placeholder we added
    assert "sqlite:///:memory:" in ini_content

def test_env_py_imports_safely():
    # Verify we can import database and models safely without side-effects or executing alembic outside context
    import backend.core.database
    import backend.db.models
    assert backend.core.database.Base is not None

def test_migration_upgrade_and_table_matching():
    # Create a temporary SQLite database
    fd, temp_db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    
    temp_db_url = f"sqlite:///{temp_db_path}"
    
    try:
        # Configure Alembic to use the temporary database URL
        ini_path = ROOT / "alembic.ini"
        alembic_cfg = Config(str(ini_path))
        alembic_cfg.set_main_option("sqlalchemy.url", temp_db_url)
        
        # Run Alembic upgrade head
        command.upgrade(alembic_cfg, "head")
        
        # Verify tables created in the temp SQLite database using raw sqlite3 connection
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        # The expected tables from our models (including alembic_version)
        expected_tables = {
            "alembic_version",
            "instruments",
            "watchlists",
            "watchlist_items",
            "order_requests",
            "order_events",
            "order_fills",
            "audit_logs"
        }
        
        for table in expected_tables:
            assert table in tables, f"Expected table '{table}' was not created by migrations"
            
        # Verify SQLAlchemy metadata names match the tables we created
        metadata_tables = set(Base.metadata.tables.keys())
        for table in metadata_tables:
            assert table in tables, f"Table '{table}' defined in metadata was not created by migrations"
            
    finally:
        # Clean up temporary database
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

def test_api_server_import_no_alembic():
    # Make sure importing api_server doesn't run alembic migrations automatically
    with mock.patch("alembic.command.upgrade") as mock_upgrade:
        import backend.api_server
        mock_upgrade.assert_not_called()

def test_existing_order_store_works_independently():
    # Existing OrderStore uses its own sqlite3 queries and setup.
    # Verify it still initializes and runs without SQLAlchemy/Alembic interference.
    fd, temp_db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    
    try:
        store = OrderStore(db_path=temp_db_path)
        success = store.add_order_request(
            request_id="req-123",
            client_order_id="cl-123",
            idempotency_key="idem-123",
            symbol="SBIN-EQ",
            side="BUY",
            quantity=10,
            order_type="LIMIT",
            mode="paper",
            status="RECEIVED"
        )
        assert success is True
        
        req = store.get_order_request("req-123")
        assert req is not None
        assert req["symbol"] == "SBIN-EQ"
        assert req["quantity"] == 10
        
    finally:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)

