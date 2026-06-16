-- MAET Terminal: Market data schema
-- Run this in Supabase SQL Editor (https://app.supabase.com → SQL Editor)
--
-- This schema backs the dual-source market data layer:
--   * yahoo_client.py  → 20-year history for any NSE/BSE stock
--   * angel_client.py  → live ticks during market hours
--   * market_data.py   → Supabase cache with in-memory fallback
--
-- Graceful degradation: the code runs fine WITHOUT this table set up
-- (everything falls back to Yahoo Finance + 5-min in-memory cache).

create extension if not exists pg_trgm;

create table if not exists candles (
  id bigserial primary key,
  symbol text not null,
  exchange text not null default 'NSE',
  yahoo_ticker text not null,
  angel_token text,
  interval text not null,
  time bigint not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null,
  source text not null,
  fetched_at timestamptz default now(),
  unique (symbol, exchange, interval, time, source)
);

create index if not exists idx_candles_lookup
  on candles (symbol, exchange, interval, time desc);

create table if not exists symbol_master (
  symbol text primary key,
  yahoo_ticker text not null unique,
  angel_token text,
  name text not null,
  exchange text not null default 'NSE',
  sector text,
  industry text,
  last_updated timestamptz default now()
);

create index if not exists idx_symbol_sector on symbol_master (sector);

create table if not exists live_quotes (
  symbol text primary key,
  ltp numeric not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  change numeric not null,
  change_pct numeric not null,
  volume bigint not null,
  bid numeric,
  ask numeric,
  source text not null,
  updated_at timestamptz default now()
);

create index if not exists idx_live_quotes_updated
  on live_quotes (updated_at desc);
