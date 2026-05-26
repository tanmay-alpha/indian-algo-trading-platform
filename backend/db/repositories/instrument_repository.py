# backend/db/repositories/instrument_repository.py

from typing import Optional
from sqlalchemy import or_, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from backend.db.models import Instrument
from datetime import datetime, timezone

class InstrumentRepository:
    def bulk_upsert(self, session, instruments: list[dict]) -> int:
        if not instruments:
            return 0
            
        dialect = session.bind.dialect.name
        created_at_val = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        records = []
        for inst in instruments:
            records.append({
                "token": str(inst["token"]),
                "symbol": inst["symbol"],
                "name": inst.get("name") or "",
                "expiry": inst.get("expiry"),
                "strike": inst.get("strike"),
                "lotsize": inst.get("lot_size") or inst.get("lotsize") or 1,
                "instrumenttype": str(inst.get("instrument_type") or inst.get("instrumenttype") or "EQ").upper(),
                "exch_seg": str(inst.get("exch_seg") or inst.get("exchange") or "NSE").upper(),
                "tick_size": inst.get("tick_size") or 0.05,
                "sector": str(inst.get("sector") or "").strip().upper(),
                "created_at": created_at_val,
            })
            
        if dialect == "sqlite":
            stmt = sqlite_insert(Instrument)
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=[Instrument.token],
                set_={
                    "symbol": stmt.excluded.symbol,
                    "name": stmt.excluded.name,
                    "expiry": stmt.excluded.expiry,
                    "strike": stmt.excluded.strike,
                    "lotsize": stmt.excluded.lotsize,
                    "instrumenttype": stmt.excluded.instrumenttype,
                    "exch_seg": stmt.excluded.exch_seg,
                    "tick_size": stmt.excluded.tick_size,
                    "sector": stmt.excluded.sector,
                }
            )
            session.execute(upsert_stmt, records)
            session.commit()
            return len(records)
            
        elif dialect == "postgresql":
            stmt = pg_insert(Instrument)
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=[Instrument.token],
                set_={
                    "symbol": stmt.excluded.symbol,
                    "name": stmt.excluded.name,
                    "expiry": stmt.excluded.expiry,
                    "strike": stmt.excluded.strike,
                    "lotsize": stmt.excluded.lotsize,
                    "instrumenttype": stmt.excluded.instrumenttype,
                    "exch_seg": stmt.excluded.exch_seg,
                    "tick_size": stmt.excluded.tick_size,
                    "sector": stmt.excluded.sector,
                }
            )
            session.execute(upsert_stmt, records)
            session.commit()
            return len(records)
            
        else:
            count = 0
            for record in records:
                existing = session.query(Instrument).filter_by(token=record["token"]).first()
                if existing:
                    for k, v in record.items():
                        setattr(existing, k, v)
                else:
                    session.add(Instrument(**record))
                count += 1
            session.commit()
            return count

    def count(self, session) -> int:
        return session.query(func.count(Instrument.id)).scalar()

    def get_by_token(self, session, token: str) -> Optional[Instrument]:
        return session.query(Instrument).filter(Instrument.token == str(token)).first()

    def get_by_symbol(self, session, symbol: str) -> Optional[Instrument]:
        s = str(symbol).strip().upper()
        inst = session.query(Instrument).filter(Instrument.symbol == s).first()
        if inst:
            return inst
        
        if not s.endswith("-EQ"):
            inst = session.query(Instrument).filter(Instrument.symbol == f"{s}-EQ").first()
            if inst:
                return inst
        else:
            inst = session.query(Instrument).filter(Instrument.symbol == s[:-3]).first()
            if inst:
                return inst
        return None

    def get_sectors(self, session) -> list[str]:
        rows = session.query(Instrument.sector).distinct().all()
        sectors = sorted(list({r[0] for r in rows if r[0]}))
        return sectors

    def get_by_sector(self, session, sector: str) -> list[Instrument]:
        s = str(sector).strip().upper()
        return session.query(Instrument).filter(Instrument.sector == s).order_by(Instrument.symbol).all()

    def search(self, session, query: str, limit: int = 25) -> list[Instrument]:
        if not query:
            return []
        like_pattern = f"%{query}%"
        return session.query(Instrument).filter(
            or_(
                Instrument.symbol.ilike(like_pattern),
                Instrument.name.ilike(like_pattern),
                Instrument.sector.ilike(like_pattern)
            )
        ).limit(limit).all()

    def list_paginated(self, session, page: int = 1, page_size: int = 50) -> tuple[list[Instrument], int]:
        safe_page = max(page, 1)
        safe_page_size = min(max(page_size, 1), 200)
        total = self.count(session)
        offset = (safe_page - 1) * safe_page_size
        instruments = session.query(Instrument).order_by(Instrument.symbol).offset(offset).limit(safe_page_size).all()
        return instruments, total
