# MAET Terminal Environment Variables

This document lists variable names only. Do not commit real values.

## Backend

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_CODE`
- `ANGEL_CLIENT_ID`
- `ANGEL_PASSWORD`
- `ANGEL_TOTP_SECRET`
- `TRADING_MODE`
- `LIVE_TRADING_ENABLED`
- `ALLOWED_ORIGINS`
- `ENVIRONMENT`
- `PUBLIC_BACKEND_URL`
- `DB_PATH` (defaults to `data/trades.db`)
- `DATABASE_URL` (optional PostgreSQL or SQLite url; if set to PostgreSQL, SQLite fallback is bypassed)
- `DATABASE_ECHO` (boolean, defaults to false)
- `DATABASE_POOL_SIZE` (optional integer for pool size; bypassed during migrations using `NullPool`)
- `DATABASE_BACKEND` (optional backend descriptor string, inferred from `DATABASE_URL` if not set)
- `LOG_LEVEL`
- `LOG_DIR`
- `HOST`
- `PORT`

## Database Configuration

MAET Terminal supports dynamic runtime configuration of the database:
1. **SQLite Local Development**: By default, if `DATABASE_URL` is not set, the app falls back to SQLite using `DB_PATH` or `sqlite:///data/trades.db`. Parents directories are dynamically created during engine initialization.
2. **PostgreSQL Production Runtime**: When `DATABASE_URL` is set, MAET Terminal connects to a Postgres server. It automatically handles `postgres://` to `postgresql://` URI prefix conversion for compatibility with modern SQLAlchemy versions.
3. **Database Health Checks**:
   - Health status can be checked via `/health` or `/ready` endpoints.
   - Connection checks use a configured `connect_timeout` of 5 seconds for Postgres to prevent long blocking hangs.
4. **Credential Security & Redaction**:
   - Database credentials, passwords, and raw database URLs are automatically redacted in responses and exceptions via `sanitize_response` and `sanitize_db_error` utility methods.
   - Any url-encoded or special characters in the database passwords are successfully captured and redacted.
   - If `NullPool` is used during migrations (e.g. within Alembic), `pool_size` is bypassed to avoid initialization failures.

## Frontend

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

`NEXT_PUBLIC_API_BASE_URL` is the preferred frontend API base variable.
`NEXT_PUBLIC_API_URL` remains supported as a legacy alias.

## Expanding Live Market Data Symbols

To subscribe to more symbols on the deployed backend:

1. Go to Render Dashboard -> your backend service -> Environment.
2. Find or add the `SYMBOLS` variable.
3. Set it to a JSON array of verified NSE symbols:

   ```text
   SYMBOLS=["SBIN","RELIANCE","INFY","TCS","HDFCBANK","ICICIBANK","AXISBANK","WIPRO","ITC","TATASTEEL"]
   ```

4. Click Save. Render will redeploy the backend automatically.
5. Verify `GET /health`. `gateway.subscribed_symbols` should list all configured symbols.

All symbols must be present in the instrument registry with valid Angel One tokens. Symbols without tokens are skipped at subscription time. The fallback registry includes 35 verified NSE large-cap tokens.

Maximum recommended symbols on Render Free: 15-20 because of bandwidth and memory limits.
