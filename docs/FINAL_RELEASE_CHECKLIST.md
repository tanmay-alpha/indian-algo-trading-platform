# MAET Terminal v2.0 Final Release Checklist

## Code Validation

- [ ] `python -B -c "import backend.api_server; print('api import ok')"`
- [ ] `pytest tests/ -q`
- [ ] `cd frontend && npm run build`
- [ ] C++ test if compiler available: `g++ -std=c++17 -I cpp/include cpp/src/indicators.cpp cpp/tests/test_indicators.cpp -o build_manual_indicator_tests.exe`

## Deployment Validation

- [ ] Vercel latest deployment ready
- [ ] Render latest deployment live
- [ ] `/live` works
- [ ] `/health` works
- [ ] `/ready` works
- [ ] `/terminal/status` works
- [ ] `/ws/status` works
- [ ] `/metrics` works if present
- [ ] Frontend loads
- [ ] Frontend WebSocket connects to `/ws/market_stream`

## Security Validation

- [ ] `.env` not tracked
- [ ] No credentials in docs
- [ ] No admin token in frontend env
- [ ] No live trading enabled
- [ ] PAPER mode default
- [ ] Sensitive routes protected
- [ ] Sanitizer active

## Demo Validation

- [ ] Screenshots captured safely
- [ ] README updated
- [ ] Demo script ready
- [ ] Market closed explanation ready
- [ ] Render cold-start explanation ready

## GitHub Release

Commands:

```bash
git tag -a v2.0-showcase -m "MAET Terminal v2.0 showcase"
git push origin v2.0-showcase
```

## Stop Point

After v2.0-showcase, stop feature work and focus on learning fundamentals.
