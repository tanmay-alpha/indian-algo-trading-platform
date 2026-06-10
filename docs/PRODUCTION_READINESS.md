# Production Readiness Checklist

MAET Terminal is production-ready for paper-mode research demos. It is not configured for real-money order execution.

## Code Quality

- [x] CI passes on `main`
- [x] Frontend lint, type-check, tests, and build pass locally
- [x] Backend compile and pytest suite pass locally
- [x] Error boundary exists around the application shell and terminal panels
- [x] Large frontend barrels are partially split into API/store domain entrypoints

## Trust And Product UX

- [x] SEBI and no-advice disclaimer is visible in the footer
- [x] Terminal shows a paper-trading-only banner
- [x] User-facing `/docs` page exists
- [x] Mobile terminal uses a bottom navigation layout at small widths
- [x] Light/dark theme toggle exists

## Security

- [x] Secret scan passes on `main`
- [x] Authentication and authorization tests pass
- [x] TOTP MFA is implemented for enabled users
- [x] Admin routes require JWT admin role or legacy admin token
- [x] Sensitive diagnostic responses are sanitized

## Data

- [x] PostgreSQL is required for production via `DATABASE_URL`
- [x] SQLite remains available only as local/test fallback
- [x] Alembic migrations are reversible
- [x] Database credentials are redacted from health/error responses

## Documentation

- [x] Swagger UI is served at backend `/docs`
- [x] OpenAPI JSON is served at `/openapi.json`
- [x] Deployment and environment docs describe PostgreSQL and MFA
- [x] Security audit notes include OWASP-oriented controls

## Accepted Limits

- Live trading remains intentionally disabled.
- The C++ indicator module is optional in local tests; the Python fallback remains covered.
- Further maintainability work should continue splitting `frontend/store/terminal-store-core.ts` and `frontend/lib/api-client.ts` into true domain slices.
