import re
from typing import List, Optional
from backend.core.events import OrderRequestEvent

class ManualOrderPolicy:
    def __init__(self, max_quantity: int = 1, max_notional: float = 10000.0):
        self.max_quantity = max_quantity
        self.max_notional = max_notional

    def validate_manual_order(
        self,
        order_request: OrderRequestEvent,
        ltp: float = 0.0,
        is_dry_run: bool = False
    ) -> List[str]:
        """
        Validate manual order constraints:
        - Equity-only restriction
        - CNC/DELIVERY product types
        - MARKET orders permitted only under DRY_RUN
        - max_quantity <= 1 (by default)
        - notional value within max_notional limit
        Returns a list of failed checks (empty list if validation passes).
        """
        failed = []

        # 1. Equity-only check
        symbol = getattr(order_request, "symbol", "")
        if not symbol:
            failed.append("missing_symbol")
        else:
            # Check NSE equity pattern: uppercase letters, hyphens, no numbers, CE/PE/FUT
            if not re.match(r"^[A-Z\-]+$", symbol) or any(pat in symbol for pat in ["FUT", "CE", "PE"]):
                failed.append("equity_only_restriction")

        # 2. Product type must be CNC or DELIVERY (case-insensitive)
        prod_type = getattr(order_request, "product_type", None) or getattr(order_request, "producttype", None) or ""
        prod_type = str(prod_type).upper()
        if prod_type not in {"CNC", "DELIVERY"}:
            failed.append("product_type_restriction")

        # 3. MARKET orders only under DRY_RUN
        order_type = getattr(order_request, "order_type", None) or getattr(order_request, "ordertype", None) or ""
        order_type = str(order_type).upper()
        if order_type == "MARKET" and not is_dry_run:
            failed.append("market_order_requires_dry_run")

        # 4. Max quantity check (default 1)
        qty = int(getattr(order_request, "quantity", 0))
        if qty <= 0:
            failed.append("invalid_quantity")
        elif qty > self.max_quantity:
            failed.append("quantity_exceeds_max")

        # 5. Max notional check
        price = float(getattr(order_request, "price", 0.0) or ltp or 0.0)
        notional = qty * price
        if notional > self.max_notional:
            failed.append("notional_exceeds_max")

        return failed

    def validate(
        self,
        order_request: OrderRequestEvent,
        ltp: float = 0.0,
        is_dry_run: bool = False
    ) -> tuple[bool, str]:
        """
        Validate manual order constraints and return a tuple of (is_valid, reason).
        Maps failures to detailed reason strings.
        """
        failures = self.validate_manual_order(order_request, ltp, is_dry_run)
        if not failures:
            return True, ""
            
        reasons = []
        for f in failures:
            if f == "quantity_exceeds_max":
                reasons.append(f"Quantity exceeds maximum allowed ({self.max_quantity})")
            elif f == "product_type_restriction":
                prod = getattr(order_request, "product_type", None) or getattr(order_request, "producttype", None) or ""
                reasons.append(f"Product type {prod} not allowed")
            elif f == "market_order_requires_dry_run":
                reasons.append("Market orders are restricted (dry-run mode required)")
            elif f == "notional_exceeds_max":
                reasons.append(f"Notional value exceeds limit ({self.max_notional})")
            elif f == "equity_only_restriction":
                reasons.append("Only NSE equity instrument allowed for manual orders")
            else:
                reasons.append(f)
        return False, "; ".join(reasons)


class ManualOrderLivePolicy:
    def __init__(self):
        self.allow_live_orders = False
        self.max_quantity = 1
        self.cnc_only = True
        self.market_only = True
        self.equity_only = True
        self.requires_final_confirmation = True
        self.requires_kill_switch_clear = True
        self.requires_broker_reconciliation_ok = True

    def validate(self, order_request) -> tuple[bool, str]:
        """
        Validates manual live order request against the default locked policy constraints.
        """
        if not self.allow_live_orders:
            return False, "Live trading is locked by policy (allow_live_orders=False)"
        return True, ""
