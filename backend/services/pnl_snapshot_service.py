import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from backend.services.broker_account_sync import BrokerAccountSyncService

logger = logging.getLogger(__name__)

class PnLSnapshotService:
    """
    Read-only service to calculate and record unrealized PnL
    based on broker positions and LTP.
    """
    def __init__(self, session_manager=None, sync_service=None):
        self._sm = session_manager
        self.sync_service = sync_service or BrokerAccountSyncService(session_manager=session_manager)
        self.pnl_dir = Path("data/pnl_history")

    def _ensure_pnl_dir(self):
        self.pnl_dir.mkdir(parents=True, exist_ok=True)

    def calculate_and_save_pnl_snapshot(self) -> Dict[str, Any]:
        self._ensure_pnl_dir()
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")

        # 1. Fetch positions
        positions_response = self.sync_service.get_positions()
        if positions_response.get("status") == "BROKER_SESSION_UNAVAILABLE":
            raise ValueError("BROKER_SESSION_UNAVAILABLE")
        if positions_response.get("status") == "BROKER_ERROR":
            raise ValueError("BROKER_ERROR")

        positions = positions_response.get("positions", [])

        # 2. Calculate PnL
        total_unrealized_pnl = 0.0
        total_realized_pnl = 0.0
        calculated_positions = []

        for pos in positions:
            symbol = pos.get("symbol") or "UNKNOWN"
            product = pos.get("product") or "UNKNOWN"
            exchange = pos.get("exchange") or "UNKNOWN"
            net_qty = pos.get("net_qty")
            avg_price = pos.get("avg_price")
            ltp = pos.get("ltp")
            broker_unrealized = pos.get("unrealised_pnl") or 0.0
            broker_realized = pos.get("realised_pnl") or 0.0

            # Calculate unrealized PnL: net_qty * (ltp - avg_price)
            if net_qty is not None and avg_price is not None and ltp is not None:
                calc_unrealized = float(net_qty) * (float(ltp) - float(avg_price))
            else:
                calc_unrealized = float(broker_unrealized)

            total_unrealized_pnl += calc_unrealized
            total_realized_pnl += float(broker_realized)

            calculated_positions.append({
                "symbol": symbol,
                "product": product,
                "exchange": exchange,
                "net_qty": net_qty,
                "avg_price": avg_price,
                "ltp": ltp,
                "calculated_unrealized_pnl": calc_unrealized,
                "broker_unrealized_pnl": broker_unrealized,
                "broker_realized_pnl": broker_realized
            })

        # 3. Create report
        report = {
            "timestamp": now.isoformat().replace("+00:00", "Z"),
            "total_unrealized_pnl": total_unrealized_pnl,
            "total_realized_pnl": total_realized_pnl,
            "positions": calculated_positions
        }

        # 4. Save snapshot file
        snapshot_file = self.pnl_dir / f"pnl_snapshot_{timestamp_str}.json"
        try:
            with open(snapshot_file, "w") as f:
                json.dump(report, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save PnL snapshot file: {e}", exc_info=True)

        # 5. Append to history list
        history_file = self.pnl_dir / "pnl_history.json"
        existing_history = []
        if history_file.exists():
            try:
                with open(history_file, "r") as f:
                    existing_history = json.load(f)
                    if not isinstance(existing_history, list):
                        existing_history = []
            except Exception as e:
                logger.warning(f"Failed to read PnL history file, starting fresh: {e}")

        # Keep history to a reasonable limit, say last 1000 calculations
        existing_history.append({
            "timestamp": report["timestamp"],
            "total_unrealized_pnl": report["total_unrealized_pnl"],
            "total_realized_pnl": report["total_realized_pnl"]
        })
        if len(existing_history) > 1000:
            existing_history = existing_history[-1000:]

        try:
            with open(history_file, "w") as f:
                json.dump(existing_history, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save PnL history list: {e}", exc_info=True)

        # 6. Save metadata
        metadata_file = self.pnl_dir / "pnl_metadata.json"
        metadata = {
            "last_pnl_calculation_time": report["timestamp"],
            "total_unrealized_pnl": report["total_unrealized_pnl"],
            "total_realized_pnl": report["total_realized_pnl"],
            "positions_count": len(calculated_positions),
            "snapshot_file": str(snapshot_file.name)
        }
        try:
            with open(metadata_file, "w") as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save PnL metadata: {e}", exc_info=True)

        return report

    def get_latest_pnl_snapshot(self) -> Optional[Dict[str, Any]]:
        self._ensure_pnl_dir()
        metadata_file = self.pnl_dir / "pnl_metadata.json"
        if not metadata_file.exists():
            return None
        try:
            with open(metadata_file, "r") as f:
                meta = json.load(f)
            snap_filename = meta.get("snapshot_file")
            if snap_filename:
                snap_path = self.pnl_dir / snap_filename
                if snap_path.exists():
                    with open(snap_path, "r") as f:
                        return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read latest PnL snapshot: {e}")
        return None

    def get_pnl_history(self) -> List[Dict[str, Any]]:
        self._ensure_pnl_dir()
        history_file = self.pnl_dir / "pnl_history.json"
        if not history_file.exists():
            return []
        try:
            with open(history_file, "r") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Failed to read PnL history list: {e}")
            return []

    def get_metadata(self) -> Dict[str, Any]:
        self._ensure_pnl_dir()
        metadata_file = self.pnl_dir / "pnl_metadata.json"
        if not metadata_file.exists():
            return {
                "last_pnl_calculation_time": None,
                "total_unrealized_pnl": 0.0,
                "total_realized_pnl": 0.0,
                "positions_count": 0
            }
        try:
            with open(metadata_file, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read PnL metadata: {e}")
            return {
                "last_pnl_calculation_time": None,
                "total_unrealized_pnl": 0.0,
                "total_realized_pnl": 0.0,
                "positions_count": 0
            }
