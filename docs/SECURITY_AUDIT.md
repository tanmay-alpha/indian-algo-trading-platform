# MAET Terminal Security Audit

Scope scanned:

- `backend/**/*.py`
- `frontend/**/*.ts`
- `frontend/**/*.tsx`

Findings:

- No hardcoded credential exposure found in scanned source files.
- Frontend `npm audit` currently reports zero vulnerabilities.

Remediations applied:

- `backend/core/security.py` redacts sensitive response values recursively.
- `backend/api_server.py` sanitizes health/status diagnostics and exposes explicit Swagger/OpenAPI docs.
- `backend/routers/auth.py` supports TOTP MFA setup, enable, disable, and login verification.
- `backend/core/database.py` redacts database URLs and database error details.
- Frontend trust UI shows paper-mode and SEBI disclaimer surfaces across landing, docs, and terminal.

OWASP review notes:

- Authentication: JWT auth remains enforced for protected user routes; admin routes accept JWT admin role or legacy admin token.
- MFA: TOTP is optional per user and enforced at login when enabled.
- Secrets: `.env` files and runtime data remain ignored; CI secret scan is required on `main`.
- Sensitive data exposure: health and database responses are sanitized before returning to clients.
- Security misconfiguration: production database health requires a PostgreSQL `DATABASE_URL`.

Notes:

- Ignored local environment files were not inspected.
- Do not commit `.env` files, credential-bearing logs, broker tokens, or generated runtime databases.
