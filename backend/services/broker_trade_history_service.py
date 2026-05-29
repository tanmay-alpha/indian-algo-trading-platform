import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from backend.services.broker_account_sync import BrokerAccountSyncService

logger = logging.getLogger(__name__)

class BrokerTradeHistoryService:
    """
    Read-only service to import, normalize, deduplicate, and log
    historical trade and order books from Angel One.
    
    Safe read-only execution:
    - Never modifies order books or places trades.
    - Persists snapshots and cumulative histories under data/broker_history/.
    """
    def __init__(self, session_manager=None, sync_service=None):
        self._sm = session_manager
        self.sync_service = sync_service or BrokerAccountSyncService(session_manager=session_manager)
        self.history_dir = Path("data/broker_history")

    def _ensure_history_dir(self):
        """Ensure data/broker_history/ directory exists."""
        self.history_dir.mkdir(parents=True, exist_ok=True)

    def import_history(self) -> Dict[str, Any]:
        """
        Fetch current trades and orders from Angel One, log snapshots,
        and merge them into cumulative historical collections.
        """
        self._ensure_history_dir()
        now = datetime.now(timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")

        # 1. Fetch data from Angel One via sync service
        trades_response = self.sync_service.get_trade_book()
        orders_response = self.sync_service.get_order_book()

        if trades_response.get("status") == "BROKER_SESSION_UNAVAILABLE" or orders_response.get("status") == "BROKER_SESSION_UNAVAILABLE":
            raise ValueError("BROKER_SESSION_UNAVAILABLE")

        if trades_response.get("status") == "BROKER_ERROR" or orders_response.get("status") == "BROKER_ERROR":
            raise ValueError("BROKER_ERROR")

        raw_trades = trades_response.get("trades", [])
        raw_orders = orders_response.get("orders", [])

        # 2. Write snapshots to separate files for audit logs
        snapshot_trades_file = self.history_dir / f"snapshot_trades_{timestamp_str}.json"
        snapshot_orders_file = self.history_dir / f"snapshot_orders_{timestamp_str}.json"

        try:
            with open(snapshot_trades_file, "w") as f:
                json.dump(raw_trades, f, indent=2)
            with open(snapshot_orders_file, "w") as f:
                json.dump(raw_orders, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write history snapshots: {e}", exc_info=True)

        # 3. Load merged trade history, merge and deduplicate
        merged_trades_file = self.history_dir / "merged_trades.json"
        existing_trades: List[Dict[str, Any]] = []
        if merged_trades_file.exists():
            try:
                with open(merged_trades_file, "r") as f:
                    existing_trades = json.load(f)
                    if not isinstance(existing_trades, list):
                        existing_trades = []
            except Exception as e:
                logger.warning(f"Failed to read existing merged trades, starting fresh: {e}")

        # Unique key signature for trades: (trade_id_masked, trade_time, symbol, side, quantity, price)
        def trade_key(t: Dict[str, Any]) -> tuple:
            return (
                t.get("trade_id_masked") or "N/A",
                t.get("trade_time") or "",
                t.get("symbol") or "",
                t.get("side") or "",
                t.get("quantity") or 0.0,
                t.get("price") or 0.0
            )

        trades_map = {trade_key(t): t for t in existing_trades}
        new_trades_added = 0
        for t in raw_trades:
            key = trade_key(t)
            if key not in trades_map:
                trades_map[key] = t
                new_trades_added += 1

        updated_trades = list(trades_map.values())
        # Sort trades by trade_time descending
        updated_trades.sort(key=lambda t: t.get("trade_time", ""), reverse=True)

        try:
            with open(merged_trades_file, "w") as f:
                json.dump(updated_trades, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save merged trades: {e}", exc_info=True)

        # 4. Load merged order history, merge and deduplicate
        merged_orders_file = self.history_dir / "merged_orders.json"
        existing_orders: List[Dict[str, Any]] = []
        if merged_orders_file.exists():
            try:
                with open(merged_orders_file, "r") as f:
                    existing_orders = json.load(f)
                    if not isinstance(existing_orders, list):
                        existing_orders = []
            except Exception as e:
                logger.warning(f"Failed to read existing merged orders, starting fresh: {e}")

        # Unique key signature for orders: (order_id_masked, symbol, side, order_time)
        def order_key(o: Dict[str, Any]) -> tuple:
            return (
                o.get("order_id_masked") or "N/A",
                o.get("symbol") or "",
                o.get("side") or "",
                o.get("order_time") or ""
            )

        orders_map = {order_key(o): o for o in existing_orders}
        new_orders_added = 0
        for o in raw_orders:
            key = order_key(o)
            if key not in orders_map:
                orders_map[key] = o
                new_orders_added += 1
            else:
                # Update with the latest status/state from the broker
                orders_map[key] = o

        updated_orders = list(orders_map.values())
        # Sort orders by order_time descending
        updated_orders.sort(key=lambda o: o.get("order_time", ""), reverse=True)

        try:
            with open(merged_orders_file, "w") as f:
                json.dump(updated_orders, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save merged orders: {e}", exc_info=True)

        # 5. Write metadata
        metadata_file = self.history_dir / "import_metadata.json"
        metadata = {
            "last_import_time": now.isoformat().replace("+00:00", "Z"),
            "total_trades_count": len(updated_trades),
            "total_orders_count": len(updated_orders),
            "new_trades_imported": new_trades_added,
            "new_orders_imported": new_orders_added,
            "snapshot_trades_file": str(snapshot_trades_file.name),
            "snapshot_orders_file": str(snapshot_orders_file.name)
        }

        try:
            with open(metadata_file, "w") as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save history import metadata: {e}", exc_info=True)

        return metadata

    def get_merged_trades(self) -> List[Dict[str, Any]]:
        """Return the list of merged, deduplicated trades."""
        merged_trades_file = self.history_dir / "merged_trades.json"
        if not merged_trades_file.exists():
            return []
        try:
            with open(merged_trades_file, "r") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Failed to read merged trades: {e}")
            return []

    def get_merged_orders(self) -> List[Dict[str, Any]]:
        """Return the list of merged, deduplicated orders."""
        merged_orders_file = self.history_dir / "merged_orders.json"
        if not merged_orders_file.exists():
            return []
        try:
            with open(merged_orders_file, "r") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Failed to read merged orders: {e}")
            return []

    def get_metadata(self) -> Dict[str, Any]:
        """Return metadata for trade/order history."""
        metadata_file = self.history_dir / "import_metadata.json"
        if not metadata_file.exists():
            return {
                "last_import_time": None,
                "total_trades_count": 0,
                "total_orders_count": 0,
                "new_trades_imported": 0,
                "new_orders_imported": 0
            }
        try:
            with open(metadata_file, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read history metadata: {e}")
            return {
                "last_import_time": None,
                "total_trades_count": 0,
                "total_orders_count": 0,
                "new_trades_imported": 0,
                "new_orders_imported": 0
            }

    def calculate_pnl_analytics(self) -> Dict[str, Any]:
        """
        Calculate PnL history metrics from merged trades, including:
        - total trades (round-trips)
        - win rate
        - total realized PnL
        - average win / average loss
        - daily PnL breakdown
        """
        trades = self.get_merged_trades()
        # Sort trades by trade_time ascending so we process them chronologically
        trades = sorted(trades, key=lambda t: t.get("trade_time") or "")

        inventory = {} # symbol -> list of dicts
        
        realized_pnl = 0.0
        wins = 0
        losses = 0
        total_win_amount = 0.0
        total_loss_amount = 0.0
        
        round_trips = []
        daily_pnl = {}

        for t in trades:
            sym = t.get("symbol")
            side = (t.get("side") or "").upper()
            qty = float(t.get("quantity") or 0.0)
            price = float(t.get("price") or 0.0)
            time_str = t.get("trade_time") or ""
            
            if not sym or qty <= 0:
                continue
                
            date_str = time_str.split(" ")[0] if " " in time_str else time_str.split("T")[0]
            if len(date_str) < 10:
                date_str = "UNKNOWN"
            
            if sym not in inventory:
                inventory[sym] = []
                
            opp_side = "SELL" if side == "BUY" else "BUY"
            
            pnl_from_trade = 0.0
            
            while qty > 0 and inventory[sym] and inventory[sym][0]["side"] == opp_side:
                inv_item = inventory[sym][0]
                inv_qty = inv_item["qty"]
                inv_price = inv_item["price"]
                
                match_amount = min(qty, inv_qty)
                
                if side == "SELL":
                    item_pnl = match_amount * (price - inv_price)
                else:
                    item_pnl = match_amount * (inv_price - price)
                    
                pnl_from_trade += item_pnl
                realized_pnl += item_pnl
                
                inv_item["qty"] -= match_amount
                qty -= match_amount
                
                if inv_item["qty"] <= 1e-5:
                    inventory[sym].pop(0)
                    
            if pnl_from_trade != 0.0:
                round_trips.append({
                    "symbol": sym,
                    "pnl": pnl_from_trade,
                    "date": date_str
                })
                if pnl_from_trade > 0:
                    wins += 1
                    total_win_amount += pnl_from_trade
                else:
                    losses += 1
                    total_loss_amount += abs(pnl_from_trade)
                    
                daily_pnl[date_str] = daily_pnl.get(date_str, 0.0) + pnl_from_trade
                
            if qty > 0:
                inventory[sym].append({
                    "price": price,
                    "qty": qty,
                    "side": side,
                    "time": time_str
                })

        total_rounds = wins + losses
        win_rate = (wins / total_rounds * 100.0) if total_rounds > 0 else 0.0
        avg_win = (total_win_amount / wins) if wins > 0 else 0.0
        avg_loss = (total_loss_amount / losses) if losses > 0 else 0.0
        profit_factor = (total_win_amount / total_loss_amount) if total_loss_amount > 0 else (total_win_amount if total_win_amount > 0 else 1.0)

        daily_breakdown = [{"date": d, "pnl": p} for d, p in sorted(daily_pnl.items())]

        analytics = {
            "total_trades": len(trades),
            "total_round_trips": total_rounds,
            "win_rate_percent": round(win_rate, 2),
            "total_realized_pnl": round(realized_pnl, 2),
            "wins_count": wins,
            "losses_count": losses,
            "average_win": round(avg_win, 2),
            "average_loss": round(avg_loss, 2),
            "profit_factor": round(profit_factor, 2),
            "daily_pnl_breakdown": daily_breakdown
        }
        
        pnl_dir = Path("data/pnl_history")
        pnl_dir.mkdir(parents=True, exist_ok=True)
        try:
            with open(pnl_dir / "calculated_pnl_analytics.json", "w") as f:
                json.dump(analytics, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save calculated PnL analytics: {e}")
            
        return analytics
