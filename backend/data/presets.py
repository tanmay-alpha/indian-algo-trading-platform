"""10 pre-built screens inspired by Tickertape's presets."""

PRESETS = {
    "cash_rich_smallcaps": {
        "name": "Cash Rich Smallcaps",
        "description": "Small companies with strong balance sheets and low debt",
        "filters": {
            "marketCap": [500, 5000],  # 500Cr - 5000Cr
            "debtToEquity": [0, 0.3],  # very low debt
            "roe": [15, None],  # ROE > 15%
            "currentRatio": [1.5, None],  # healthy liquidity
        },
        "sort_by": "marketCap",
        "sort_dir": "desc",
    },
    "momentum_monsters": {
        "name": "Momentum Monsters",
        "description": "Stocks with strong momentum and volume",
        "filters": {
            "changePct": [2, None],  # up > 2% today
            "avgVolume": [500000, None],  # decent volume
        },
        "sort_by": "changePct",
        "sort_dir": "desc",
    },
    "near_52w_lows": {
        "name": "Near 52W Lows",
        "description": "Stocks trading near their 52-week low (potential bounce plays)",
        "filters": {
            "pctFrom52wLow": [0, 10],  # within 10% of 52w low
        },
        "sort_by": "pctFrom52wLow",
        "sort_dir": "asc",
    },
    "dividend_aristocrats": {
        "name": "Dividend Aristocrats",
        "description": "Established companies with healthy dividend yield",
        "filters": {
            "dividendYield": [2, None],  # > 2% yield
            "payoutRatio": [0, 60],  # payout < 60%
            "marketCap": [10000, None],  # > 10000Cr
        },
        "sort_by": "dividendYield",
        "sort_dir": "desc",
    },
    "quality_compounders": {
        "name": "Quality Compounders",
        "description": "High ROE, low debt, profitable businesses",
        "filters": {
            "roe": [20, None],  # ROE > 20%
            "debtToEquity": [0, 0.5],
            "profitMargin": [10, None],
            "marketCap": [1000, None],
        },
        "sort_by": "roe",
        "sort_dir": "desc",
    },
    "penny_gems": {
        "name": "Penny Gems",
        "description": "Low-priced stocks with decent volume",
        "filters": {
            "price": [1, 100],  # < 100
            "avgVolume": [100000, None],
        },
        "sort_by": "changePct",
        "sort_dir": "desc",
    },
    "it_powerhouses": {
        "name": "IT Powerhouses",
        "description": "Top IT sector companies",
        "filters": {
            "sector": ["IT"],
            "marketCap": [10000, None],
        },
        "sort_by": "marketCap",
        "sort_dir": "desc",
    },
    "banking_bellwethers": {
        "name": "Banking Bellwethers",
        "description": "Top banking sector companies",
        "filters": {
            "sector": ["Banking"],
            "marketCap": [25000, None],
        },
        "sort_by": "marketCap",
        "sort_dir": "desc",
    },
    "turnaround_plays": {
        "name": "Turnaround Plays",
        "description": "Down >30% from 52w high, low debt",
        "filters": {
            "pctFrom52wHigh": [-100, -30],  # down 30%+ from 52w high
            "debtToEquity": [0, 1.0],
        },
        "sort_by": "pctFrom52wHigh",
        "sort_dir": "asc",
    },
    "value_picks": {
        "name": "Value Picks",
        "description": "Low P/E with reasonable growth",
        "filters": {
            "pe": [0, 20],  # low P/E
            "pb": [0, 3],  # low P/B
            "roe": [10, None],  # decent ROE
            "marketCap": [5000, None],
        },
        "sort_by": "pe",
        "sort_dir": "asc",
    },
}
