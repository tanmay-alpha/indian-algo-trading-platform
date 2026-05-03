# backend/execution/paper_order_manager.py

class PaperOrderManager:

    def __init__(self):
        self.positions = {}

    def place_order(self, symbol, token, side, quantity, price=None):

        print(f"PAPER: PAPER ORDER -> {side} {quantity} {symbol} @ {price}")

        self.positions[symbol] = {
            "side": side,
            "quantity": quantity,
            "entry_price": price
        }

        return {"status": "PAPER_EXECUTED"}