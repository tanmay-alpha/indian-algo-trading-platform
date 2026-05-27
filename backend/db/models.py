# backend/db/models.py

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="VIEWER")  # ADMIN, VIEWER, TRADER_PAPER, TRADER_LIVE_DISABLED_PLACEHOLDER
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class Instrument(Base):
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String, unique=True, index=True, nullable=False)
    symbol = Column(String, index=True, nullable=False)
    name = Column(String, nullable=True)
    expiry = Column(String, nullable=True)
    strike = Column(Float, nullable=True)
    lotsize = Column(Integer, nullable=True)
    instrumenttype = Column(String, nullable=True)
    exch_seg = Column(String, nullable=True)
    tick_size = Column(Float, nullable=True)
    sector = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class Watchlist(Base):
    __tablename__ = "watchlists"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False, default="default")
    created_at = Column(String, nullable=True)
    
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    exch_seg = Column(String, nullable=True)
    created_at = Column(String, nullable=True)
    
    watchlist = relationship("Watchlist", back_populates="items")


class OrderRequestModel(Base):
    __tablename__ = "order_requests"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    client_order_id = Column(String, nullable=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    symbol = Column(String, nullable=True)
    side = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    order_type = Column(String, nullable=True)
    mode = Column(String, nullable=True)
    status = Column(String, nullable=True)
    broker_order_id = Column(String, nullable=True)
    reject_reason = Column(String, nullable=True)
    avg_fill_price = Column(Float, nullable=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


class OrderEventModel(Base):
    __tablename__ = "order_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String, nullable=True)
    event_type = Column(String, nullable=True)
    status = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    broker_order_id = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class OrderFillModel(Base):
    __tablename__ = "order_fills"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fill_id = Column(String, unique=True, index=True, nullable=False)
    request_id = Column(String, nullable=False)
    broker_order_id = Column(String, nullable=True)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)
    filled_quantity = Column(Integer, nullable=False)
    fill_price = Column(Float, nullable=False)
    fees = Column(Float, default=0.0)
    source = Column(String, default="paper")
    created_at = Column(String, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=True)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(String, nullable=False)


class StrategyConfigModel(Base):
    __tablename__ = "strategy_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    template_id = Column(String, nullable=False)
    symbols = Column(String, nullable=False)  # JSON-serialized symbols list/dict
    timeframe = Column(String, nullable=False)
    parameters = Column(String, nullable=False)  # JSON-serialized params dict
    mode = Column(String, nullable=False, default="PAPER")  # PAPER | REVIEW_ONLY
    status = Column(String, nullable=False, default="STOPPED")  # STOPPED | RUNNING | PAUSED | ERROR
    
    # Scheduler & Autopilot fields (PAPER-only autopilot)
    auto_paper_enabled = Column(Boolean, nullable=False, default=False)
    evaluation_interval_seconds = Column(Integer, nullable=False, default=60)
    last_evaluated_at = Column(String, nullable=True)
    next_evaluation_at = Column(String, nullable=True)
    max_signals_per_day = Column(Integer, nullable=False, default=10)
    cooldown_seconds = Column(Integer, nullable=False, default=300)
    
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    signals = relationship("StrategySignalModel", back_populates="strategy", cascade="all, delete-orphan")


class StrategySignalModel(Base):
    __tablename__ = "strategy_signals"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_id = Column(Integer, ForeignKey("strategy_configs.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)  # BUY | SELL | NEUTRAL
    confidence = Column(Float, nullable=True)
    reason = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    timeframe = Column(String, nullable=True)
    source_candle_time = Column(String, nullable=True)
    # Status state machine (PAPER-only platform):
    # GENERATED → APPROVED_PAPER → PAPER_EXECUTED
    # GENERATED → VALIDATED → APPROVED_PAPER → PAPER_EXECUTED
    # GENERATED / VALIDATED / REJECTED → DISMISSED
    # Terminal statuses: PAPER_EXECUTED, DISMISSED, ERROR
    # Forbidden: APPROVED_LIVE, LIVE_EXECUTED
    status = Column(String, nullable=False, default="GENERATED")
    dismiss_reason = Column(String, nullable=True)  # set on DISMISSED transition
    created_at = Column(String, nullable=False)

    strategy = relationship("StrategyConfigModel", back_populates="signals")


class LiveApprovalIntent(Base):
    __tablename__ = "live_approval_intents"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    intent_id = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(String, nullable=False)
    symbol = Column(String, index=True, nullable=False)
    side = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    product_type = Column(String, nullable=False)
    order_type = Column(String, nullable=False)
    source_signal_id = Column(String, nullable=True)
    status = Column(String, nullable=False)
    validation_summary = Column(String, nullable=False)
    rejection_reason = Column(String, nullable=True)

