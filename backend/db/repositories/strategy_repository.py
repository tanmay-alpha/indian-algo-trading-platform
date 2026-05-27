# backend/db/repositories/strategy_repository.py

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.db.models import StrategyConfigModel, StrategySignalModel

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class StrategyRepository:
    def create_strategy_config(
        self,
        session,
        name: str,
        template_id: str,
        symbols: list[str],
        timeframe: str,
        parameters: dict[str, Any],
        mode: str = "PAPER",
    ) -> StrategyConfigModel:
        now = _utc_now()
        config = StrategyConfigModel(
            name=name,
            template_id=template_id,
            symbols=json.dumps(symbols),
            timeframe=timeframe,
            parameters=json.dumps(parameters),
            mode=mode,
            status="STOPPED",
            created_at=now,
            updated_at=now,
        )
        session.add(config)
        session.commit()
        session.refresh(config)
        logger.info("Created strategy config '%s' (id=%s)", name, config.id)
        return config

    def list_strategy_configs(self, session, status: Optional[str] = None) -> list[StrategyConfigModel]:
        query = session.query(StrategyConfigModel)
        if status is not None:
            query = query.filter(StrategyConfigModel.status == status)
        return query.order_by(StrategyConfigModel.id).all()

    def get_all_strategy_configs(self, session) -> list[StrategyConfigModel]:
        return self.list_strategy_configs(session)

    def get_strategy_config(self, session, strategy_id: int) -> Optional[StrategyConfigModel]:
        return session.query(StrategyConfigModel).filter(StrategyConfigModel.id == strategy_id).first()

    def update_strategy_status(self, session, strategy_id: int, status: str) -> Optional[StrategyConfigModel]:
        config = self.get_strategy_config(session, strategy_id)
        if config is None:
            return None
        config.status = status
        config.updated_at = _utc_now()
        session.commit()
        session.refresh(config)
        logger.info("Updated strategy ID %s status to '%s'", strategy_id, status)
        return config

    def update_strategy_config(self, session, config_id: int, **kwargs) -> Optional[StrategyConfigModel]:
        config = self.get_strategy_config(session, config_id)
        if config is None:
            return None
        for key, value in kwargs.items():
            if key == "symbols" and value is not None:
                config.symbols = json.dumps(value)
            elif key == "parameters" and value is not None:
                config.parameters = json.dumps(value)
            else:
                setattr(config, key, value)
        config.updated_at = _utc_now()
        session.commit()
        session.refresh(config)
        logger.info("Updated strategy config ID %s details: %s", config_id, list(kwargs.keys()))
        return config

    def delete_strategy_config(self, session, config_id: int) -> bool:
        config = self.get_strategy_config(session, config_id)
        if config is None:
            return False
        session.delete(config)
        session.commit()
        logger.info("Deleted strategy config ID %s", config_id)
        return True

    def record_strategy_signal(
        self,
        session,
        strategy_id: int,
        symbol: str,
        side: str,
        confidence: Optional[float],
        reason: Optional[str],
        price: Optional[float],
        timeframe: Optional[str],
        source_candle_time: Optional[str],
        status: str = "GENERATED",
    ) -> StrategySignalModel:
        signal = StrategySignalModel(
            strategy_id=strategy_id,
            symbol=symbol.strip().upper(),
            side=side.strip().upper(),
            confidence=confidence,
            reason=reason,
            price=price,
            timeframe=timeframe,
            source_candle_time=source_candle_time,
            status=status,
            created_at=_utc_now(),
        )
        session.add(signal)
        session.commit()
        session.refresh(signal)
        logger.info("Recorded strategy signal (id=%s) for strategy_id %s, symbol %s, side %s", signal.id, strategy_id, symbol, side)
        return signal

    def list_strategy_signals(self, session, strategy_id: Optional[int] = None, limit: int = 100) -> list[StrategySignalModel]:
        query = session.query(StrategySignalModel)
        if strategy_id is not None:
            query = query.filter(StrategySignalModel.strategy_id == strategy_id)
        return query.order_by(StrategySignalModel.id.desc()).limit(limit).all()

    def get_signals_for_strategy(self, session, strategy_id: int) -> list[StrategySignalModel]:
        return session.query(StrategySignalModel).filter(StrategySignalModel.strategy_id == strategy_id).order_by(StrategySignalModel.id.desc()).all()

    def get_all_signals(self, session, limit: Optional[int] = None) -> list[StrategySignalModel]:
        query = session.query(StrategySignalModel).order_by(StrategySignalModel.id.desc())
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def update_signal_status(self, session, signal_id: int, status: str) -> Optional[StrategySignalModel]:
        signal = session.query(StrategySignalModel).filter(StrategySignalModel.id == signal_id).first()
        if signal is None:
            return None
        signal.status = status
        session.commit()
        session.refresh(signal)
        logger.info("Updated signal ID %s status to '%s'", signal_id, status)
        return signal

    # Compatibility wrappers for the test suite
    def create_config(
        self,
        session,
        name: str,
        template_id: str,
        symbols: list[str],
        timeframe: str,
        parameters: dict[str, Any],
        mode: str = "PAPER",
    ) -> StrategyConfigModel:
        return self.create_strategy_config(session, name, template_id, symbols, timeframe, parameters, mode)

    def get_symbols(self, config: StrategyConfigModel) -> list[str]:
        if not config or not config.symbols:
            return []
        if isinstance(config.symbols, str):
            try:
                return json.loads(config.symbols)
            except Exception:
                return [config.symbols]
        return config.symbols

    def get_parameters(self, config: StrategyConfigModel) -> dict[str, Any]:
        if not config or not config.parameters:
            return {}
        if isinstance(config.parameters, str):
            try:
                return json.loads(config.parameters)
            except Exception:
                return {}
        return config.parameters

    def list_configs(self, session) -> list[StrategyConfigModel]:
        return self.list_strategy_configs(session)

    def get_config_by_id(self, session, strategy_id: int) -> Optional[StrategyConfigModel]:
        return self.get_strategy_config(session, strategy_id)

    def update_status(self, session, strategy_id: int, status: str) -> Optional[StrategyConfigModel]:
        return self.update_strategy_status(session, strategy_id, status)

    def delete_config(self, session, config_id: int) -> bool:
        return self.delete_strategy_config(session, config_id)

    def save_signal(
        self,
        session,
        strategy_id: int,
        symbol: str,
        side: str,
        confidence: Optional[float],
        reason: Optional[str],
        price: Optional[float],
        timeframe: Optional[str],
        source_candle_time: Optional[str],
        status: str = "GENERATED",
    ) -> StrategySignalModel:
        return self.record_strategy_signal(
            session=session,
            strategy_id=strategy_id,
            symbol=symbol,
            side=side,
            confidence=confidence,
            reason=reason,
            price=price,
            timeframe=timeframe,
            source_candle_time=source_candle_time,
            status=status,
        )
