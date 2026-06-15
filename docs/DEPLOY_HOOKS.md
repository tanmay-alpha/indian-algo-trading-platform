# GitHub → Render Auto-Deploy Setup

This document explains the **one-time setup** needed to wire the repo up to Render's Deploy Hooks so that every push to `main` automatically redeploys the backend.

## Why

Without a deploy hook, every code change requires clicking "Manual Deploy" in the Render dashboard. With it, GitHub → Render deployment is automatic.

## One-time setup (≈ 3 minutes)

### 1. Get the Deploy Hook URL from Render

1. Go to https://dashboard.render.com
2. Click the `maet-backend` service
3. Open the **Settings** tab
4. Scroll to **Deploy Hook**
5. Copy the URL. It looks like:
   ```
   https://api.render.com/deploy/srv-XXXXXXXXXXXXX?key=YYYYYYYYYYYYYYYYYYYYYYYY
   ```

### 2. Add it as a GitHub secret

1. Go to https://github.com/Tanmay-Mangal/maet-terminal/settings/secrets/actions
   (or your repo path: `https://github.com/<owner>/<repo>/settings/secrets/actions`)
2. Click **New repository secret**
3. Name: `RENDER_DEPLOY_HOOK_URL`
4. Value: paste the URL from step 1
5. Click **Add secret**

### 3. Verify the pipeline

Two options:

**Option A — Wait for the next push to `main`:**
- Push any commit
- Go to GitHub → Actions tab → "Deploy to Render (auto-trigger)"
- You should see it run and succeed

**Option B — Trigger manually:**
- Go to GitHub → Actions tab → "Deploy to Render (auto-trigger)"
- Click **Run workflow** → **Run workflow**
- Watch it fire the Render hook

### 4. Watch the build

After the hook fires:
1. Go to https://dashboard.render.com → `maet-backend` → Events tab
2. You should see a new "deploy started" event
3. Wait 30-90s (free tier cold start)
4. The workflow polls `/ping` and reports back when the new container is live

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Workflow fails with `RENDER_DEPLOY_HOOK_URL secret is not set` | Secret missing or misnamed | Re-add with exact name `RENDER_DEPLOY_HOOK_URL` |
| Workflow fails with `unexpected status XXX` | Hook URL wrong, expired, or service deleted | Get a new hook URL from Render dashboard |
| Workflow succeeds but Render doesn't deploy | Hook URL points to wrong service | Check the service ID in the URL matches `maet-backend` |
| Render deploys but `/ping` never returns 200 | Build still running or build failed | Check Render Events tab for build errors |

## Security notes

- **Never commit the Deploy Hook URL.** Anyone with the URL can trigger a deploy (a form of low-impact DoS / log spam).
- Treat it like any other secret — keep it in GitHub Secrets, not in code or .env files.
- If the URL leaks, click **Invalidate** in the Render dashboard and copy a new one.

## Architecture

```
Developer pushes to main
    ↓
GitHub Actions: .github/workflows/deploy-render.yml
    ↓ (POST to RENDER_DEPLOY_HOOK_URL)
Render API → starts new build
    ↓
Render pulls latest commit, builds, restarts service
    ↓
GitHub Actions polls /ping for up to 90s
    ↓
Workflow reports success when backend responds
```

This runs alongside the existing keep-alive workflow (`.github/workflows/keep-alive.yml`) which pings `/ping` every 14 minutes to prevent cold starts.
