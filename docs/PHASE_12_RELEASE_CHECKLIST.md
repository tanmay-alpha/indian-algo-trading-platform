# Phase 12 Release Checklist

Suggested tag: `v1.1-indicators`

## Indicator Engine QA

- [ ] C++ core tests pass.
- [ ] Python fallback tests pass.
- [ ] Backend imports without compiled C++ extension.
- [ ] Indicator route tests pass.
- [ ] Full backend test suite passes.
- [ ] Frontend build passes.
- [ ] Vercel frontend builds.
- [ ] Render backend remains safe with Python fallback.

## Safety Checks

- [ ] No credentials touched.
- [ ] `backend/.env` not modified.
- [ ] No broker calls added from indicator code.
- [ ] No live orders placed.
- [ ] LIVE trading remains locked.
- [ ] No fake candle data added.
- [ ] No fake indicator data added.

## Documentation

- [ ] README updated with C++ / Python Indicator Engine section.
- [ ] `docs/ARCHITECTURE.md` updated with Phase 12 data flow.
- [ ] `cpp/README.md` includes CMake, manual `g++`, and pybind11 build instructions.

## Deployment Note

Render may use the Python fallback unless the native C++ extension is compiled during deployment. This is acceptable for staging/demo because `IndicatorEngine` automatically selects the fallback when `maet_cpp_indicators` is unavailable.
