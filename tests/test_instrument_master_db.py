# tests/test_instrument_master_db.py

import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.core.database import Base
from backend.db.repositories.instrument_repository import InstrumentRepository
from backend.services.instrument_master_service import InstrumentMasterService
from backend.gateway.instrument_loader import InstrumentLoader
import backend.gateway.instrument_registry as registry

@pytest.fixture
def temp_db_session():
    # Setup temporary SQLite in-memory DB
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_repo_operations(temp_db_session):
    repo = InstrumentRepository()
    
    # Verify count initially 0
    assert repo.count(temp_db_session) == 0
    
    instruments = [
        {"token": "1001", "symbol": "TESTONE-EQ", "name": "Test Company One", "sector": "Technology", "exchange": "NSE"},
        {"token": "1002", "symbol": "TESTTWO-EQ", "name": "Test Company Two", "sector": "Finance", "exchange": "NSE"},
        {"token": "1003", "symbol": "TESTTHREE-EQ", "name": "Test Company Three", "sector": "Technology", "exchange": "NSE"},
    ]
    
    # Bulk upsert
    count = repo.bulk_upsert(temp_db_session, instruments)
    assert count == 3
    assert repo.count(temp_db_session) == 3
    
    # Retrieve by token
    inst = repo.get_by_token(temp_db_session, "1002")
    assert inst is not None
    assert inst.symbol == "TESTTWO-EQ"
    assert inst.sector == "FINANCE"
    
    # Retrieve by symbol (various formats)
    inst_sym1 = repo.get_by_symbol(temp_db_session, "TESTONE-EQ")
    assert inst_sym1 is not None
    assert inst_sym1.token == "1001"
    
    inst_sym2 = repo.get_by_symbol(temp_db_session, "TESTONE")
    assert inst_sym2 is not None
    assert inst_sym2.token == "1001"
    
    # Get unique sectors
    sectors = repo.get_sectors(temp_db_session)
    assert sectors == ["FINANCE", "TECHNOLOGY"]
    
    # Get by sector
    tech_insts = repo.get_by_sector(temp_db_session, "Technology")
    assert len(tech_insts) == 2
    assert tech_insts[0].symbol == "TESTONE-EQ"
    assert tech_insts[1].symbol == "TESTTHREE-EQ"
    
    # Search
    search_res = repo.search(temp_db_session, "Company", limit=2)
    assert len(search_res) == 2
    
    search_res_sector = repo.search(temp_db_session, "Finance", limit=5)
    assert len(search_res_sector) == 1
    assert search_res_sector[0].token == "1002"
    
    # Pagination
    paged, total = repo.list_paginated(temp_db_session, page=1, page_size=2)
    assert len(paged) == 2
    assert total == 3

@pytest.mark.asyncio
async def test_service_operations(temp_db_session):
    repo = InstrumentRepository()
    service = InstrumentMasterService(repository=repo)
    
    # Mock InstrumentLoader
    mock_loader = AsyncMock(spec=InstrumentLoader)
    mock_loader.load.return_value = [
        {"token": "2001", "symbol": "SERVONE-EQ", "name": "Service Company One", "sector": "Energy", "exchange": "NSE"},
        {"token": "2002", "symbol": "SERVTWO-EQ", "name": "Service Company Two", "sector": "Healthcare", "exchange": "NSE"},
    ]
    
    upserted = await service.download_and_ingest(temp_db_session, mock_loader)
    assert upserted == 2
    assert repo.count(temp_db_session) == 2
    
    inst = repo.get_by_token(temp_db_session, "2001")
    assert inst is not None
    assert inst.symbol == "SERVONE-EQ"
    assert inst.sector == "ENERGY"

def test_registry_database_integration_and_fallback(temp_db_session):
    # Populate the temp database
    repo = InstrumentRepository()
    instruments = [
        {"token": "9991", "symbol": "DBONLY-EQ", "name": "Database Only Corp", "sector": "Energy", "exchange": "NSE"},
        {"token": "9992", "symbol": "DBTWO-EQ", "name": "Database Company Two", "sector": "Finance", "exchange": "NSE"},
    ]
    repo.bulk_upsert(temp_db_session, instruments)
    
    # 1. Test Fallback when database query fails (e.g. session returns None or raises exception)
    with patch("backend.gateway.instrument_registry._get_db_session") as mock_session_getter:
        mock_session_getter.side_effect = Exception("DB Connection Locked")
        
        # Should fallback to registry default cache/fallback list
        res = registry.get_instrument("SBIN")
        assert res is not None
        assert res["token"] == "3045"
        
        sectors = registry.get_sectors()
        assert "Banking" in sectors or "BANKING" in [s.upper() for s in sectors]
        
        status = registry.registry_status()
        assert status["fallback_active"] is True
        assert status["source"] == "fallback"

    # 2. Test Integration when database is populated and active
    with patch("backend.gateway.instrument_registry._get_db_session") as mock_session_getter:
        # Return a lambda that returns our active temp session
        mock_session_getter.return_value = temp_db_session
        
        # Should return DB item instead of fallback
        res = registry.get_instrument("DBONLY")
        assert res is not None
        assert res["token"] == "9991"
        assert res["sector"] == "ENERGY"
        
        # Sector lookups
        sectors = registry.get_sectors()
        assert sectors == ["ENERGY", "FINANCE"]
        
        # Paginated listing
        paginated = registry.list_paginated(page=1, page_size=10)
        assert paginated["total"] == 2
        assert paginated["instruments"][0]["symbol"] == "DBONLY-EQ"
        
        # Search
        search_res = registry.search_symbols("DB", limit=10)
        assert len(search_res) == 2
        assert search_res[0]["symbol"] == "DBONLY-EQ"
        
        # Status
        status = registry.registry_status()
        assert status["loaded"] == 2
        assert status["source"] == "database"
        assert status["fallback_active"] is False
