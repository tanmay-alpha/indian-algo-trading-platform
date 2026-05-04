# Security Checklist

- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` has no real values
- [ ] No credentials in any `.py`, `.ts`, `.js`, `.json` file
- [ ] CORS allows only the Vercel frontend in production, not wildcard
- [ ] `LIVE_TRADING_ENABLED=false` in production
- [ ] `TRADING_MODE=PAPER` in production
- [ ] `sanitize_response()` applied to `/health`, `/ready`, `/terminal/status`
- [ ] Rate limiting on backtest and fetch routes
- [ ] Admin token set in Render env, or empty for open demo
- [ ] No raw broker API responses exposed via any route
- [ ] `ADMIN_TOKEN` not logged anywhere
- [ ] All tests pass
