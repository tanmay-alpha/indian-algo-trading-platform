import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx


PROJECT_ROOT = Path(__file__).resolve().parents[2]
logger = logging.getLogger(__name__)


class InstrumentLoader:
    SOURCE_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
    LOCAL_CACHE_PATH = "data/instrument_master.json"
    LOCAL_META_PATH = "data/instrument_master_meta.json"
    CACHE_MAX_AGE_HOURS = 24

    def __init__(
        self,
        source_url: str | None = None,
        cache_path: str | Path | None = None,
        meta_path: str | Path | None = None,
        timeout_seconds: int = 10,
    ):
        self.source_url = source_url or self.SOURCE_URL
        self.cache_path = self._resolve_path(cache_path or self.LOCAL_CACHE_PATH)
        self.meta_path = self._resolve_path(meta_path or self.LOCAL_META_PATH)
        self.timeout_seconds = timeout_seconds
        self._last_loaded = 0
        self._last_source = "fallback"
        self._last_cached_at: str | None = None

    async def load(self) -> list[dict]:
        instruments: list[dict] = []
        source = "fallback"

        try:
            if self.cache_is_fresh(self.CACHE_MAX_AGE_HOURS):
                instruments = self.filter_nse_equity(self.load_from_cache())
                source = "cache" if instruments else "fallback"
            else:
                try:
                    await self.download_and_cache()
                    instruments = self.filter_nse_equity(self.load_from_cache())
                    source = "download" if instruments else "fallback"
                except Exception as exc:
                    logger.warning("Instrument master download failed: %s", exc.__class__.__name__)
                    cached = self.load_from_cache()
                    instruments = self.filter_nse_equity(cached)
                    source = "cache" if instruments else "fallback"
        except Exception as exc:
            logger.warning("Instrument master load failed: %s", exc.__class__.__name__)
            instruments = []
            source = "fallback"

        self._last_loaded = len(instruments)
        self._last_source = source
        self._last_cached_at = self._cache_timestamp()
        logger.info("Loaded %s NSE EQ instruments", self._last_loaded)
        return instruments

    async def download_and_cache(self) -> int:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.get(self.source_url)
            response.raise_for_status()
            data = response.json()

        if not isinstance(data, list):
            data = []

        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(data), encoding="utf-8")
        metadata = {
            "cached_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "download",
            "count": len(data),
        }
        self.meta_path.write_text(json.dumps(metadata), encoding="utf-8")
        return len(data)

    def load_from_cache(self) -> list[dict]:
        try:
            if not self.cache_path.exists():
                return []
            data = json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, dict)]

    def cache_is_fresh(self, max_age_hours: int = CACHE_MAX_AGE_HOURS) -> bool:
        if not self.cache_path.exists():
            return False
        cached_at = self._cached_at_from_meta()
        if cached_at is None:
            cached_at = datetime.fromtimestamp(self.cache_path.stat().st_mtime, tz=timezone.utc)
        age_seconds = (datetime.now(timezone.utc) - cached_at).total_seconds()
        return age_seconds < max_age_hours * 3600

    def filter_nse_equity(self, raw: list[dict]) -> list[dict]:
        normalized = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            exch_seg = str(item.get("exch_seg") or item.get("exchange") or "").strip().upper()
            symbol = str(item.get("symbol") or "").strip().upper()
            if exch_seg != "NSE" or not symbol.endswith("-EQ"):
                continue
            clean_symbol = symbol[:-3]
            normalized.append({
                "symbol": symbol,
                "clean_symbol": clean_symbol,
                "token": self._str_or_none(item.get("token") or item.get("symboltoken")),
                "name": str(item.get("name") or clean_symbol),
                "sector": str(item.get("sector") or ""),
                "lot_size": self._int_or_none(item.get("lotsize") or item.get("lot_size")) or 1,
                "tick_size": self._float_or_none(item.get("tick_size")) or 0.0,
                "instrument_type": str(item.get("instrumenttype") or item.get("instrument_type") or "EQ"),
            })
        return normalized

    async def status(self) -> dict:
        return {
            "loaded": self._last_loaded,
            "source": self._last_source,
            "cached_at": self._last_cached_at or self._cache_timestamp(),
        }

    def _cache_timestamp(self) -> str | None:
        cached_at = self._cached_at_from_meta()
        if cached_at:
            return cached_at.isoformat().replace("+00:00", "Z")
        return None

    def _cached_at_from_meta(self) -> datetime | None:
        try:
            if not self.meta_path.exists():
                return None
            meta = json.loads(self.meta_path.read_text(encoding="utf-8"))
            cached_at = meta.get("cached_at")
            if not cached_at:
                return None
            parsed = datetime.fromisoformat(str(cached_at).replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except (OSError, json.JSONDecodeError, ValueError):
            return None

    @staticmethod
    def _resolve_path(path: str | Path) -> Path:
        resolved = Path(path)
        if resolved.is_absolute():
            return resolved
        return PROJECT_ROOT / resolved

    @staticmethod
    def _str_or_none(value: Any) -> str | None:
        return str(value) if value not in (None, "") else None

    @staticmethod
    def _int_or_none(value: Any) -> int | None:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _float_or_none(value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
