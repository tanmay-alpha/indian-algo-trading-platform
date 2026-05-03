# backend/execution/live_order_manager.py

class LiveOrderManager:

    def __init__(self, session):
        self.session = session # AngelSession object
        self.smart = session.smart

    def place_order(self, symbol, token, side, quantity, price=None):
        """
        Places a market order via Angel One SmartApi
        """
        print(f"LIVE_ORDER: LIVE ORDER INITIATED -> {side} {quantity} {symbol}")

        try:
            params = {
                "variety": "NORMAL",
                "tradingsymbol": symbol,
                "symboltoken": token,
                "transactiontype": side,
                "exchange": "NSE",
                "ordertype": "MARKET",
                "producttype": "INTRADAY",
                "duration": "DAY",
                "quantity": str(quantity)
            }

            order_id = self.smart.placeOrder(params)
            print(f"SUCCESS: Order Placed Successfully. ID: {order_id}")
            
            return {
                "status": "SUCCESS",
                "order_id": order_id,
                "symbol": symbol
            }

        except Exception as e:
            print(f"ERROR: Order Placement Failed: {e}")
            return {
                "status": "FAILED",
                "error": str(e)
            }
