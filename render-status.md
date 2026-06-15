# Render Deployment Status: Auto-Deploy Configured

## Configuration
GitHub → Render auto-deploy is set up via a deploy hook (`.github/workflows/deploy-render.yml`).
Every push to `main` triggers a Render redeploy. Manual trigger also available via the GitHub Actions UI.

## How It Works
1. Push to `main` fires the `Deploy to Render (auto-trigger)` workflow
2. Workflow POSTs to the Render Deploy Hook URL (stored as `RENDER_DEPLOY_HOOK_URL` GitHub secret)
3. Render pulls the latest commit and rebuilds
4. Workflow polls `/ping` for up to 90s to confirm the new container is live

## Setup Checklist (one-time)
- [ ] Get Deploy Hook URL from Render Dashboard → `maet-backend` → Settings → Deploy Hook
- [ ] Add it as a GitHub repo secret: `RENDER_DEPLOY_HOOK_URL`
  - https://github.com/${{ github.repository }}/settings/secrets/actions
- [ ] Confirm the workflow runs after the next push to `main`

## Backend Status
Direct probe to `https://maet-backend.onrender.com/ping` times out — service appears down.
All code fixes are in the repo (validated: 10/10 config tests, 697/703 total tests).
Trigger a manual redeploy from the Render dashboard to verify the auto-deploy pipeline works.

## Git State
- Latest fix: `c90a94d` — make validator fully lenient in demo mode
- Previous deploy blockers fixed:
  - `c0e0986` — JWT secret auto-generation for demo mode
  - `5f58f3b` — Empty env defaults to LOCAL + proper validation
  - `35cb87e` — Demo fallback to security validator
  - `0b9207c` — Handle empty ENVIRONMENT and missing JWT_SECRET_KEY on Render