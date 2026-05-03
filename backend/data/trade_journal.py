from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiosqlite

from backend.core.config import settings
from backend.core.events import OrderStateEvent


class TradeJournal:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.db_path

    async def initialize(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE,
                    order_id TEXT,
                    broker_order_id TEXT,
                    signal_event_id TEXT,
                    strategy_name TEXT,
                    symbol TEXT,
                    side TEXT,
                    quantity INTEGER,
                    fill_price REAL,
                    turnover REAL,
                    brokerage REAL,
                    stt REAL,
                    exchange_charge REAL,
                    sebi_charge REAL,
                    stamp_duty REAL,
                    gst REAL,
                    total_fees REAL,
                    gross_pnl REAL,
                    net_pnl REAL,
                    trading_mode TEXT,
                    filled_at TEXT,
                    created_at TEXT
                )
                """
            )
            await db.commit()

    async def record_fill(
        self,
        order_event: OrderStateEvent,
        fees: dict,
        strategy_name: Optional[str],
        trading_mode: str,
    ) -> None:
        await self.initialize()
        fill_price = order_event.avg_fill_price or 0.0
        turnover = fees.get("turnover", fill_price * order_event.filled_quantity)
        now = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR IGNORE INTO trades (
                    event_id, order_id, broker_order_id, signal_event_id, strategy_name,
                    symbol, side, quantity, fill_price, turnover, brokerage, stt,
                    exchange_charge, sebi_charge, stamp_duty, gst, total_fees,
                    gross_pnl, net_pnl, trading_mode, filled_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_event.event_id,
                    order_event.order_id,
                    order_event.broker_order_id,
                    order_event.order_request_id,
                    strategy_name,
                    order_event.symbol,
                    order_event.side,
                    order_event.filled_quantity,
                    fill_price,
                    turnover,
                    fees.get("brokerage"),
                    fees.get("stt"),
                    fees.get("exchange_charge"),
                    fees.get("sebi_charge"),
                    fees.get("stamp_duty"),
                    fees.get("gst"),
                    fees.get("total_fees"),
                    None,
                    None,
                    trading_mode,
                    order_event.occurred_at.isoformat(),
                    now,
                ),
            )
            await db.commit()

    async def update_pnl(self, order_id: str, gross_pnl: float, net_pnl: float) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE trades SET gross_pnl = ?, net_pnl = ? WHERE order_id = ?",
                (gross_pnl, net_pnl, order_id),
            )
            await db.commit()

    async def get_today_summary(self) -> dict:
        today = datetime.now(timezone.utc).date().isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT COUNT(*) AS trades, COALESCE(SUM(total_fees), 0) AS total_fees,
                       COALESCE(SUM(gross_pnl), 0) AS gross_pnl,
                       COALESCE(SUM(net_pnl), 0) AS net_pnl
                FROM trades WHERE substr(filled_at, 1, 10) = ?
                """,
                (today,),
            )
            row = await cursor.fetchone()
        return dict(row) if row else {"trades": 0, "total_fees": 0, "gross_pnl": 0, "net_pnl": 0}

    async def get_recent_trades(self, limit: int = 50) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM trades ORDER BY id DESC LIMIT ?",
                (max(1, min(limit, 500)),),
            )
            rows = await cursor.fetchall()
        return [dict(row) for row in rows]
