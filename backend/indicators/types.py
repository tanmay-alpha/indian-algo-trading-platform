from dataclasses import dataclass, field
from typing import Any, Optional, TypedDict


class CandleInput(TypedDict):
    open: float
    high: float
    low: float
    close: float
    volume: float


class IndicatorEngineStatus(TypedDict):
    selected_engine: str
    cpp_available: bool
    fallback_available: bool
    indicators: list[str]
    cpp_import_error: Optional[str]


@dataclass
class IndicatorCalculationRequest:
    close: Optional[list[float]] = None
    candles: Optional[list[CandleInput]] = None
    indicators: list[str] = field(default_factory=list)
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class IndicatorCalculationResult:
    engine: str
    results: dict[str, Any]
