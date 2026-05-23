# Applying This Workflow To A Project

This guide explains how to apply the AI-assisted development workflow from this toolkit to a new or existing software project.

## Step 1: Choose Your Project Type

Identify the primary stack of your project:
- **Python Backend:** Flask, Django, FastAPI, etc.
- **Node/Frontend:** React, Angular, Vue, Express, etc.
- **Full-Stack:** Combined frontend and backend.
- **Static Website:** HTML/CSS/JS or static site generators.

## Step 2: Apply GitHub Actions Templates

Copy the appropriate CI workflow to your project's `.github/workflows/` directory.

### Example: Python Backend
```powershell
mkdir .github/workflows -Force
copy path/to/ai-workspace/templates/github-actions/python-backend/ci.yml .github/workflows/ci.yml
```

## Step 3: Add Secret Scanning

Always include the secret scan workflow to prevent credential leaks.

```powershell
copy path/to/ai-workspace/templates/github-actions/security/secret-scan.yml .github/workflows/secret-scan.yml
```

## Step 4: Apply Gitignore Template

Select and merge the appropriate `.gitignore` template into your project's `.gitignore` file.

```powershell
cat path/to/ai-workspace/templates/gitignore/python.gitignore >> .gitignore
```

## Step 5: Copy Prompt Templates (Optional)

If your project requires specific AI playbooks, copy relevant prompts from `templates/prompts/` to a local `docs/prompts/` folder in your project.

## Step 6: Validate Local Setup

Ensure your project structure follows the recommended patterns:
- Essential docs in `docs/`
- Local scripts in `scripts/`
- Standard `.env.example` present

## Step 7: Run Local Checks

Before your first push, run local validation and tests to ensure the templates were applied correctly.

```powershell
# Run your project's test suite
pytest
# or
npm test
```

## Step 8: Commit and Push

Once verified, commit the new workflow files and push to your repository.

```bash
git add .github/workflows/ .gitignore
git commit -m "docs: apply ai-assisted workflow templates"
git push origin main
```
