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
- `LIVE_EXECUTION_ENABLED`
- `ALLOW_LIVE_ORDERS`
- `LIVE_APPROVAL_SANDBOX_ENABLED`
- `ALLOWED_ORIGINS`
- `ENVIRONMENT`
- `PUBLIC_BACKEND_URL`
- `HOST`
- `PORT`
- `LOG_LEVEL`
- `LOG_DIR`
- `JWT_SECRET_KEY`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `ADMIN_TOKEN`
- `SYMBOLS`
- `MAX_ORDER_QTY`
- `MAX_ORDER_NOTIONAL`
- `MAX_DAILY_LOSS`

## Database

- `DATABASE_URL` is required in `PRODUCTION` and must point to PostgreSQL.
- `DB_PATH` is a local/test fallback only. If `DATABASE_URL` is not set outside production, the app uses SQLite at `DB_PATH`.
- `DATABASE_ECHO` enables SQL logging for debugging.
- `DATABASE_POOL_SIZE` controls production SQLAlchemy pool size.
- `DATABASE_BACKEND` is optional; the backend is inferred from `DATABASE_URL` when omitted.

Local Postgres example:

```text
DATABASE_URL=postgresql://maet:maet_dev_password@localhost:5432/maet_terminal
```

## Auth And MFA

- `JWT_SECRET_KEY` must be set to a strong secret in every non-local deployment.
- Login supports TOTP MFA when a user has `mfa_enabled=true`.
- MFA setup is exposed through `/auth/mfa/setup`, `/auth/mfa/enable`, and `/auth/mfa/disable`.
- MFA secrets are stored server-side only and must be protected with the same database controls as password hashes.

## Frontend

- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_URL`

`NEXT_PUBLIC_BACKEND_URL` is preferred for new code. `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_URL` remain supported as legacy aliases.

## Expanding Live Market Data Symbols

Set `SYMBOLS` to a JSON array of verified NSE symbols:

```text
SYMBOLS=["SBIN","RELIANCE","INFY","TCS","HDFCBANK","ICICIBANK","AXISBANK","WIPRO","ITC","TATASTEEL"]
```

All symbols must exist in the instrument registry with valid Angel One tokens. The recommended Render Free limit is 15-20 symbols.
