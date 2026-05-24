# Prompt: CI Fix

> Use when GitHub Actions CI is failing and you need an agent to diagnose and fix it.

---

## Task

The CI workflow is failing on: `[branch name]`

**Job name:** `[e.g., python-backend-checks]`
**Failure step:** `[e.g., Install dependencies]`

**Error output (paste relevant lines):**
```
[Paste error here]
```

**Workflow file:** `.github/workflows/ci.yml`

## Debug Approach

1. Read the full workflow file at `.github/workflows/ci.yml`
2. Read the exact failing step
3. Check:
   - Are required files present? (requirements.txt, package.json, etc.)
   - Are paths correct? (working-directory, relative paths)
   - Are environment variables set correctly?
   - Are Python/Node versions compatible with the dependencies?
   - Is the install command appropriate? (`pip install` vs `pip install -r requirements.txt`)

## Rules

- Do NOT add live API keys or secrets to CI
- Do NOT use `continue-on-error: true` to hide failures
- Do NOT remove tests from CI to make it pass
- The fix must work on ubuntu-latest without any local configuration

## Output Format

1. **Root Cause** of the CI failure
2. **Exact change** to `ci.yml` (show as diff)
3. **Any other file changes** needed (e.g., missing requirements.txt)
4. **How to verify** the fix locally before pushing
