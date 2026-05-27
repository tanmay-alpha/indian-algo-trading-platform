import json
import logging
import os
import uuid
import dataclasses
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AccountReconciliationMismatch:
    severity: str  # "INFO", "WARNING", "CRITICAL"
    mismatch_type: str
    section: str  # "HOLDINGS", "POSITIONS", "FUNDS"
    symbol: Optional[str] = None
    broker_value: Any = None
    local_value: Any = None
    detail: str = ""


@dataclass
class AccountReconciliationReport:
    reconciliation_id: str
    generated_at: str
    broker_session_available: bool
    holdings_checked: bool
    positions_checked: bool
    funds_checked: bool
    matched_count: int
    mismatch_count: int
    affected_symbols: List[str]
    anomalies: List[AccountReconciliationMismatch]
    overall_status: str


class BrokerAccountReconciliationService:
    """
    Read-only account reconciliation service for Phase 22C.
    Compares broker holdings, positions, and funds with local MAET internal state.
    """

    def __init__(self, portfolio_engine=None):
        self.portfolio_engine = portfolio_engine
        self.reports_dir = "data/reconciliation/account"
        os.makedirs(self.reports_dir, exist_ok=True)

    def reconcile_from_broker(self, broker_sync_service) -> AccountReconciliationReport:
        recon_id = f"acc_recon_{uuid.uuid4().hex[:8]}"
        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        # Fallback if broker is unavailable
        if not getattr(broker_sync_service, "_is_available", lambda: False)():
            report = AccountReconciliationReport(
                reconciliation_id=recon_id,
                generated_at=now_str,
                broker_session_available=False,
                holdings_checked=False,
                positions_checked=False,
                funds_checked=False,
                matched_count=0,
                mismatch_count=0,
                affected_symbols=[],
                anomalies=[],
                overall_status="BROKER_UNAVAILABLE"
            )
            self._save_report(report)
            return report

        # Fetch broker data
        broker_holdings_resp = broker_sync_service.get_holdings()
        broker_holdings = broker_holdings_resp.get("holdings", [])
        
        broker_positions_resp = broker_sync_service.get_positions()
        broker_positions = broker_positions_resp.get("positions", [])
        
        broker_funds_resp = broker_sync_service.get_funds()
        broker_funds = broker_funds_resp.get("funds", {})

        # Fetch local data
        local_holdings = self.portfolio_engine.get_holdings() if self.portfolio_engine else []
        local_positions = self.portfolio_engine.get_positions() if self.portfolio_engine else []
        local_summary = self.portfolio_engine.get_summary() if self.portfolio_engine else {}

        anomalies = []
        matched_count = 0
        affected_symbols = set()

        # -------------------------------------------------------------
        # 1. HOLDINGS RECONCILIATION
        # -------------------------------------------------------------
        b_holdings_map = {str(h.get("symbol")).upper(): h for h in broker_holdings if h.get("symbol")}
        l_holdings_map = {str(h.get("symbol")).upper(): h for h in local_holdings if h.get("symbol")}

        for sym, b_h in b_holdings_map.items():
            l_h = l_holdings_map.get(sym)
            b_qty = float(b_h.get("quantity", 0))

            if not l_h:
                if b_qty > 0:
                    anomalies.append(AccountReconciliationMismatch(
                        severity="WARNING",
                        mismatch_type="BROKER_HOLDING_MISSING_LOCAL",
                        section="HOLDINGS",
                        symbol=sym,
                        broker_value=b_qty,
                        detail=f"Broker holding {sym} is missing in local MAET state."
                    ))
                    affected_symbols.add(sym)
                continue

            # Compare Quantity
            l_qty = float(l_h.get("quantity") or 0)
            if b_qty != l_qty:
                anomalies.append(AccountReconciliationMismatch(
                    severity="CRITICAL",
                    mismatch_type="QUANTITY_MISMATCH",
                    section="HOLDINGS",
                    symbol=sym,
                    broker_value=b_qty,
                    local_value=l_qty,
                    detail=f"Holding qty mismatch: broker {b_qty} != local {l_qty}"
                ))
                affected_symbols.add(sym)
            else:
                matched_count += 1

            # Compare Average Price
            b_avg = float(b_h.get("avg_price", 0))
            l_avg = float(l_h.get("avg_price", 0))
            if abs(b_avg - l_avg) > 0.05:
                anomalies.append(AccountReconciliationMismatch(
                    severity="WARNING",
                    mismatch_type="AVG_PRICE_MISMATCH",
                    section="HOLDINGS",
                    symbol=sym,
                    broker_value=b_avg,
                    local_value=l_avg,
                    detail=f"Holding avg price mismatch: broker {b_avg} != local {l_avg}"
                ))
                affected_symbols.add(sym)

            # Compare Product Type (if applicable)
            b_prod = b_h.get("product")
            l_prod = l_h.get("product")
            if b_prod and l_prod and str(b_prod).upper() != str(l_prod).upper():
                anomalies.append(AccountReconciliationMismatch(
                    severity="INFO",
                    mismatch_type="PRODUCT_TYPE_MISMATCH",
                    section="HOLDINGS",
                    symbol=sym,
                    broker_value=b_prod,
                    local_value=l_prod,
                    detail="Product type mismatch."
                ))

            # Compare Exchange
            b_exch = b_h.get("exchange")
            l_exch = l_h.get("exchange")
            if b_exch and l_exch and str(b_exch).upper() != str(l_exch).upper():
                anomalies.append(AccountReconciliationMismatch(
                    severity="INFO",
                    mismatch_type="EXCHANGE_MISMATCH",
                    section="HOLDINGS",
                    symbol=sym,
                    broker_value=b_exch,
                    local_value=l_exch,
                    detail="Exchange mismatch."
                ))

        for sym, l_h in l_holdings_map.items():
            if sym not in b_holdings_map:
                l_qty = float(l_h.get("quantity") or 0)
                if l_qty > 0:
                    anomalies.append(AccountReconciliationMismatch(
                        severity="WARNING",
                        mismatch_type="LOCAL_HOLDING_MISSING_BROKER",
                        section="HOLDINGS",
                        symbol=sym,
                        local_value=l_qty,
                        detail=f"Local holding {sym} is missing at broker."
                    ))
                    affected_symbols.add(sym)

        # -------------------------------------------------------------
        # 2. POSITIONS RECONCILIATION
        # -------------------------------------------------------------
        b_pos_map = {str(p.get("symbol")).upper(): p for p in broker_positions if p.get("symbol")}
        l_pos_map = {str(p.get("symbol")).upper(): p for p in local_positions if p.get("symbol")}

        for sym, b_p in b_pos_map.items():
            l_p = l_pos_map.get(sym)
            b_qty = float(b_p.get("net_qty") or 0)

            if not l_p:
                if b_qty != 0:
                    anomalies.append(AccountReconciliationMismatch(
                        severity="CRITICAL",
                        mismatch_type="BROKER_POSITION_MISSING_LOCAL",
                        section="POSITIONS",
                        symbol=sym,
                        broker_value=b_qty,
                        detail=f"Broker position {sym} is missing locally."
                    ))
                    affected_symbols.add(sym)
                continue

            l_qty_str = l_p.get("quantity") or l_p.get("net_qty") or 0
            
            # Local positions track side. If side is SELL, it might be positive quantity internally, 
            # so we check if the engine exposes net quantity with signs.
            # Usually long is positive, short is negative in 'net_qty'. Let's ensure standard float comparison.
            l_qty = float(l_qty_str)
            if l_p.get("side") == "SELL" and l_qty > 0:
                l_qty = -l_qty

            if b_qty != l_qty:
                anomalies.append(AccountReconciliationMismatch(
                    severity="CRITICAL",
                    mismatch_type="QUANTITY_MISMATCH",
                    section="POSITIONS",
                    symbol=sym,
                    broker_value=b_qty,
                    local_value=l_qty,
                    detail=f"Position qty mismatch: broker {b_qty} != local {l_qty}"
                ))
                affected_symbols.add(sym)
            else:
                matched_count += 1

            # Compare Avg Price
            b_avg = float(b_p.get("avg_price") or 0)
            l_avg = float(l_p.get("entry_price") or l_p.get("avg_price") or 0)
            if abs(b_avg - l_avg) > 0.05:
                anomalies.append(AccountReconciliationMismatch(
                    severity="WARNING",
                    mismatch_type="AVG_PRICE_MISMATCH",
                    section="POSITIONS",
                    symbol=sym,
                    broker_value=b_avg,
                    local_value=l_avg,
                    detail=f"Position avg price mismatch: broker {b_avg} != local {l_avg}"
                ))
                affected_symbols.add(sym)

            # Compare PnL
            b_pnl = float(b_p.get("unrealised_pnl") or 0) + float(b_p.get("realised_pnl") or 0)
            l_pnl = float(l_p.get("unrealized_pnl") or l_p.get("unrealised_pnl") or 0) + float(l_p.get("realized_pnl") or l_p.get("realised_pnl") or 0)
            if abs(b_pnl - l_pnl) > 5.0:  # Allow 5rs diff for minor calculations
                anomalies.append(AccountReconciliationMismatch(
                    severity="INFO",
                    mismatch_type="PNL_MISMATCH",
                    section="POSITIONS",
                    symbol=sym,
                    broker_value=b_pnl,
                    local_value=l_pnl,
                    detail=f"Position PnL mismatch: broker {b_pnl} != local {l_pnl}"
                ))
                affected_symbols.add(sym)

            # Compare Product/Exchange
            b_prod = b_p.get("product")
            l_prod = l_p.get("product")
            if b_prod and l_prod and str(b_prod).upper() != str(l_prod).upper():
                anomalies.append(AccountReconciliationMismatch(
                    severity="INFO",
                    mismatch_type="PRODUCT_TYPE_MISMATCH",
                    section="POSITIONS",
                    symbol=sym,
                    broker_value=b_prod,
                    local_value=l_prod,
                    detail="Product type mismatch."
                ))
                
            b_exch = b_p.get("exchange")
            l_exch = l_p.get("exchange")
            if b_exch and l_exch and str(b_exch).upper() != str(l_exch).upper():
                anomalies.append(AccountReconciliationMismatch(
                    severity="INFO",
                    mismatch_type="EXCHANGE_MISMATCH",
                    section="POSITIONS",
                    symbol=sym,
                    broker_value=b_exch,
                    local_value=l_exch,
                    detail="Exchange mismatch."
                ))

        for sym, l_p in l_pos_map.items():
            if sym not in b_pos_map:
                l_qty_str = l_p.get("quantity") or l_p.get("net_qty") or 0
                l_qty = float(l_qty_str)
                if l_qty != 0:
                    anomalies.append(AccountReconciliationMismatch(
                        severity="CRITICAL",
                        mismatch_type="LOCAL_POSITION_MISSING_BROKER",
                        section="POSITIONS",
                        symbol=sym,
                        local_value=l_qty,
                        detail=f"Local position {sym} is missing at broker."
                    ))
                    affected_symbols.add(sym)

        # -------------------------------------------------------------
        # 3. FUNDS RECONCILIATION
        # -------------------------------------------------------------
        if broker_funds:
            b_avail = float(broker_funds.get("available_cash") or broker_funds.get("net") or 0)
            l_avail = float(local_summary.get("equity") or local_summary.get("current_capital") or 0)

            # Check negative funds
            if b_avail < 0:
                anomalies.append(AccountReconciliationMismatch(
                    severity="CRITICAL",
                    mismatch_type="NEGATIVE_OR_INVALID_BROKER_VALUE",
                    section="FUNDS",
                    broker_value=b_avail,
                    detail="Broker available cash is negative."
                ))

            # In some systems local equity tracks available funds. If difference > 5, warn.
            if l_avail > 0 and abs(b_avail - l_avail) > 5.0:
                anomalies.append(AccountReconciliationMismatch(
                    severity="WARNING",
                    mismatch_type="FUNDS_AVAILABLE_MISMATCH",
                    section="FUNDS",
                    broker_value=b_avail,
                    local_value=l_avail,
                    detail=f"Available funds mismatch: broker {b_avail} != local {l_avail}"
                ))
            else:
                matched_count += 1

            b_used = float(broker_funds.get("used_margin") or 0)
            l_used = float(local_summary.get("used_margin") or 0)
            if l_used > 0 and abs(b_used - l_used) > 5.0:
                anomalies.append(AccountReconciliationMismatch(
                    severity="WARNING",
                    mismatch_type="USED_MARGIN_MISMATCH",
                    section="FUNDS",
                    broker_value=b_used,
                    local_value=l_used,
                    detail=f"Used margin mismatch: broker {b_used} != local {l_used}"
                ))

        # Check local portfolio staleness
        local_time_str = local_summary.get("last_updated")
        if local_time_str:
            try:
                local_time = datetime.fromisoformat(local_time_str)
                if (datetime.now(timezone.utc) - local_time).total_seconds() > 3600:
                    anomalies.append(AccountReconciliationMismatch(
                        severity="WARNING",
                        mismatch_type="STALE_LOCAL_PORTFOLIO",
                        section="FUNDS",
                        local_value=local_time_str,
                        detail="Local portfolio state has not been updated in over an hour."
                    ))
            except Exception:
                pass

        # Overall Status
        status = "OK"
        crit_count = sum(1 for a in anomalies if a.severity == "CRITICAL")
        warn_count = sum(1 for a in anomalies if a.severity == "WARNING")

        if crit_count > 0:
            status = "CRITICAL_MISMATCHES"
        elif warn_count > 0:
            status = "WARNING_MISMATCHES"

        report = AccountReconciliationReport(
            reconciliation_id=recon_id,
            generated_at=now_str,
            broker_session_available=True,
            holdings_checked=True,
            positions_checked=True,
            funds_checked=True,
            matched_count=matched_count,
            mismatch_count=len(anomalies),
            affected_symbols=sorted(list(affected_symbols)),
            anomalies=anomalies,
            overall_status=status
        )

        self._save_report(report)
        return report

    def _save_report(self, report: AccountReconciliationReport):
        file_path = os.path.join(self.reports_dir, f"{report.reconciliation_id}.json")
        try:
            with open(file_path, "w") as f:
                json.dump(dataclasses.asdict(report), f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save account reconciliation report: {e}")
