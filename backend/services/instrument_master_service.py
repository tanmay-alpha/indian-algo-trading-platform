# backend/services/instrument_master_service.py

import logging
from backend.db.repositories.instrument_repository import InstrumentRepository
from backend.gateway.instrument_loader import InstrumentLoader

logger = logging.getLogger(__name__)

class InstrumentMasterService:
    def __init__(self, repository: InstrumentRepository | None = None):
        self.repository = repository or InstrumentRepository()

    async def ingest_instruments(self, session, instruments: list[dict]) -> int:
        """Batch insert/upsert the provided list of normalized instruments."""
        if not instruments:
            logger.info("No instruments provided for database ingestion.")
            return 0
        
        logger.info("Ingesting %d instruments into the database...", len(instruments))
        count = self.repository.bulk_upsert(session, instruments)
        logger.info("Successfully ingested %d instruments into the database.", count)
        return count

    async def download_and_ingest(self, session, loader: InstrumentLoader) -> int:
        """Trigger instrument loader download/load and ingest results to database."""
        instruments = await loader.load()
        if not instruments:
            logger.warning("No instruments loaded from loader to ingest.")
            return 0
        return await self.ingest_instruments(session, instruments)
