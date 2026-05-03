from backend.core.types import OrderSide


class NSEFeeModel:
    # Review these defaults against current exchange/broker circulars before production use.
    STT_SELL_RATE = 0.025 / 100
    EXCHANGE_CHARGE_RATE = 0.00345 / 100
    SEBI_RATE = 0.0001 / 100
    STAMP_DUTY_BUY_RATE = 0.015 / 100
    GST_RATE = 0.18
    BROKERAGE_FLAT = 20.0
    BROKERAGE_PCT = 0.25 / 100

    def calculate(self, side: str, quantity: int, price: float) -> dict:
        if quantity <= 0:
            raise ValueError("quantity must be greater than 0")
        if price <= 0:
            raise ValueError("price must be greater than 0")
        if side not in {OrderSide.BUY.value, OrderSide.SELL.value}:
            raise ValueError("side must be BUY or SELL")

        turnover = quantity * price
        brokerage = min(self.BROKERAGE_FLAT, turnover * self.BROKERAGE_PCT)
        exchange_charge = turnover * self.EXCHANGE_CHARGE_RATE
        sebi_charge = turnover * self.SEBI_RATE
        stt = turnover * self.STT_SELL_RATE if side == OrderSide.SELL.value else 0.0
        stamp_duty = turnover * self.STAMP_DUTY_BUY_RATE if side == OrderSide.BUY.value else 0.0
        gst = (brokerage + exchange_charge) * self.GST_RATE
        total_fees = brokerage + stt + exchange_charge + sebi_charge + stamp_duty + gst

        return {
            "turnover": round(turnover, 2),
            "brokerage": round(brokerage, 2),
            "stt": round(stt, 2),
            "exchange_charge": round(exchange_charge, 4),
            "sebi_charge": round(sebi_charge, 4),
            "stamp_duty": round(stamp_duty, 2),
            "gst": round(gst, 2),
            "total_fees": round(total_fees, 2),
            "net_cost_to_buy": round(turnover + total_fees, 2) if side == OrderSide.BUY.value else 0.0,
            "net_proceeds_from_sell": round(turnover - total_fees, 2) if side == OrderSide.SELL.value else 0.0,
        }

    def round_trip_fees(self, quantity: int, buy_price: float, sell_price: float) -> dict:
        buy_fees = self.calculate(OrderSide.BUY.value, quantity, buy_price)
        sell_fees = self.calculate(OrderSide.SELL.value, quantity, sell_price)
        total_fees = buy_fees["total_fees"] + sell_fees["total_fees"]
        gross_pnl = (sell_price - buy_price) * quantity
        net_pnl = gross_pnl - total_fees
        breakeven_move_pct = (total_fees / (quantity * buy_price)) * 100 if quantity * buy_price else 0.0
        return {
            "buy_fees": buy_fees,
            "sell_fees": sell_fees,
            "total_fees": round(total_fees, 2),
            "gross_pnl": round(gross_pnl, 2),
            "net_pnl": round(net_pnl, 2),
            "breakeven_move_pct": round(breakeven_move_pct, 4),
        }
