class BrokerReconciliation:
    def reconcile_positions(self, internal_positions: list[dict], broker_positions: list[dict]) -> list[dict]:
        return self._reconcile(
            internal_positions,
            broker_positions,
            missing_broker_severity="CRITICAL",
            missing_internal_severity="CRITICAL",
        )

    def reconcile_holdings(self, internal_holdings: list[dict], broker_holdings: list[dict]) -> list[dict]:
        return self._reconcile(
            internal_holdings,
            broker_holdings,
            missing_broker_severity="WARNING",
            missing_internal_severity="WARNING",
        )

    def summarize(self, mismatches: list[dict]) -> dict:
        by_severity: dict[str, int] = {}
        for mismatch in mismatches:
            severity = mismatch["severity"]
            by_severity[severity] = by_severity.get(severity, 0) + 1
        return {
            "mismatch_count": len(mismatches),
            "by_severity": by_severity,
            "ok": len(mismatches) == 0,
        }

    def _reconcile(
        self,
        internal_items: list[dict],
        broker_items: list[dict],
        missing_broker_severity: str,
        missing_internal_severity: str,
    ) -> list[dict]:
        mismatches: list[dict] = []
        internal = {self._symbol(item): item for item in internal_items if self._symbol(item)}
        broker = {self._symbol(item): item for item in broker_items if self._symbol(item)}
        for symbol, internal_item in internal.items():
            broker_item = broker.get(symbol)
            if not broker_item:
                mismatches.append(self._mismatch(symbol, "symbol", internal_item, None, missing_broker_severity, "Symbol missing from broker"))
                continue
            internal_qty = self._qty(internal_item)
            broker_qty = self._qty(broker_item)
            if internal_qty != broker_qty:
                mismatches.append(self._mismatch(symbol, "quantity", internal_qty, broker_qty, "CRITICAL", "Quantity mismatch"))
            internal_avg = round(self._avg(internal_item), 2)
            broker_avg = round(self._avg(broker_item), 2)
            if abs(internal_avg - broker_avg) > 0.01:
                mismatches.append(self._mismatch(symbol, "avg_price", internal_avg, broker_avg, "WARNING", "Average price mismatch"))
        for symbol, broker_item in broker.items():
            if symbol not in internal and self._qty(broker_item) != 0:
                mismatches.append(self._mismatch(symbol, "symbol", None, broker_item, missing_internal_severity, "Symbol missing from internal state"))
        return mismatches

    def _symbol(self, item: dict) -> str:
        return str(item.get("symbol") or item.get("tradingsymbol") or "").upper()

    def _qty(self, item: dict) -> int:
        return int(float(item.get("quantity") or item.get("qty") or item.get("netqty") or 0))

    def _avg(self, item: dict) -> float:
        return float(item.get("avg_price") or item.get("averageprice") or item.get("average_price") or 0)

    def _mismatch(self, symbol, field, internal_value, broker_value, severity, message):
        return {
            "symbol": symbol,
            "field": field,
            "internal_value": internal_value,
            "broker_value": broker_value,
            "severity": severity,
            "message": message,
        }
