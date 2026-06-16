"""Find peer stocks in the same sector.

Strategy: hand-curated lists of well-known NSE names per sector. We don't try
to be exhaustive — investors compare against 6-8 familiar peers per stock.
"""
import logging
from backend.data.fundamentals import get_fundamentals

logger = logging.getLogger(__name__)


def get_peers(symbol: str, exchange: str = "NSE", limit: int = 6) -> list:
    """Find top peers in the same sector by market cap.

    Returns a list of dicts with at least `symbol`, `name`, `sector`, `marketCap`.
    """
    symbol = symbol.upper()
    target = get_fundamentals(symbol, exchange)
    sector = target.get("sector") or "Other"
    if not sector or sector == "Other":
        # If we don't know the sector, fall back to the generic "Other" pool.
        sector = "Other"

    candidates = _SECTOR_PEERS.get(sector, _SECTOR_PEERS.get("Other", []))
    if not candidates:
        return []

    out = []
    for sym in candidates:
        if sym.upper() == symbol.upper():
            continue
        try:
            f = get_fundamentals(sym, exchange)
        except Exception as e:
            logger.debug(f"[peers] {sym} skip: {e}")
            continue
        if not f or not f.get("symbol"):
            continue
        out.append(f)

    # Sort by market cap, take top N
    out.sort(key=lambda x: x.get("marketCap") or 0, reverse=True)
    return out[:limit]


# Hand-curated peer sets per sector. Top NSE names per sector.
_SECTOR_PEERS = {
    "IT": [
        "TCS", "INFY", "WIPRO", "HCLTECH", "TECHM",
        "LTIM", "MPHASIS", "PERSISTENT", "COFORGE",
    ],
    "Banking": [
        "HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK",
        "INDUSINDBK", "BANKBARODA", "PNB", "IDFCFIRSTB",
    ],
    "Auto": [
        "MARUTI", "TATAMOTORS", "M&M", "BAJAJ-AUTO", "HEROMOTOCO",
        "EICHERMOT", "ASHOKLEY", "TVSMOTOR", "MOTHERSON",
    ],
    "Pharma": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP",
        "LUPIN", "TORNTPHARM", "BIOCON", "AUROPHARMA",
    ],
    "FMCG": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
        "MARICO", "GODREJCP", "COLPAL", "EMAMILTD",
    ],
    "Energy": [
        "RELIANCE", "ONGC", "IOC", "BPCL", "HINDPETRO",
        "GAIL", "OIL", "CASTROLIND",
    ],
    "Metals": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA",
        "NMDC", "HINDZINC", "JINDALSTEL", "NATIONALUM",
    ],
    "Services": ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LT", "BIRLASOFT"],
    "Consumer": [
        "TITAN", "ASIANPAINT", "PIDILITIND", "BERGEPAINT", "GODREJAGRO",
        "GODREJCP", "VGUARD", "HAWKINCOOK",
    ],
    "Finance": [
        "BAJFINANCE", "BAJAJFINSV", "SBILIFE", "HDFCAMC", "ICICIPRULI",
        "ICICIGI", "PEL", "CHOLAFIN", "SHRIRAMFIN", "MUTHOOTFIN",
    ],
    "Industrial": [
        "LT", "SIEMENS", "HAVELLS", "VOLTAS", "CUMMINSIND",
        "THERMAX", "BEL", "BHEL", "GRASIM",
    ],
    "Power": [
        "NTPC", "POWERGRID", "TATAPOWER", "ADANIPOWER", "JSWENERGY",
        "ADANIGREEN", "NHPC", "TORNTPOWER", "SUZLON",
    ],
    "Realty": [
        "DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "BRIGADE",
        "PHOENIXLTD", "SOBHA", "MAHLIFE",
    ],
    "Telecom": ["BHARTIARTL", "RELIANCE", "IDEA", "TATACOMM", "MTNL", "HFCL"],
    "Cement": [
        "ULTRACEMCO", "GRASIM", "AMBUJACEM", "ACC", "DALBHARAT",
        "JKCEMENT", "RAMCOCEM", "SHREECEM",
    ],
    "Construction": [
        "LT", "IRB", "KEC", "KALPATPOWR", "GMRINFRA",
        "GVKPIL", "NBCC", "IRCTC",
    ],
    "Chemicals": [
        "PIDILITIND", "TATACHEM", "UPL", "COROMANDEL", "GNFC",
        "DEEPAKNTR", "PIIND", "AARTIIND",
    ],
    "Healthcare": [
        "APOLLOHOSP", "DRREDDY", "CIPLA", "DIVISLAB", "FORTIS",
        "MAXHEALTH", "NH", "SYNGENE",
    ],
    "Mining": [
        "COALINDIA", "NMDC", "VEDL", "HINDZINC", "NATIONALUM",
        "HCL", "JINDALSTEL",
    ],
    "Other": [
        "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR",
        "ITC", "SBIN",
    ],
}
