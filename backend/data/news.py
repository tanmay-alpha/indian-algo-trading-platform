"""Fetch stock-related news from Google News RSS.

Lightweight wrapper: feedparser handles RSS/Atom, requests handles HTTP.
10-min cache per (symbol, limit) tuple to avoid hammering Google's RSS.
"""
import logging
import time
from datetime import datetime
from typing import List, Dict, Optional

try:
    import feedparser  # type: ignore
except Exception:  # pragma: no cover - allow missing dep at import
    feedparser = None  # type: ignore

import requests

logger = logging.getLogger(__name__)

_cache: Dict[str, tuple] = {}
_CACHE_TTL = 600  # 10 min


def get_news(
    symbol: str,
    name: Optional[str] = None,
    limit: int = 10,
) -> List[dict]:
    """Fetch news from Google News RSS for the given symbol/name.

    Returns a list of dicts: {title, link, source, published, snippet}.
    Empty list if feedparser unavailable and HTTP fetch fails.
    """
    key = f"{symbol.upper()}_{limit}"
    cached = _cache.get(key)
    if cached:
        ts, data = cached
        if time.time() - ts < _CACHE_TTL:
            return data

    query = name or symbol
    # Google News RSS — country=IN for Indian results
    url = (
        "https://news.google.com/rss/search?"
        f"q={requests.utils.quote(query)}+stock+NSE&hl=en-IN&gl=IN&ceid=IN:en"
    )

    entries: list = []
    if feedparser is not None:
        try:
            feed = feedparser.parse(url)
            entries = list(getattr(feed, "entries", []) or [])
        except Exception as e:
            logger.warning(f"[news {symbol}] feedparser error: {e}")
            entries = []

    if not entries:
        # Last-ditch: try Yahoo Finance symbol news RSS (works for big names)
        yahoo_url = (
            f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}"
            f"&region=US&lang=en-US"
        )
        if feedparser is not None:
            try:
                feed = feedparser.parse(yahoo_url)
                entries = list(getattr(feed, "entries", []) or [])
            except Exception as e:
                logger.debug(f"[news {symbol}] yahoo fallback error: {e}")

    if not entries:
        return []

    out: list = []
    for entry in entries[:limit]:
        try:
            published = None
            pp = getattr(entry, "published_parsed", None)
            if pp:
                published = datetime(*pp[:6]).isoformat()
        except Exception:
            published = None

        src = "Google News"
        if hasattr(entry, "source") and getattr(entry.source, "title", None):
            src = entry.source.title

        snippet = ""
        if hasattr(entry, "summary"):
            snippet = (entry.summary or "")[:240]

        out.append({
            "title": getattr(entry, "title", ""),
            "link": getattr(entry, "link", ""),
            "source": src,
            "published": published,
            "snippet": snippet,
        })

    _cache[key] = (time.time(), out)
    return out
