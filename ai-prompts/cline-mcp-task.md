# Cline MCP Task Prompt

You are working inside VS Code using Cline and MCP tools.

## Main Rule

Use only the MCP tools needed for this task. Do not activate or depend on unnecessary tools.

## Context

This is part of my universal AI/vibe-coding workflow across multiple projects. Do not assume this is only for one repo.

Available MCP/tool roles may include:

- filesystem: local file inspection and edits
- github: repository operations
- memory: project context
- sequential-thinking: planning complex tasks
- context7: latest library/framework documentation
- firecrawl: web scraping and research
- fetch: URL/document fetching
- git-mcp-server: git-aware operations

## Task

Complete the requested task using the minimum necessary tools.

## Tool Selection Rules

Use:

- filesystem when reading/editing project files
- github only for GitHub repo, PR, issue, or remote operations
- context7 only when current library/framework documentation is needed
- firecrawl/fetch only when web content is needed
- sequential-thinking only for multi-step planning
- memory only if project context needs to be recalled

Do not use every MCP server just because it exists.

## Safety Rules

- Do not expose secrets.
- Do not print `.env` values.
- Do not modify `.env` files.
- Do not perform destructive git operations unless explicitly asked.
- Do not make broad repo-wide changes unless required.
- Do not fabricate test results.
- Do not invent unavailable files or features.

## Required Workflow

1. Identify the smallest set of tools needed.
2. Inspect relevant files.
3. Give a short plan.
4. Make minimal changes.
5. Run validation if possible.
6. Summarize changes.

## Output Format

Return:

1. Tools used
2. Files inspected
3. Files changed
4. Validation performed
5. Result
6. Next safe step
