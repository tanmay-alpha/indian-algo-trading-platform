# Security Audit Prompt

You are auditing this repository as a practical application security reviewer.

## Scope

Perform a security review focused on real risks, not theoretical noise.

## Context

This repo is part of a universal AI/vibe-coding workflow. Security must work across many project types, including:

- Python backend projects
- Node/React projects
- full-stack apps
- static websites
- AI/ML projects
- automation projects
- trading/finance-related projects

## Audit Areas

Check for:

1. Secrets committed to the repo
2. `.env` or local secret files tracked by Git
3. API keys, tokens, passwords, private keys, or credentials in code
4. Unsafe frontend environment variables
5. Hardcoded URLs or tokens
6. Missing `.env.example`
7. Weak `.gitignore`
8. Unsafe logging of sensitive values
9. Insecure CORS or auth assumptions
10. Dangerous deployment defaults
11. Missing secret scanning
12. Missing dependency or CI checks

## Security Rules

- Do not print actual secret values.
- If a secret is found, redact it as `***REDACTED***`.
- Do not recommend committing any real credentials.
- Do not recommend putting backend secrets in frontend public env vars.
- Do not recommend disabling security checks just to make tests pass.
- Do not fabricate scan results.

## Required Checks

If possible, inspect:

- `.gitignore`
- `.env.example`
- `.github/workflows`
- package files
- requirements files
- config files
- backend settings/config modules
- frontend environment usage
- logging files
- deployment config

## Output Format

Use this format:

1. Executive Risk Summary
2. Critical Issues
3. High-Risk Issues
4. Medium-Risk Issues
5. Low-Risk Issues
6. Files That Need Changes
7. Recommended Fix Plan
8. Commands To Run Locally
9. Safe Commit Message

## Local Commands To Consider

```powershell
git status
git secrets --scan
git ls-files | Select-String ".env"
```
