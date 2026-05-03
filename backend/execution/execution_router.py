# backend/execution/execution_router.py

from backend.execution.live_order_manager import LiveOrderManager
from backend.execution.paper_order_manager import PaperOrderManager


class ExecutionRouter:

    def __init__(self, mode, session=None):
        self.mode = mode

        if self.mode == "LIVE":
            self.executor = LiveOrderManager(session)
            print("EXECUTION: Execution Mode: LIVE")

        else:
            self.executor = PaperOrderManager()
            print("EXECUTION: Execution Mode: PAPER")

    def place_order(self, symbol, token, side, quantity, price=None):
        return self.executor.place_order(symbol, token, side, quantity, price)