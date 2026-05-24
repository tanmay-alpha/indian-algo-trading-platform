# Prompt: Trading System Safety Audit

> Use before any deployment or live testing of a trading or algo system.

---

## Task

Perform a safety audit of the trading system at: `[PROJECT_PATH]`

**Intended mode:** `[PAPER / LIVE]`

**Broker / Exchange:** `[e.g., Alpaca / IBKR / Binance / Oanda]`

## Critical Safety Checks

### Trading Mode Guard
- [ ] Is `TRADING_MODE` environment variable checked before any order submission?
- [ ] Does the system default to `PAPER` if `TRADING_MODE` is not set?
- [ ] Is there a hard-coded block on live orders in test and CI environments?
- [ ] Are there tests that verify the trading mode guard works?

### Order Safety
- [ ] Are order quantities validated before submission? (no negative, zero, or insanely large quantities)
- [ ] Are price limits validated? (no market orders without price bounds where applicable)
- [ ] Is there a per-trade and per-day risk limit?
- [ ] Is there a maximum position size limit?
- [ ] Is there a kill switch / circuit breaker that halts all trading?

### Credential Safety
- [ ] Are broker API credentials stored in `.env` only? (never in source code)
- [ ] Does CI use paper trading credentials only (or none)?
- [ ] Is `.env` in `.gitignore`?
- [ ] Check git history: `git log --all -p | grep -i "api_key\|secret\|token"`

### Logging and Audit
- [ ] Is every order attempt logged with: timestamp, symbol, side, quantity, price, mode?
- [ ] Are failed orders logged with full error?
- [ ] Is there a daily PnL log for paper trading?
- [ ] Are logs written to a persistent file (not just stdout)?

### CI/CD Safety
- [ ] Does CI set `TRADING_MODE=PAPER`?
- [ ] Does CI set `APP_ENV=test`?
- [ ] Does CI have zero live broker credentials?
- [ ] Would it be possible to accidentally place a live order from CI? (it must be impossible)

## Output Format

1. **CRITICAL** — immediate blockers (must fix before any live testing)
2. **HIGH** — fix before paper trading in production
3. **MEDIUM** — fix before live trading
4. **SUGGESTED** — hardening improvements
5. **Exact code changes** for each critical finding

Do not make changes. This is a read-only safety audit.
