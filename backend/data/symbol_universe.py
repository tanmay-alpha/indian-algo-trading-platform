"""NSE/BSE symbol universe: NIFTY 50, sectoral indices, top 200 by market cap.

This is the offline symbol directory. The screener, scanner, and the
landing-page market strip all use ``get_all_nse_symbols()`` to know what
to query. We keep the data inline (no network call) so the page renders
fast and the API works even if Yahoo is rate-limiting us.
"""
import logging

logger = logging.getLogger(__name__)

# NIFTY 50 constituents (50 symbols) — top Indian stocks
NIFTY_50 = [
    ("ADANIPORTS", "Adani Ports & SEZ", "Services"),
    ("APOLLOHOSP", "Apollo Hospitals", "Healthcare"),
    ("ASIANPAINT", "Asian Paints", "Consumer"),
    ("AXISBANK", "Axis Bank", "Banking"),
    ("BAJAJ-AUTO", "Bajaj Auto", "Auto"),
    ("BAJFINANCE", "Bajaj Finance", "Finance"),
    ("BAJAJFINSV", "Bajaj Finserv", "Finance"),
    ("BPCL", "Bharat Petroleum", "Energy"),
    ("BHARTIARTL", "Bharti Airtel", "Telecom"),
    ("BRITANNIA", "Britannia Industries", "FMCG"),
    ("CIPLA", "Cipla", "Pharma"),
    ("COALINDIA", "Coal India", "Mining"),
    ("DIVISLAB", "Divi's Labs", "Pharma"),
    ("DRREDDY", "Dr Reddy's Labs", "Pharma"),
    ("EICHERMOT", "Eicher Motors", "Auto"),
    ("GRASIM", "Grasim Industries", "Cement"),
    ("HCLTECH", "HCL Technologies", "IT"),
    ("HDFCBANK", "HDFC Bank", "Banking"),
    ("HDFCLIFE", "HDFC Life Insurance", "Finance"),
    ("HEROMOTOCO", "Hero MotoCorp", "Auto"),
    ("HINDALCO", "Hindalco", "Metals"),
    ("HINDUNILVR", "Hindustan Unilever", "FMCG"),
    ("ICICIBANK", "ICICI Bank", "Banking"),
    ("INDUSINDBK", "IndusInd Bank", "Banking"),
    ("INFY", "Infosys", "IT"),
    ("ITC", "ITC Limited", "FMCG"),
    ("JSWSTEEL", "JSW Steel", "Metals"),
    ("KOTAKBANK", "Kotak Mahindra Bank", "Banking"),
    ("LT", "Larsen & Toubro", "Construction"),
    ("M&M", "Mahindra & Mahindra", "Auto"),
    ("MARUTI", "Maruti Suzuki", "Auto"),
    ("NESTLEIND", "Nestle India", "FMCG"),
    ("NTPC", "NTPC Limited", "Power"),
    ("ONGC", "Oil & Natural Gas Corp", "Energy"),
    ("POWERGRID", "Power Grid Corp", "Power"),
    ("RELIANCE", "Reliance Industries", "Energy"),
    ("SBILIFE", "SBI Life Insurance", "Finance"),
    ("SBIN", "State Bank of India", "Banking"),
    ("SUNPHARMA", "Sun Pharmaceutical", "Pharma"),
    ("TCS", "Tata Consultancy Services", "IT"),
    ("TATACONSUM", "Tata Consumer Products", "FMCG"),
    ("TATAMOTORS", "Tata Motors", "Auto"),
    ("TATASTEEL", "Tata Steel", "Metals"),
    ("TECHM", "Tech Mahindra", "IT"),
    ("TITAN", "Titan Company", "Consumer"),
    ("ULTRACEMCO", "UltraTech Cement", "Cement"),
    ("UPL", "UPL Limited", "Chemicals"),
    ("WIPRO", "Wipro", "IT"),
    ("SHRIRAMFIN", "Shriram Finance", "Finance"),
    ("LTIM", "LTIMindtree", "IT"),
]

INDICES = [
    ("NIFTY", "NIFTY 50", "Index"),
    ("BANKNIFTY", "NIFTY Bank", "Index"),
    ("SENSEX", "BSE Sensex", "Index"),
]

# Top 200 NSE stocks (most actively traded, beyond NIFTY 50)
TOP_200_EXTRA = [
    ("ADANIENT", "Adani Enterprises", "Services"),
    ("ADANIGREEN", "Adani Green Energy", "Power"),
    ("ATGL", "Adani Total Gas", "Energy"),
    ("AMBUJACEM", "Ambuja Cements", "Cement"),
    ("AUROPHARMA", "Aurobindo Pharma", "Pharma"),
    ("BANDHANBNK", "Bandhan Bank", "Banking"),
    ("BANKBARODA", "Bank of Baroda", "Banking"),
    ("BERGEPAINT", "Berger Paints", "Consumer"),
    ("BIOCON", "Biocon", "Pharma"),
    ("BOSCHLTD", "Bosch Limited", "Auto"),
    ("CHOLAFIN", "Cholamandalam Finance", "Finance"),
    ("COLPAL", "Colgate-Palmolive India", "FMCG"),
    ("CONCOR", "Container Corp of India", "Services"),
    ("CUMMINSIND", "Cummins India", "Industrial"),
    ("DABUR", "Dabur India", "FMCG"),
    ("DLF", "DLF Limited", "Realty"),
    ("DMART", "Avenue Supermarts", "Retail"),
    ("GAIL", "GAIL India", "Energy"),
    ("GODREJCP", "Godrej Consumer Products", "FMCG"),
    ("HAVELLS", "Havells India", "Consumer"),
    ("ICICIPRULI", "ICICI Prudential Life", "Finance"),
    ("IDEA", "Vodafone Idea", "Telecom"),
    ("IGL", "Indraprastha Gas", "Energy"),
    ("INDIGO", "InterGlobe Aviation", "Services"),
    ("JINDALSTEL", "Jindal Steel & Power", "Metals"),
    ("LICI", "Life Insurance Corp", "Finance"),
    ("LUPIN", "Lupin", "Pharma"),
    ("MARICO", "Marico", "FMCG"),
    ("MUTHOOTFIN", "Muthoot Finance", "Finance"),
    ("NAUKRI", "Info Edge (Naukri)", "IT"),
    ("PAGEIND", "Page Industries", "Consumer"),
    ("PETRONET", "Petronet LNG", "Energy"),
    ("PIDILITIND", "Pidilite Industries", "Chemicals"),
    ("PNB", "Punjab National Bank", "Banking"),
    ("RECLTD", "REC Limited", "Finance"),
    ("SAIL", "Steel Authority of India", "Metals"),
    ("SIEMENS", "Siemens Limited", "Industrial"),
    ("SRF", "SRF Limited", "Chemicals"),
    ("TATAPOWER", "Tata Power", "Power"),
    ("TORNTPHARM", "Torrent Pharmaceuticals", "Pharma"),
    ("TRENT", "Trent Limited", "Retail"),
    ("VEDL", "Vedanta Limited", "Metals"),
    ("ZOMATO", "Zomato Limited", "Services"),
    ("ZYDUSLIFE", "Zydus Lifesciences", "Pharma"),
]


def get_all_nse_symbols() -> list:
    """Returns list of ``(symbol, name, sector)`` tuples for NSE universe."""
    universe = NIFTY_50 + TOP_200_EXTRA
    return universe


def get_indices() -> list:
    """Returns list of ``(symbol, name, sector)`` for indices."""
    return INDICES


def yahoo_ticker(symbol: str, exchange: str = "NSE") -> str:
    return f"{symbol}.{'NS' if exchange == 'NSE' else 'BO'}"


def search_in_universe(query: str) -> list:
    """Search the static universe by symbol or name (case-insensitive)."""
    if not query:
        return []
    q = query.upper().strip()
    universe = get_all_nse_symbols() + get_indices()
    matches = []
    for sym, name, sector in universe:
        if q in sym.upper() or q in name.upper():
            matches.append({
                "symbol": sym,
                "name": name,
                "exchange": "NSE",
                "sector": sector,
                "yahoo_ticker": yahoo_ticker(sym),
            })
            if len(matches) >= 20:
                break
    return matches


def get_sectors() -> list:
    """Return the distinct sector list, useful for scanner dropdowns."""
    sectors = sorted({sector for _, _, sector in get_all_nse_symbols()})
    return sectors
