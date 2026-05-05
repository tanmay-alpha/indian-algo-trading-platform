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
- `DB_PATH`
- `LOG_LEVEL`
- `LOG_DIR`
- `HOST`
- `PORT`

## Frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

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
