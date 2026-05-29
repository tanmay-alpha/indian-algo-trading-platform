import os
import glob
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from backend.services.broker_account_sync import BrokerAccountSyncService

logger = logging.getLogger(__name__)

class BrokerHoldingModel(BaseModel):
    symbol: str
    isin: str
    quantity: Optional[float] = None
    avg_price: Optional[float] = None
    ltp: Optional[float] = None
    realised_quantity: Optional[float] = None
    product: str
    exchange: str

class BrokerPositionModel(BaseModel):
    symbol: str
    product: str
    exchange: str
    net_qty: Optional[float] = None
    avg_price: Optional[float] = None
    ltp: Optional[float] = None
    unrealised_pnl: Optional[float] = None
    realised_pnl: Optional[float] = None

class BrokerFundsModel(BaseModel):
    available_cash: Optional[float] = None
    net: Optional[float] = None
    used_margin: Optional[float] = None
    available_intraday_payin: Optional[float] = None
    collateral: Optional[float] = None
    m2mrealized: Optional[float] = None
    m2munrealized: Optional[float] = None

class ReconciliationSummaryModel(BaseModel):
    tradebook_status: Optional[str] = None
    tradebook_mismatch_count: Optional[int] = None
    tradebook_report_age_seconds: Optional[int] = None
    tradebook_report_stale: Optional[bool] = None
    account_reconciliation_status: Optional[str] = None
    account_mismatch_count: Optional[int] = None
    account_report_age_seconds: Optional[int] = None
    account_report_stale: Optional[bool] = None

class BrokerAccountSnapshotResponse(BaseModel):
    status: str  # "AVAILABLE", "UNAVAILABLE", "PARTIAL", "STALE"
    data_status: str  # "AVAILABLE", "UNAVAILABLE", "PARTIAL", "STALE"
    holdings: List[BrokerHoldingModel]
    positions: List[BrokerPositionModel]
    funds: Optional[BrokerFundsModel] = None
    fetched_at: datetime
    stale_after_seconds: int = 60
    source: str = "BROKER_READONLY_SNAPSHOT"
    cache_only: bool = True
    not_portfolio_truth: bool = True
    reconciliation_summary: Optional[ReconciliationSummaryModel] = None
    warning: Optional[str] = None
    holdings_status: str = "AVAILABLE"
    positions_status: str = "AVAILABLE"
    funds_status: str = "AVAILABLE"
    last_history_import_time: Optional[datetime] = None
    last_pnl_calculation_time: Optional[datetime] = None
    total_historical_trades: Optional[int] = None
    total_historical_orders: Optional[int] = None


class BrokerAccountSnapshotService:
    """
    Read-only service to compile a unified broker account snapshot.
    Fetches positions, holdings, and funds, normalizes them, and includes
    the latest trade and account reconciliation summaries.
    """
    
    # Class-level cache variables for stale state fallback
    _cached_snapshot: Optional[Dict[str, Any]] = None
    _cached_time: Optional[datetime] = None

    def __init__(self, session_manager=None):
        self.session_manager = session_manager
        self.sync_service = BrokerAccountSyncService(session_manager=session_manager)
        self.recon_trade_dir = "data/reconciliation"
        self.recon_acc_dir = "data/reconciliation/account"

    def get_latest_tradebook_report(self) -> Optional[Dict[str, Any]]:
        """Find the latest tradebook reconciliation report from data/reconciliation."""
        if not os.path.exists(self.recon_trade_dir):
            return None
        files = glob.glob(os.path.join(self.recon_trade_dir, "reconciliation_report_*.json"))
        if not files:
            return None
        
        reports = []
        for file in files:
            try:
                with open(file, "r") as f:
                    data = json.load(f)
                    reports.append(data)
            except Exception as e:
                logger.warning(f"Error loading tradebook report {file}: {e}")
                continue
        
        if not reports:
            return None
        
        # Sort by checked_at or generated_at descending safely
        def get_date(x):
            val = x.get("checked_at") or x.get("generated_at") or ""
            return val
            
        reports.sort(key=get_date, reverse=True)
        return reports[0]

    def get_latest_account_report(self) -> Optional[Dict[str, Any]]:
        """Find the latest account reconciliation report from data/reconciliation/account."""
        if not os.path.exists(self.recon_acc_dir):
            return None
        files = glob.glob(os.path.join(self.recon_acc_dir, "acc_recon_*.json"))
        if not files:
            return None
        
        reports = []
        for file in files:
            try:
                with open(file, "r") as f:
                    data = json.load(f)
                    reports.append(data)
            except Exception as e:
                logger.warning(f"Error loading account report {file}: {e}")
                continue
        
        if not reports:
            return None
        
        # Sort by generated_at descending safely
        reports.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
        return reports[0]

    def get_snapshot(self) -> BrokerAccountSnapshotResponse:
        """Fetch, normalize and return the full broker account snapshot."""
        now = datetime.now(timezone.utc)
        
        # Load import metadata and PnL metadata
        import_meta = self._load_import_metadata()
        pnl_meta = self._load_pnl_metadata()

        last_import = None
        last_import_str = import_meta.get("last_import_time")
        if last_import_str:
            try:
                last_import = datetime.fromisoformat(last_import_str.replace("Z", "+00:00"))
            except Exception:
                pass

        last_pnl = None
        last_pnl_str = pnl_meta.get("last_pnl_calculation_time")
        if last_pnl_str:
            try:
                last_pnl = datetime.fromisoformat(last_pnl_str.replace("Z", "+00:00"))
            except Exception:
                pass

        total_trades = import_meta.get("total_historical_trades") or import_meta.get("total_trades_count")
        total_orders = import_meta.get("total_historical_orders") or import_meta.get("total_orders_count")

        # Check session availability
        session_valid = self.session_manager and getattr(self.session_manager, "is_valid", False)
        
        if not session_valid:
            # Fallback to serving stale snapshot if available in class-level cache
            if BrokerAccountSnapshotService._cached_snapshot and BrokerAccountSnapshotService._cached_time:
                age = int((now - BrokerAccountSnapshotService._cached_time).total_seconds())
                cached_data = BrokerAccountSnapshotService._cached_snapshot
                
                # Reconstruct models from cache
                holdings = [BrokerHoldingModel(**h) for h in cached_data.get("holdings", [])]
                positions = [BrokerPositionModel(**p) for p in cached_data.get("positions", [])]
                funds = BrokerFundsModel(**cached_data["funds"]) if cached_data.get("funds") else None
                
                return BrokerAccountSnapshotResponse(
                    status="STALE",
                    data_status="STALE",
                    holdings=holdings,
                    positions=positions,
                    funds=funds,
                    fetched_at=BrokerAccountSnapshotService._cached_time,
                    stale_after_seconds=60,
                    source="BROKER_READONLY_SNAPSHOT",
                    cache_only=True,
                    not_portfolio_truth=True,
                    reconciliation_summary=self._build_recon_summary(),
                    warning=f"Served from stale cache (age: {age}s)",
                    holdings_status="STALE",
                    positions_status="STALE",
                    funds_status="STALE" if funds else "UNAVAILABLE",
                    last_history_import_time=last_import,
                    last_pnl_calculation_time=last_pnl,
                    total_historical_trades=total_trades,
                    total_historical_orders=total_orders
                )
                
            return BrokerAccountSnapshotResponse(
                status="UNAVAILABLE",
                data_status="UNAVAILABLE",
                holdings=[],
                positions=[],
                funds=None,
                fetched_at=now,
                stale_after_seconds=60,
                source="BROKER_READONLY_SNAPSHOT",
                cache_only=True,
                not_portfolio_truth=True,
                reconciliation_summary=self._build_recon_summary(),
                warning="BROKER_SESSION_UNAVAILABLE",
                holdings_status="UNAVAILABLE",
                positions_status="UNAVAILABLE",
                funds_status="UNAVAILABLE",
                last_history_import_time=last_import,
                last_pnl_calculation_time=last_pnl,
                total_historical_trades=total_trades,
                total_historical_orders=total_orders
            )

        # Fetch sections
        holdings_resp = self.sync_service.get_holdings()
        positions_resp = self.sync_service.get_positions()
        funds_resp = self.sync_service.get_funds()

        holdings_data = holdings_resp.get("holdings", [])
        positions_data = positions_resp.get("positions", [])
        funds_data = funds_resp.get("funds", {})

        # Status check
        statuses = [
            holdings_resp.get("status"),
            positions_resp.get("status"),
            funds_resp.get("status")
        ]
        
        holdings_status = "AVAILABLE" if holdings_resp.get("status") == "OK" else "UNAVAILABLE"
        positions_status = "AVAILABLE" if positions_resp.get("status") == "OK" else "UNAVAILABLE"
        funds_status = "AVAILABLE" if funds_resp.get("status") == "OK" else "UNAVAILABLE"
        
        any_error = any(s == "BROKER_ERROR" for s in statuses)
        all_error = all(s == "BROKER_ERROR" for s in statuses)
        
        if all_error:
            overall_status = "UNAVAILABLE"
            warning_msg = "All broker segments failed to load"
        elif any_error:
            overall_status = "PARTIAL"
            warning_msg = "Some broker segments failed to load"
        else:
            overall_status = "AVAILABLE"
            warning_msg = None

        # Build list of models
        holdings = []
        for h in holdings_data:
            try:
                holdings.append(BrokerHoldingModel(**h))
            except Exception as e:
                logger.error(f"Error parsing holding {h}: {e}")

        positions = []
        for p in positions_data:
            try:
                positions.append(BrokerPositionModel(**p))
            except Exception as e:
                logger.error(f"Error parsing position {p}: {e}")

        funds = None
        if funds_data:
            try:
                funds = BrokerFundsModel(**funds_data)
            except Exception as e:
                logger.error(f"Error parsing funds {funds_data}: {e}")

        # Update cache on success or partial success
        if overall_status in ("AVAILABLE", "PARTIAL"):
            BrokerAccountSnapshotService._cached_snapshot = {
                "holdings": [h.model_dump() for h in holdings],
                "positions": [p.model_dump() for p in positions],
                "funds": funds.model_dump() if funds else None
            }
            BrokerAccountSnapshotService._cached_time = now

        return BrokerAccountSnapshotResponse(
            status=overall_status,
            data_status=overall_status,
            holdings=holdings,
            positions=positions,
            funds=funds,
            fetched_at=now,
            stale_after_seconds=60,
            source="BROKER_READONLY_SNAPSHOT",
            cache_only=True,
            not_portfolio_truth=True,
            reconciliation_summary=self._build_recon_summary(),
            warning=warning_msg,
            holdings_status=holdings_status,
            positions_status=positions_status,
            funds_status=funds_status,
            last_history_import_time=last_import,
            last_pnl_calculation_time=last_pnl,
            total_historical_trades=total_trades,
            total_historical_orders=total_orders
        )

    def _build_recon_summary(self) -> ReconciliationSummaryModel:
        """Helper to build ReconciliationSummaryModel from stored files."""
        tradebook_report = self.get_latest_tradebook_report()
        account_report = self.get_latest_account_report()
        
        now = datetime.now(timezone.utc)

        tb_status = None
        tb_mismatch = None
        tb_age = None
        tb_stale = None
        if tradebook_report:
            # Tradebook reports have matched_count and mismatch_count
            tb_mismatch = tradebook_report.get("mismatch_count")
            if tb_mismatch is not None:
                tb_status = "CRITICAL_MISMATCHES" if tb_mismatch > 0 else "OK"
            
            # Safe timestamp parsing
            tb_time_str = tradebook_report.get("checked_at") or tradebook_report.get("generated_at")
            if tb_time_str:
                try:
                    parsed_time = datetime.fromisoformat(tb_time_str.replace("Z", "+00:00"))
                    tb_age = int((now - parsed_time).total_seconds())
                    tb_stale = tb_age > 86400  # Stale if older than 24h
                except Exception as e:
                    logger.warning(f"Failed to parse tradebook report timestamp '{tb_time_str}': {e}")

        acc_status = None
        acc_mismatch = None
        acc_age = None
        acc_stale = None
        if account_report:
            acc_status = account_report.get("overall_status")
            acc_mismatch = account_report.get("mismatch_count")
            
            # Safe timestamp parsing
            acc_time_str = account_report.get("generated_at")
            if acc_time_str:
                try:
                    parsed_time = datetime.fromisoformat(acc_time_str.replace("Z", "+00:00"))
                    acc_age = int((now - parsed_time).total_seconds())
                    acc_stale = acc_age > 86400  # Stale if older than 24h
                except Exception as e:
                    logger.warning(f"Failed to parse account report timestamp '{acc_time_str}': {e}")

        return ReconciliationSummaryModel(
            tradebook_status=tb_status,
            tradebook_mismatch_count=tb_mismatch,
            tradebook_report_age_seconds=tb_age,
            tradebook_report_stale=tb_stale,
            account_reconciliation_status=acc_status,
            account_mismatch_count=acc_mismatch,
            account_report_age_seconds=acc_age,
            account_report_stale=acc_stale
        )

    def _load_import_metadata(self) -> Dict[str, Any]:
        path = Path("data/broker_history/import_metadata.json")
        if not path.exists():
            return {}
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _load_pnl_metadata(self) -> Dict[str, Any]:
        path = Path("data/pnl_history/pnl_metadata.json")
        if not path.exists():
            return {}
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            return {}
