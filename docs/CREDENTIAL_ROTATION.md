# Credential Rotation Procedure

Use this procedure before public demos, production releases, or whenever credential exposure is suspected.

## Angel One

1. Generate or change the Angel One API credentials from the Angel One developer/account portal.
2. Reset or regenerate the authenticator setup if the one-time-code secret may be exposed.
3. Confirm the new values are active in Angel One before replacing production environment variables.

## Render Environment Variables

Update these variable names in Render. Do not place values in source control or documentation.

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_ID`
- `ANGEL_CLIENT_CODE`
- `ANGEL_PASSWORD`
- `ANGEL_TOTP_SECRET`

After updating:

1. Restart the Render backend service.
2. Verify `GET /health` returns safe app health.
3. Verify `GET /terminal/status` shows `logged_in: true` when broker login succeeds.
4. Verify no response includes API keys, passwords, one-time-code secrets, JWTs, feed tokens, refresh tokens, or session tokens.

## Local Safety

- Never commit `.env`.
- Never paste credential values into issue trackers, chat, screenshots, or logs.
- Rotate credentials before public demos and before production launch.
- If a credential may have been exposed, rotate it immediately and invalidate old sessions where supported.
