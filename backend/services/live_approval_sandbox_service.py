"""backend/services/live_approval_sandbox_service.py

SANDBOX ISOLATION GUARANTEE:
  This service is VALIDATION-ONLY.
  It MUST NOT call ExecutionRouter, LiveOrderManager, PaperOrderManager,
  or any broker API (placeOrder, cancelOrder, modifyOrder).
  It MUST NOT update OMS state, portfolio fills, holdings, positions, or PnL.
  It MUST NOT trigger any order routing side-effect.

  Only allowed operations:
    - Read input parameters
    - Run PreTradeRiskGate.evaluate() (read-only evaluation, no execution)
    - Persist a LiveApprovalIntent audit record to the database
    - Return the intent record

  Allowed status values for LiveApprovalIntent:
    - DISABLED  : sandbox feature is disabled via config
    - VALIDATED : all pre-trade checks passed (does NOT mean approved for live)
    - REJECTED  : one or more pre-trade checks failed
    - EXPIRED   : reserved for future intent expiry logic (Phase 24B+)

  Forbidden status values (must NEVER be set):
    - EXECUTED, APPROVED_LIVE, PLACED, FILLED, LIVE_EXECUTED
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.core.config import Settings, settings as default_settings
from backend.db.models import LiveApprovalIntent
from backend.execution.models import OrderIntent
from backend.execution.pre_trade_risk_gate import PreTradeRiskGate

# Constrained set of allowed statuses — NEVER add EXECUTED, APPROVED_LIVE, PLACED, FILLED
_ALLOWED_STATUSES = frozenset({"DISABLED", "VALIDATED", "REJECTED", "EXPIRED"})


class LiveApprovalSandboxService:
    """Validation-only sandbox service.

    EXECUTION BOUNDARY: This service NEVER calls ExecutionRouter,
    LiveOrderManager, PaperOrderManager, or any broker mutation API.
    """

    def __init__(self, db: Session, settings: Settings = default_settings, orchestrator=None):
        self.db = db
        self.settings = settings
        self.orchestrator = orchestrator

    def _safe_status(self, status: str) -> str:
        """Enforce status is a member of the allowed set. Raises on violation."""
        if status not in _ALLOWED_STATUSES:
            raise ValueError(
                f"SANDBOX SAFETY VIOLATION: attempted to set forbidden status '{status}'. "
                f"Allowed: {sorted(_ALLOWED_STATUSES)}"
            )
        return status

    async def validate_intent(
        self,
        symbol: str,
        side: str,
        quantity: int,
        product_type: str,
        order_type: str,
        price: Optional[float] = None,
        source_signal_id: Optional[str] = None,
    ) -> LiveApprovalIntent:
        """
        Run validation-only pre-trade checks and persist an audit intent.

        NEVER routes to execution. NEVER contacts broker APIs.
        """
        # Create a unique intent ID
        intent_id = f"sandbox_{uuid.uuid4().hex}"
        created_at = datetime.now(timezone.utc).isoformat()

        # ---- DISABLED BRANCH ------------------------------------------------
        # When sandbox is disabled, write a DISABLED audit record for traceability
        # and return immediately — no checks are run.
        if not self.settings.live_approval_sandbox_enabled:
            intent = LiveApprovalIntent(
                intent_id=intent_id,
                created_at=created_at,
                symbol=symbol,
                side=side,
                quantity=quantity,
                product_type=product_type,
                order_type=order_type,
                source_signal_id=source_signal_id,
                status=self._safe_status("DISABLED"),
                validation_summary="Live approval sandbox is disabled. No checks were run.",
                rejection_reason="live_approval_sandbox_disabled",
            )
            self.db.add(intent)
            self.db.commit()
            self.db.refresh(intent)
            return intent

        # ---- VALIDATION BRANCH ----------------------------------------------
        # Only runs when sandbox is explicitly enabled via config.
        # Perform read-only pre-trade checks. No execution side-effects.
        failed_checks: List[str] = []

        # 1. Basic input validation (before constructing OrderIntent to avoid ValueError)
        if side not in {"BUY", "SELL"}:
            failed_checks.append("invalid_action")
        if not symbol or not symbol.strip():
            failed_checks.append("missing_symbol")
        if quantity <= 0:
            failed_checks.append("invalid_quantity")

        # 2. Kill switch check
        kill_switch = (
            self.orchestrator.router.kill_switch
            if (self.orchestrator and getattr(self.orchestrator, "router", None))
            else None
        )
        if kill_switch and kill_switch.is_active:
            failed_checks.append("kill_switch_active")

        # 3. Run PreTradeRiskGate evaluation only if basic params are valid.
        #    PreTradeRiskGate.evaluate() is a pure read-only evaluation — it returns
        #    a RiskDecision dataclass and NEVER calls ExecutionRouter or any broker API.
        market_watch = self.orchestrator.market_watch if self.orchestrator else None
        portfolio_manager = self.orchestrator.portfolio if self.orchestrator else None

        if not any(c in failed_checks for c in {"invalid_action", "missing_symbol", "invalid_quantity"}):
            try:
                risk_gate = PreTradeRiskGate(
                    kill_switch=kill_switch,
                    market_watch=market_watch,
                    portfolio_manager=portfolio_manager,
                    settings=self.settings,
                )
                intent_obj = OrderIntent(
                    symbol=symbol,
                    side=side,
                    quantity=quantity,
                    order_type=order_type,
                    price=price,
                    strategy_name="SANDBOX_VALIDATION",
                    signal_event_id=source_signal_id,
                    source="AUTOMATIC",
                    # Use LIVE mode to apply the strictest risk checks during validation.
                    # This does NOT route to live execution.
                    trading_mode="LIVE",
                )
                latest_tick = None
                if market_watch and symbol:
                    latest_tick = risk_gate._latest_from_watch(symbol)
                # evaluate() is read-only — returns RiskDecision, no execution side-effects
                decision = await risk_gate.evaluate(intent_obj, latest_market=latest_tick)
                if not decision.approved:
                    failed_checks.extend(decision.failed_checks)
            except Exception as exc:
                # Log the class name only — never expose internal exception strings
                failed_checks.append(f"risk_evaluation_error:{exc.__class__.__name__}")

        # Deduplicate and sort for deterministic ordering
        failed_checks = sorted(set(failed_checks))

        if failed_checks:
            status = "REJECTED"
            validation_summary = f"Validation failed. Checks: {'; '.join(failed_checks)}"
            rejection_reason = ";".join(failed_checks)
        else:
            status = "VALIDATED"
            validation_summary = "Validation passed. All pre-trade risk checks succeeded. No execution was triggered."
            rejection_reason = None

        intent = LiveApprovalIntent(
            intent_id=intent_id,
            created_at=created_at,
            symbol=symbol,
            side=side,
            quantity=quantity,
            product_type=product_type,
            order_type=order_type,
            source_signal_id=source_signal_id,
            status=self._safe_status(status),
            validation_summary=validation_summary,
            rejection_reason=rejection_reason,
        )
        # DB failure will propagate as exception — no fake-success fallback
        self.db.add(intent)
        self.db.commit()
        self.db.refresh(intent)
        return intent

    def get_intents(self, limit: int = 100) -> List[LiveApprovalIntent]:
        """Return recent sandbox intents, newest first."""
        return (
            self.db.query(LiveApprovalIntent)
            .order_by(LiveApprovalIntent.id.desc())
            .limit(limit)
            .all()
        )
