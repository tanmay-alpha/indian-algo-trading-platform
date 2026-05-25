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
                    avg_fill_price REAL,
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
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS order_fills (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fill_id TEXT UNIQUE NOT NULL,
                    request_id TEXT NOT NULL,
                    broker_order_id TEXT,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    filled_quantity INTEGER NOT NULL,
                    fill_price REAL NOT NULL,
                    fees REAL DEFAULT 0,
                    source TEXT DEFAULT 'paper',
                    created_at TEXT NOT NULL
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def _migrate_schema(self) -> None:
        """
        Safe schema migration for existing databases that lack the new columns/tables.
        Uses PRAGMA table_info and sqlite_master to check before adding.
        Never drops existing data.

        Note: for :memory: databases, each _get_conn() call returns a fresh empty
        connection, so _init_db already creates the full schema.  We guard every
        ALTER TABLE with an existence check so this method is a no-op on fresh DBs.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()

            # Check whether order_requests exists before trying to migrate it
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='order_requests'"
            )
            if cursor.fetchone() is not None:
                # Migrate order_requests table — add columns introduced after initial schema
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

            # Check whether order_events exists before trying to migrate it
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='order_events'"
            )
            if cursor.fetchone() is not None:
                cursor.execute("PRAGMA table_info(order_events)")
                existing_event_cols = {row[1] for row in cursor.fetchall()}
                if "broker_order_id" not in existing_event_cols:
                    cursor.execute("ALTER TABLE order_events ADD COLUMN broker_order_id TEXT")
                    logger.info("OrderStore migration: added column 'broker_order_id' to order_events")

            # Create order_fills table if missing (legacy DBs that predate Phase 18I)
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='order_fills'"
            )
            if cursor.fetchone() is None:
                cursor.execute("""
                    CREATE TABLE order_fills (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        fill_id TEXT UNIQUE NOT NULL,
                        request_id TEXT NOT NULL,
                        broker_order_id TEXT,
                        symbol TEXT NOT NULL,
                        side TEXT NOT NULL,
                        filled_quantity INTEGER NOT NULL,
                        fill_price REAL NOT NULL,
                        fees REAL DEFAULT 0,
                        source TEXT DEFAULT 'paper',
                        created_at TEXT NOT NULL
                    )
                """)
                logger.info("OrderStore migration: created order_fills table")

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
    # ------------------------------------------------------------------
    # Admin / Operational Read Methods (Phase 18J)
    # ------------------------------------------------------------------

    def get_recent_order_requests(self, limit: int = 50) -> list:
        """Return the most recent *limit* order_requests rows, newest first.

        Safe for admin API: no credentials. Max limit capped at 200.
        """
        limit = min(max(1, int(limit)), 200)
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_requests ORDER BY id DESC LIMIT ?", (limit,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_recent_order_events(self, limit: int = 100) -> list:
        """Return the most recent *limit* order_events rows, newest first.

        Safe for admin API: no credentials. Max limit capped at 200.
        """
        limit = min(max(1, int(limit)), 200)
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_events ORDER BY id DESC LIMIT ?", (limit,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_recent_fills(self, limit: int = 100) -> list:
        """Return the most recent *limit* fill rows from order_fills, newest first.

        Safe for admin API: no credentials. Max limit capped at 200.
        """
        limit = min(max(1, int(limit)), 200)
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_fills ORDER BY id DESC LIMIT ?", (limit,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_order_audit(self, request_id: str) -> dict:
        """Return a full audit bundle for *request_id*: order row + events + fills.

        Returns empty dicts/lists when request_id is unknown — never raises.
        Safe for admin API: no credentials.
        """
        if not request_id:
            return {"order": None, "events": [], "fills": [], "request_id": ""}
        order = self.get_order_request(request_id)
        events = self.get_order_events(request_id)
        fills = self.get_fills_for_request(request_id)
        return {
            "request_id": request_id,
            "order": order,
            "events": events,
            "fills": fills,
        }

    def get_oms_summary(self) -> dict:
        """Return aggregate OMS statistics for the /oms/status endpoint.

        Fields:
          total_orders, active_orders, terminal_orders, filled_orders,
          rejected_orders, partial_fill_count (orders with >0 but not FILLED),
          fill_count, latest_order_at, latest_fill_at.

        Never returns credentials. Safe for sanitize_response().
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()

            # Total order count
            cursor.execute("SELECT COUNT(*) FROM order_requests")
            total_orders = cursor.fetchone()[0] or 0

            # Active (non-terminal) orders
            placeholders = ",".join("?" * len(TERMINAL_ORDER_STATUSES))
            cursor.execute(
                f"SELECT COUNT(*) FROM order_requests WHERE status NOT IN ({placeholders})",
                tuple(TERMINAL_ORDER_STATUSES),
            )
            active_orders = cursor.fetchone()[0] or 0

            # Terminal orders
            cursor.execute(
                f"SELECT COUNT(*) FROM order_requests WHERE status IN ({placeholders})",
                tuple(TERMINAL_ORDER_STATUSES),
            )
            terminal_orders = cursor.fetchone()[0] or 0

            # FILLED orders
            cursor.execute("SELECT COUNT(*) FROM order_requests WHERE status = 'FILLED'")
            filled_orders = cursor.fetchone()[0] or 0

            # REJECTED orders (all reject variants)
            cursor.execute(
                "SELECT COUNT(*) FROM order_requests WHERE status LIKE '%REJECT%'"
            )
            rejected_orders = cursor.fetchone()[0] or 0

            # Orders that have at least one fill but are NOT in FILLED terminal state
            # (i.e. partially filled and still active)
            cursor.execute(
                """
                SELECT COUNT(DISTINCT request_id) FROM order_fills
                WHERE request_id NOT IN (
                    SELECT request_id FROM order_requests WHERE status = 'FILLED'
                )
                """
            )
            partial_fill_count = cursor.fetchone()[0] or 0

            # Total fill records
            cursor.execute("SELECT COUNT(*) FROM order_fills")
            fill_count = cursor.fetchone()[0] or 0

            # Latest timestamps
            cursor.execute("SELECT MAX(created_at) FROM order_requests")
            latest_order_at = cursor.fetchone()[0]

            cursor.execute("SELECT MAX(created_at) FROM order_fills")
            latest_fill_at = cursor.fetchone()[0]

            return {
                "total_orders": total_orders,
                "active_orders": active_orders,
                "terminal_orders": terminal_orders,
                "filled_orders": filled_orders,
                "rejected_orders": rejected_orders,
                "partial_fill_count": partial_fill_count,
                "fill_count": fill_count,
                "latest_order_at": latest_order_at,
                "latest_fill_at": latest_fill_at,
            }
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Fill Ledger -- order_fills table
    # ------------------------------------------------------------------


    def record_fill(
        self,
        fill_id: str,
        request_id: str,
        symbol: str,
        side: str,
        filled_quantity: int,
        fill_price: float,
        broker_order_id=None,
        fees: float = 0.0,
        source: str = "paper",
    ) -> bool:
        """Insert a fill row into order_fills.

        Returns True if inserted, False if duplicate fill_id (idempotent).
        Validation: fill_id, request_id non-empty; filled_quantity > 0; fill_price > 0.
        Does NOT store credentials, tokens, or broker API secrets.
        """
        if not fill_id or not isinstance(fill_id, str):
            logger.warning("record_fill: fill_id missing or invalid -- rejected.")
            return False
        if not request_id or not isinstance(request_id, str):
            logger.warning("record_fill: request_id missing or invalid -- rejected.")
            return False
        try:
            filled_quantity = int(filled_quantity)
        except (TypeError, ValueError):
            logger.warning(f"record_fill: invalid filled_quantity for {fill_id} -- rejected.")
            return False
        if filled_quantity <= 0:
            logger.warning(f"record_fill: filled_quantity <= 0 for {fill_id} -- rejected.")
            return False
        try:
            fill_price = float(fill_price)
        except (TypeError, ValueError):
            logger.warning(f"record_fill: invalid fill_price for {fill_id} -- rejected.")
            return False
        if fill_price <= 0:
            logger.warning(f"record_fill: fill_price <= 0 for {fill_id} -- rejected.")
            return False

        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_conn()
        try:
            conn.execute(
                """
                INSERT INTO order_fills
                    (fill_id, request_id, broker_order_id, symbol, side,
                     filled_quantity, fill_price, fees, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    fill_id,
                    request_id,
                    broker_order_id,
                    symbol.upper(),
                    side.upper(),
                    filled_quantity,
                    fill_price,
                    float(fees),
                    source,
                    now,
                ),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        except Exception as exc:
            logger.warning(f"record_fill: unexpected error for {fill_id}: {exc.__class__.__name__}")
            return False
        finally:
            conn.close()

    def fill_exists(self, fill_id: str) -> bool:
        """Return True if a fill with the given fill_id already exists."""
        if not fill_id:
            return False
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM order_fills WHERE fill_id = ?", (fill_id,))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def get_fills_for_request(self, request_id: str) -> list:
        """Return all fill rows for a given request_id, oldest first."""
        if not request_id:
            return []
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM order_fills WHERE request_id = ? ORDER BY id ASC",
                (request_id,),
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_all_fills_chronological(self) -> list:
        """Return ALL fill rows ordered chronologically (oldest first).

        Primary source for portfolio rebuild. Does NOT return credentials.
        """
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM order_fills ORDER BY id ASC")
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_cumulative_filled_quantity(self, request_id: str) -> int:
        """Return sum of filled_quantity across all fills for a request_id.

        Used for delta-fill detection. Returns 0 if no fills exist yet.
        """
        if not request_id:
            return 0
        conn = self._get_conn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COALESCE(SUM(filled_quantity), 0) FROM order_fills WHERE request_id = ?",
                (request_id,),
            )
            row = cursor.fetchone()
            return int(row[0]) if row else 0
        finally:
            conn.close()
