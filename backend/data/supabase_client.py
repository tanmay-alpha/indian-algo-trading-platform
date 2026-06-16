"""Supabase client with graceful fallback when not configured.

The MAET backend is designed to run cleanly on the Render free tier without
any external dependencies. This module exposes ``get_client()`` which returns
a connected Supabase client OR ``None`` if the environment is unconfigured.

Callers should treat ``None`` as "use in-memory cache only" and continue
working — no exception, no abort. The market_data service routes around it
transparently.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client = None
_initialized = False


def get_client():
    """Returns Supabase client or None if not configured.

    Reads ``SUPABASE_URL`` and ``SUPABASE_KEY`` from the environment. Both
    must be set to a non-empty string. The ``SUPABASE_KEY`` should be the
    ``anon`` / ``public`` key from the Supabase dashboard (Settings → API),
    NOT the service_role key — we're using row-level public read/write
    on tables the user provisions explicitly via ``001_candles.sql``.
    """
    global _client, _initialized
    if _initialized:
        return _client

    _initialized = True
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()

    if not url or not key:
        logger.warning(
            "[supabase] SUPABASE_URL or SUPABASE_KEY not set; "
            "using in-memory cache only (5-min TTL)"
        )
        return None

    try:
        from supabase import create_client
        _client = create_client(url, key)
        logger.info(f"[supabase] Connected to {url[:30]}...")
        return _client
    except Exception as e:
        logger.error(f"[supabase] Failed to connect: {e}")
        return None


def is_configured() -> bool:
    """Quick check without initializing the client."""
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()
    return bool(url and key)


def reset():
    """Test helper: forget the cached client (used by unit tests)."""
    global _client, _initialized
    _client = None
    _initialized = False
