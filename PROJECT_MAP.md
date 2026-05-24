# Project Map

**Project Name:** TRADING PROJECT
**Generated on:** 2026-05-24 05:56
**Path:** C:\Users\TANMAY\OneDrive\Desktop\TRADING PROJECT

---

## Project Summary

| Field | Value |
|---|---|
| **Project Name** | TRADING PROJECT |
| **Path** | C:\Users\TANMAY\OneDrive\Desktop\TRADING PROJECT |
| **Detected Type** | fullstack |
| **Recommended CI Preset** | fullstack |
| **Has Backend** | True |
| **Has Frontend** | True |
| **Has Tests** | True |
| **Has Dockerfile** | False |
| **Has GitHub Workflows** | True |
| **Has ML Hints** | True |
| **Has Trading Hints** | True |
| **Has Agentic AI Hints** | True |
| **Has Database Hints** | True |

---

## Paths

| Role | Path |
|---|---|
| Backend | backend |
| Frontend | frontend |
| Python Dep File | requirements.txt |
| Node Package Manager | npm |

---

## Dependency Files

- requirements.txt
- frontend/package.json

---

## Entry Points

- frontend/components/tabs/index.ts
- frontend/components/websocket/index.ts
- frontend/components/workspaces/index.ts

---

## Test Files

- backend/test_integration.py
- cpp/tests/test_indicators.cpp
- tests/conftest.py
- tests/test_candle_store.py
- tests/test_discovery.py
- tests/test_events.py
- tests/test_execution.py
- tests/test_indicator_engine.py
- tests/test_instrument_loader.py
- tests/test_market_gateway.py
- tests/test_market_watch_api.py
- tests/test_observability.py
- tests/test_portfolio.py
- tests/test_security.py
- tests/test_session_manager.py
- tests/test_strategy_backtest.py

---

## GitHub Workflows

- .github/workflows/ci.yml
- .github/workflows/secret-scan.yml

---

## Documentation Files

- PROJECT_MAP.md
- README.md
- .ai-workspace-backup/20260524_055646/PROJECT_MAP.md
- ai-prompts/backend-debug.md
- ai-prompts/cline-mcp-task.md
- ai-prompts/codex-implementation.md
- ai-prompts/frontend-qa.md
- ai-prompts/gemini-repo-analysis.md
- ai-prompts/git-cleanup.md
- ai-prompts/security-audit.md
- cpp/README.md
- deployment/README.md
- docs/APPLY_TO_PROJECT.md
- docs/ARCHITECTURE.md
- docs/CLOUD_RUNBOOK.md
- docs/CODE_CLEANUP_AUDIT.md
- docs/CPP_MIGRATION_PLAN.md
- docs/CREDENTIAL_ROTATION.md
- docs/DAILY_WORKFLOW.md
- docs/DEMO_SCRIPT.md

---

## Important Directories

- .ai-workspace-backup
- .github
- .vercel
- .vscode
- ai-prompts
- backend
- cpp
- deployment
- docs
- frontend
- logs
- scripts
- tests

---

## Ignored / Generated Directories

The following are excluded from this map (generated, deps, build artifacts):

- `.git/`
- `node_modules/`
- `venv/`, `.venv/`
- `dist/`, `build/`, `.next/`, `out/`
- `coverage/`, `htmlcov/`
- `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`
- `uploads/`

---

## Safe Commands to Run

`ash
# Syntax check
python -m compileall backend -q

# Run tests
pytest tests -q

# Install node dependencies
npm ci

# Build frontend
npm run build
`

---

## Do Not Touch

- **`.env`** - Never commit. Contains secrets and credentials.
- **`node_modules/`** - Generated. Run install command instead.
- **`venv/` / `.venv/`** - Generated. Use `pip install -r requirements.txt`.
- **`dist/` / `build/`** - Generated artifacts.
- **Any file containing real API keys, passwords, or tokens.**

---

## Risk Notes

- INFO: .env file detected locally - ensure it is in .gitignore
- TRADING: Broker/order keywords detected - never run order-placing code in CI
- AGENTIC: AI agent keywords found - ensure no live API keys are in CI environment

---

## AI Agent Working Instructions

1. Always read this file before starting work on the project.
2. Understand the detected project type before making any changes.
3. Run syntax/compile checks after any Python edits.
4. Run the test suite if present before marking a task complete.
5. Never write to `.env` files or create files containing real secrets.
6. Never commit generated folders (node_modules, venv, __pycache__).
7. Check CI workflows are valid before pushing.
8. For trading/financial projects: never place real orders in tests or CI.
9. For agentic AI projects: never embed live API keys in CI configuration.
10. Raise a warning if hardcoded credentials are detected anywhere.

---

## Suggested Next Audit Prompts

- "Audit the backend for missing input validation and unsafe defaults."
- "Review all CI workflows for missing secrets or broken steps."
- "Check all API endpoints for authentication and authorization gaps."
- "Identify untested code paths and suggest concrete test cases."
- "Review dependency files for outdated or known-vulnerable packages."
- "Verify .gitignore covers all generated and secret files."
- "Suggest a security hardening checklist for this project type."

