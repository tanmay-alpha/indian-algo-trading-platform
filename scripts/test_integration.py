import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import time
from backend.gateway.market_gateway import MarketDataGateway

if __name__ == "__main__":
    gateway = MarketDataGateway()
    gateway.start()
    
    print("Main thread running freely... Waiting for 10 seconds of ticks.")
    time.sleep(10)
    print("Integration test complete.")
