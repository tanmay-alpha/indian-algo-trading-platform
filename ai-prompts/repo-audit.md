# Prompt: Repository Audit

> Paste this prompt to an AI agent when you want a comprehensive audit of a repository.

---

## Task

You are auditing the repository at: `[PROJECT_PATH]`

Before starting, read:
1. `PROJECT_MAP.md` (if it exists)
2. `README.md`
3. `AI_WORKFLOW_CONTEXT.md` or `AGENTS.md` (if they exist)

## What to Audit

### 1. Code Quality
- Are there obvious code smells, dead code, or duplicated logic?
- Are there files that are clearly too large or doing too many things?
- Are there functions with no docstring or unclear purpose?

### 2. Security
- Are there hardcoded credentials, API keys, or tokens anywhere?
- Is `.env` in `.gitignore`?
- Are there SQL queries using string interpolation instead of parameterization?
- Is user input validated server-side?

### 3. Testing
- What percentage of critical paths have tests?
- Are tests deterministic and isolated?
- Are there obviously missing test cases?

### 4. CI/CD
- Does a CI workflow exist?
- Does CI install dependencies correctly?
- Does CI run tests?
- Does CI avoid requiring live API keys or broker credentials?

### 5. Dependencies
- Are there obviously outdated or known-vulnerable packages?
- Are lock files committed?

### 6. Documentation
- Is the README complete and accurate?
- Is setup clearly documented?

## Output Format

Provide:
1. **Summary** (3-5 sentences on overall health)
2. **Critical Issues** (must fix before production)
3. **Warnings** (should fix)
4. **Suggestions** (nice to have)
5. **Estimated effort** to address critical issues

Do not make changes. This is read-only analysis only.
