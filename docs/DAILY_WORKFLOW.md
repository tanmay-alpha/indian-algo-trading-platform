# Daily AI Development Workflow

This document outlines the recommended daily routine for maintaining a high-velocity, high-quality AI-assisted development cycle.

## Core Mandate: One Heavy Agent At A Time

To prevent RAM exhaustion and context confusion, never run multiple large-context agents or local models simultaneously.

## 1. Start of Session

- **Clean Slate:** Close unnecessary browser tabs and background tools.
- **Sync:** Run git pull and check git status.
- **Check Tools:** Ensure required MCP servers or local models are running correctly.

## 2. Analysis & Planning

- **Define Scope:** What is the specific goal of this session?
- **Research:** Use a large-context assistant to map dependencies or understand existing patterns.
- **Draft Plan:** Write down the steps before editing code.

## 3. Implementation Cycle

Follow the Plan-Act-Validate loop for every sub-task.
- **Small Commits:** Commit after each verified sub-task.
- **Manual Review:** Always read the AI diff before accepting it.

## 4. Validation Phase

- **Local Tests:** Run the full test suite.
- **Workspace Validation:** Run scripts\validate-workspace.ps1 if modifying templates.
- **Secret Scan:** Check for accidental credential leaks.

## 5. End of Session

- **Cleanup:** Stop heavy background tools.
- **Summary:** Note down pending tasks for the next session.
- **Push:** Push verified, committed changes to the remote.
