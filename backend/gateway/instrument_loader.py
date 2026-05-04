import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class InstrumentLoader:
    SOURCE_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
    LOCAL_CACHE_PATH = "data/instrument_master.json"
    LOCAL_META_PATH = "data/instrument_master_meta.json"

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

    async def download_and_cache(self) -> int:
        data = await asyncio.to_thread(self._download_json)
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

    def cache_is_fresh(self, max_age_hours: int = 24) -> bool:
        if not self.cache_path.exists():
            return False
        cached_at = self._cached_at_from_meta()
        if cached_at is None:
            cached_at = datetime.fromtimestamp(self.cache_path.stat().st_mtime, tz=timezone.utc)
        age_seconds = (datetime.now(timezone.utc) - cached_at).total_seconds()
        return age_seconds < max_age_hours * 3600

    def filter_nse_equity(self, instruments: list[dict]) -> list[dict]:
        normalized = []
        for item in instruments:
            if not isinstance(item, dict):
                continue
            exch_seg = str(item.get("exch_seg") or "").strip().upper()
            symbol = str(item.get("symbol") or "").strip().upper()
            if exch_seg != "NSE" or not symbol.endswith("-EQ"):
                continue
            normalized.append({
                "symbol": symbol,
                "token": str(item.get("token")) if item.get("token") is not None else None,
                "name": item.get("name"),
                "lotsize": item.get("lotsize"),
                "tick_size": item.get("tick_size"),
                "instrument_type": item.get("instrumenttype") or item.get("instrument_type"),
            })
        return normalized

    def _download_json(self):
        with urlopen(self.source_url, timeout=self.timeout_seconds) as response:
            payload = response.read()
        return json.loads(payload.decode("utf-8"))

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
