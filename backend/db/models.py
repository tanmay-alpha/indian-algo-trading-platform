# backend/db/models.py

from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from backend.core.database import Base

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
    name = Column(String, unique=True, index=True, nullable=False)
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
