# tests/test_watchlist_repository.py
"""
Tests for WatchlistRepository - Phase 19D.

Uses a temporary in-memory SQLite database.
No network calls. No real trades.db. No credentials.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.database import Base
from backend.db.repositories.watchlist_repository import (
    WatchlistRepository,
    WATCHLIST_ITEM_CAP,
    DEFAULT_WATCHLIST_NAME,
)


@pytest.fixture
def temp_db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def repo():
    return WatchlistRepository()


# ------------------------------------------------------------------
# 1. Create default watchlist
# ------------------------------------------------------------------

def test_get_or_create_default_watchlist(repo, temp_db_session):
    wl = repo.get_or_create_default_watchlist(temp_db_session)
    assert wl is not None
    assert wl.id is not None
    assert wl.name == DEFAULT_WATCHLIST_NAME
    assert wl.user_id == "default"


def test_get_or_create_default_watchlist_is_idempotent(repo, temp_db_session):
    wl1 = repo.get_or_create_default_watchlist(temp_db_session)
    wl2 = repo.get_or_create_default_watchlist(temp_db_session)
    assert wl1.id == wl2.id  # Same watchlist returned on second call


# ------------------------------------------------------------------
# 2. List watchlists for default user
# ------------------------------------------------------------------

def test_list_watchlists_returns_created(repo, temp_db_session):
    repo.create_watchlist(temp_db_session, name="My WL", user_id="default")
    repo.create_watchlist(temp_db_session, name="Watch 2", user_id="default")
    watchlists = repo.list_watchlists(temp_db_session, user_id="default")
    assert len(watchlists) == 2
    names = {wl.name for wl in watchlists}
    assert "My WL" in names
    assert "Watch 2" in names


def test_list_watchlists_scoped_to_user(repo, temp_db_session):
    repo.create_watchlist(temp_db_session, name="User A List", user_id="userA")
    repo.create_watchlist(temp_db_session, name="User B List", user_id="userB")
    result_a = repo.list_watchlists(temp_db_session, user_id="userA")
    result_b = repo.list_watchlists(temp_db_session, user_id="userB")
    assert len(result_a) == 1
    assert result_a[0].name == "User A List"
    assert len(result_b) == 1
    assert result_b[0].name == "User B List"


# ------------------------------------------------------------------
# 3. Add symbol to watchlist
# ------------------------------------------------------------------

def test_add_symbol_to_watchlist(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="Test WL")
    item, status = repo.add_symbol(temp_db_session, wl.id, "SBIN")
    assert status == "added"
    assert item is not None
    assert item.symbol == "SBIN"
    assert item.watchlist_id == wl.id


def test_add_symbol_normalizes_eq_suffix(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="Test WL 2")
    item, status = repo.add_symbol(temp_db_session, wl.id, "SBIN-EQ")
    assert status == "added"
    assert item.symbol == "SBIN"  # -EQ stripped


def test_add_symbol_sets_exchange_uppercase(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="EXC WL")
    item, status = repo.add_symbol(temp_db_session, wl.id, "RELIANCE", exchange="nse")
    assert status == "added"
    assert item.exch_seg == "NSE"


# ------------------------------------------------------------------
# 4. Duplicate symbol does not duplicate rows
# ------------------------------------------------------------------

def test_add_duplicate_symbol_returns_duplicate_status(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="Dup WL")
    _, first_status = repo.add_symbol(temp_db_session, wl.id, "INFY")
    _, second_status = repo.add_symbol(temp_db_session, wl.id, "INFY")
    assert first_status == "added"
    assert second_status == "duplicate"
    assert repo.count_items(temp_db_session, wl.id) == 1


def test_add_duplicate_with_eq_suffix_is_deduplicated(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="EQ Dup WL")
    repo.add_symbol(temp_db_session, wl.id, "RELIANCE")
    _, status = repo.add_symbol(temp_db_session, wl.id, "RELIANCE-EQ")
    assert status == "duplicate"
    assert repo.count_items(temp_db_session, wl.id) == 1


# ------------------------------------------------------------------
# 5. Remove symbol from watchlist
# ------------------------------------------------------------------

def test_remove_symbol_from_watchlist(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="Remove WL")
    repo.add_symbol(temp_db_session, wl.id, "TCS")
    removed = repo.remove_symbol(temp_db_session, wl.id, "TCS")
    assert removed is True
    assert repo.count_items(temp_db_session, wl.id) == 0


def test_remove_nonexistent_symbol_returns_false(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="No Remove WL")
    removed = repo.remove_symbol(temp_db_session, wl.id, "NONEXISTENT")
    assert removed is False


def test_remove_symbol_with_eq_suffix(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="EQ Remove WL")
    repo.add_symbol(temp_db_session, wl.id, "WIPRO")
    removed = repo.remove_symbol(temp_db_session, wl.id, "WIPRO-EQ")
    assert removed is True
    assert repo.count_items(temp_db_session, wl.id) == 0


# ------------------------------------------------------------------
# 6. Rename watchlist
# ------------------------------------------------------------------

def test_rename_watchlist(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="Old Name")
    renamed = repo.rename_watchlist(temp_db_session, wl.id, "New Name")
    assert renamed is not None
    assert renamed.name == "New Name"


def test_rename_nonexistent_watchlist_returns_none(repo, temp_db_session):
    result = repo.rename_watchlist(temp_db_session, watchlist_id=9999, new_name="Ghost")
    assert result is None


# ------------------------------------------------------------------
# 7. Delete watchlist cascades items
# ------------------------------------------------------------------

def test_delete_watchlist_cascades_items(repo, temp_db_session):
    from backend.db.models import WatchlistItem
    wl = repo.create_watchlist(temp_db_session, name="Del WL")
    repo.add_symbol(temp_db_session, wl.id, "HDFCBANK")
    repo.add_symbol(temp_db_session, wl.id, "ICICIBANK")
    assert repo.count_items(temp_db_session, wl.id) == 2

    wl_id = wl.id
    deleted = repo.delete_watchlist(temp_db_session, wl.id)
    assert deleted is True

    # Items should be gone via cascade
    remaining = temp_db_session.query(WatchlistItem).filter_by(watchlist_id=wl_id).all()
    assert len(remaining) == 0


def test_delete_nonexistent_watchlist_returns_false(repo, temp_db_session):
    deleted = repo.delete_watchlist(temp_db_session, watchlist_id=9999)
    assert deleted is False


# ------------------------------------------------------------------
# 8. Item cap enforced at 100
# ------------------------------------------------------------------

def test_item_cap_enforced(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="Cap WL")
    # Add WATCHLIST_ITEM_CAP items
    for i in range(WATCHLIST_ITEM_CAP):
        _, status = repo.add_symbol(temp_db_session, wl.id, f"SYM{i:04d}", token=str(i))
        assert status == "added"

    # Adding one more should be rejected
    _, status = repo.add_symbol(temp_db_session, wl.id, "OVERFLOW")
    assert status == "cap_exceeded"
    assert repo.count_items(temp_db_session, wl.id) == WATCHLIST_ITEM_CAP


# ------------------------------------------------------------------
# 9. List items
# ------------------------------------------------------------------

def test_list_items_returns_all(repo, temp_db_session):
    wl = repo.create_watchlist(temp_db_session, name="List WL")
    repo.add_symbol(temp_db_session, wl.id, "SBIN")
    repo.add_symbol(temp_db_session, wl.id, "TCS")
    repo.add_symbol(temp_db_session, wl.id, "INFY")
    items = repo.list_items(temp_db_session, wl.id)
    assert len(items) == 3
    symbols = {item.symbol for item in items}
    assert symbols == {"SBIN", "TCS", "INFY"}


def test_list_items_for_nonexistent_watchlist_returns_empty(repo, temp_db_session):
    items = repo.list_items(temp_db_session, watchlist_id=9999)
    assert items == []


# ------------------------------------------------------------------
# 10. add_symbol on non-existent watchlist returns not_found
# ------------------------------------------------------------------

def test_add_symbol_to_nonexistent_watchlist(repo, temp_db_session):
    item, status = repo.add_symbol(temp_db_session, watchlist_id=9999, symbol="SBIN")
    assert status == "not_found"
    assert item is None
