# Backend Debug Prompt

You are debugging this backend as a senior backend engineer.

## Main Rule

Find the root cause. Do not randomly rewrite code.

## Context

This backend may be part of any project in my universal AI/vibe-coding workflow, including:

- FastAPI backend
- Flask backend
- Node backend
- automation service
- AI/ML API
- trading/finance backend
- hackathon backend

## Debugging Goal

Analyze the issue, identify the root cause, and propose the smallest safe fix.

## Required Workflow

1. Read the error message carefully.
2. Identify the failing command, route, test, or module.
3. Inspect only relevant files first.
4. Trace the flow from entry point to failure.
5. Identify whether the issue is:
   - import error
   - missing dependency
   - config/env issue
   - path issue
   - schema/model mismatch
   - async bug
   - database issue
   - API contract mismatch
   - test setup issue
   - deployment/runtime issue
6. Propose minimal fix.
7. Do not change unrelated modules.
8. Run the smallest relevant validation command.

## Safety Rules

- Do not ask for real secrets.
- Do not print `.env` values.
- Do not hardcode credentials.
- Do not disable tests to make the build pass.
- Do not fake backend responses unless explicitly asked for mock/demo mode.
- Do not create production shortcuts.

## Useful Commands

For Python:

```powershell
python -m compileall .
pytest -q
python -B -c "import app; print('import ok')"
```
