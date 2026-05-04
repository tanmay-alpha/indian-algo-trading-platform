# Credential Rotation Guide

This guide uses placeholder environment variable names only. Do not add real credential values to documentation, source files, logs, screenshots, or tickets.

## 1. When To Rotate

Rotate Angel One credentials when:

- A secret may have been exposed in logs, screenshots, chat, commits, or deployment output.
- A team member or machine no longer needs access.
- A scheduled security rotation window arrives.
- Broker login behavior suggests an old session or token is compromised.

## 2. Generate New Angel One Credentials

1. Sign in to the Angel One developer/account portal.
2. Generate or replace the API key for the MAET Terminal app.
3. Reset the authenticator/TOTP setup if the one-time-code secret may be exposed.
4. Confirm the new credential set is active before replacing deployment variables.

Use these placeholder variable names:

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_CODE`
- `ANGEL_PASSWORD`
- `ANGEL_TOTP_SECRET`

## 3. Update Render Environment Variables

1. Open the Render dashboard.
2. Select the MAET backend service.
3. Go to Environment.
4. Update the credential variables with the new values.
5. Save changes and redeploy the service.

Never paste credential values into deploy logs or source control.

## 4. Update Local `.env`

1. Open your local `.env` file only on your development machine.
2. Replace the old values for the Angel One variables.
3. Keep `.env` untracked. The repository should only contain `.env.example`.

## 5. Verify Rotation

After redeploy or local restart:

1. Call `GET /health`.
2. Confirm the response is sanitized and does not expose tokens or passwords.
3. Confirm broker status reports `logged_in: true` when login succeeds.
4. Confirm `GET /terminal/status` remains sanitized.

## 6. If Rotation Fails

1. Re-check variable names and values in Render or local `.env`.
2. Confirm the Angel One app/API key is active.
3. Confirm the TOTP secret is current and system time is synchronized.
4. Redeploy/restart the backend.
5. If credentials may be exposed, rotate again and invalidate old sessions where supported.
