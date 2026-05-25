import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from loguru import logger


# -----------------------------------------------------------------------
# Terminal status constants — centralised here so OrderStateMachine and
# ExecutionRouter can import from a single authoritative source.
# -----------------------------------------------------------------------

TERMINAL_ORDER_STATUSES: frozenset[str] = frozenset({
    "FILLED",
    "REJECTED",
    "CANCELLED",
    "RISK_REJECTED",
    "DUPLICATE_REJECTED",
})

# Keep private alias for internal use inside this module.
_TERMINAL_STATUSES = TERMINAL_ORDER_STATUSES


def is_terminal_order_status(status: str) -> bool:
    """Return True if *status* represents a final, non-recoverable order state.

    Terminal statuses:
        FILLED, REJECTED, CANCELLED, RISK_REJECTED, DUPLICATE_REJECTED

    Active / non-terminal statuses (examples):
        RECEIVED, PENDING, OPEN, RISK_APPROVED, ROUTED_TO_PAPER, ROUTED_TO_LIVE
    """
    return status in TERMINAL_ORDER_STATUSES


class OrderStore:
    def __init__(self, db_path: str = "data/trades.db"):
        self.db_path = db_path
        # Ensure parent directory exists
        if self.db_path != ":memory:":
            Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._migrate_schema()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Create tables if they do not exist (fresh DB)."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS order_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT UNIQUE,
                    client_order_id TEXT,
                    idempotency_key TEXT UNIQUE,
                    symbol TEXT,
                    side TEXT,
                    quantity INTEGER,
                    order_type TEXT,
                    mode TEXT,
                    status TEXT,
                    broker_order_id TEXT,
                    reject_reason TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS order_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT,
                    event_type TEXT,
                    status TEXT,
                    reason TEXT,
                    broker_order_id TEXT,
                    created_at TEXT
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def _migrate_schema(self) -> None:
        """
        Safe schema migration for existing databases that lack the new columns.
        Uses PRAGMA table_info to check columns and ALTER TABLE ADD COLUMN if missing.
        Never drops existing data.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()

            # Migrate order_requests table
            cursor.execute("PRAGMA table_info(order_requests)")
            existing_cols = {row[1] for row in cursor.fetchall()}

            for col, col_def in [
                ("broker_order_id", "TEXT"),
                ("reject_reason", "TEXT"),
                ("avg_fill_price", "REAL"),
            ]:
                if col not in existing_cols:
                    cursor.execute(f"ALTER TABLE order_requests ADD COLUMN {col} {col_def}")
                    logger.info(f"OrderStore migration: added column '{col}' to order_requests")

            # Migrate order_events table
            cursor.execute("PRAGMA table_info(order_events)")
            existing_event_cols = {row[1] for row in cursor.fetchall()}
            if "broker_order_id" not in existing_event_cols:
                cursor.execute("ALTER TABLE order_events ADD COLUMN broker_order_id TEXT")
                logger.info("OrderStore migration: added column 'broker_order_id' to order_events")

            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Write / Insert
    # ------------------------------------------------------------------

    def add_order_request(
        self,
        request_id: str,
        client_order_id: str,
        idempotency_key: str,
        symbol: str,
        side: str,
        quantity: int,
        order_type: str,
        mode: str,
        status: str,
        broker_order_id: Optional[str] = None,
    ) -> bool:
        """
        Inserts a new order request.
        Returns True if inserted, False if duplicate constraint violated.
        """
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO order_requests (
                    request_id, client_order_id, idempotency_key, symbol, side,
                    quantity, order_type, mode, status, broker_order_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request_id,
                    client_order_id,
                    idempotency_key,
                    symbol,
                    side,
                    quantity,
                    order_type,
                    mode,
                    status,
                    broker_order_id,
                    now,
                    now,
                ),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError as e:
            logger.warning(f"OrderStore integrity error on insert: {e}")
            return False
        finally:
            conn.close()

    def update_order_status(
        self,
        request_id: str,
        status: str,
        reason: Optional[str] = None,
        broker_order_id: Optional[str] = None,
        avg_fill_price: Optional[float] = None,
    ) -> None:
        """Update the status of an order request.

        Optionally stores a reject/cancel reason, persists broker_order_id,
        and stores avg_fill_price when the order has been filled.
        Does NOT overwrite existing broker_order_id when None is passed.
        """
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            if broker_order_id is not None and avg_fill_price is not None:
                cursor.execute(
                    """
                    UPDATE order_requests
                    SET status = ?, reject_reason = ?, broker_order_id = ?,
                        avg_fill_price = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (status, reason, broker_order_id, avg_fill_price, now, request_id),
                )
            elif broker_order_id is not None:
                cursor.execute(
                    """
                    UPDATE order_requests
                    SET status = ?, reject_reason = ?, broker_order_id = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (status, reason, broker_order_id, now, request_id),
                )
            elif avg_fill_price is not None:
                cursor.execute(
                    """
                    UPDATE order_requests
                    SET status = ?, reject_reason = ?, avg_fill_price = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (status, reason, avg_fill_price, now, request_id),
                )
            elif reason is not None:
                cursor.execute(
                    """
                    UPDATE order_requests
                    SET status = ?, reject_reason = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (status, reason, now, request_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE order_requests
                    SET status = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (status, now, request_id),
                )
            conn.commit()
        finally:
            conn.close()

    def update_broker_order_id(self, request_id: str, broker_order_id: str) -> None:
        """Persist the broker-assigned order identifier for a locally tracked request."""
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE order_requests
                SET broker_order_id = ?, updated_at = ?
                WHERE request_id = ?
                """,
                (broker_order_id, now, request_id),
            )
            conn.commit()
        finally:
            conn.close()

    def add_order_event(
        self,
        request_id: str,
        event_type: str,
        status: str,
        reason: Optional[str] = None,
        broker_order_id: Optional[str] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO order_events (request_id, event_type, status, reason, broker_order_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (request_id, event_type, status, reason, broker_order_id, now),
            )
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Read / Query
    # ------------------------------------------------------------------

    def get_order_request(self, request_id: str) -> Optional[dict]:
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM order_requests WHERE request_id = ?", (request_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_order_request_by_idempotency(self, idempotency_key: str) -> Optional[dict]:
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM order_requests WHERE idempotency_key = ?", (idempotency_key,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_order_by_broker_order_id(self, broker_order_id: str) -> Optional[dict]:
        """Look up a local order request by its broker-assigned identifier."""
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_requests WHERE broker_order_id = ?",
                (broker_order_id,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def check_duplicate(self, request_id: str, idempotency_key: str) -> bool:
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM order_requests WHERE request_id = ? OR idempotency_key = ?",
                (request_id, idempotency_key),
            )
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def get_order_events(self, request_id: str) -> list:
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_events WHERE request_id = ? ORDER BY id ASC",
                (request_id,),
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_recent_requests(self, limit: int = 50) -> list:
        limit = min(max(1, limit), 100)
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_requests ORDER BY id DESC LIMIT ?",
                (limit,),
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_filled_orders(self) -> list:
        """Return all FILLED order requests in chronological order (oldest first).

        Used by the portfolio rebuild service to replay executed fills into
        PortfolioEngine/PositionTracker on startup.

        Includes only rows with status == 'FILLED'.
        Excludes REJECTED, CANCELLED, RISK_REJECTED, DUPLICATE_REJECTED.
        Does NOT return credentials, tokens, or broker API keys.
        Fields returned: request_id, client_order_id, broker_order_id, symbol,
        side, quantity, order_type, mode, status, created_at, updated_at.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_requests WHERE status = 'FILLED' ORDER BY id ASC"
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_active_requests(self) -> list:
        """Return all non-terminal order requests ordered oldest-first.

        Used during startup recovery to reload active orders into the
        in-memory OrderStateMachine without losing state across restarts.
        Returns all fields including request_id, broker_order_id, symbol,
        side, quantity, order_type, mode, status, created_at, updated_at.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            placeholders = ",".join("?" * len(TERMINAL_ORDER_STATUSES))
            cursor.execute(
                f"SELECT * FROM order_requests WHERE status NOT IN ({placeholders}) ORDER BY id ASC",
                tuple(TERMINAL_ORDER_STATUSES),
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

