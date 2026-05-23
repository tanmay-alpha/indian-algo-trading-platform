---

# 7. `templates/prompts/git-cleanup.md`

````markdown
# Git Cleanup Prompt

You are helping clean and safely prepare a Git repository for commit and push.

## Main Rule

Protect secrets and avoid destructive operations.

## Context

This repo is one project inside my universal AI/vibe-coding workflow. The cleanup process should be safe for any project type.

## Goals

Help me:

1. Understand current Git status
2. Identify changed files
3. Avoid committing secrets
4. Avoid committing generated junk
5. Stage only correct files
6. Write a clean commit message
7. Push safely

## Safety Rules

- Do not recommend `git reset --hard` unless explicitly requested and fully explained.
- Do not recommend deleting files blindly.
- Do not commit `.env`.
- Do not commit tokens, keys, credentials, private files, local database files, or screenshots.
- Do not expose secret values in output.
- If a secret may have been committed, recommend rotation immediately.

## Required Commands

Start with:

```powershell
git status
git diff
git diff --cached
git secrets --scan
```
````
