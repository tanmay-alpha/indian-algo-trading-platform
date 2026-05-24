# Prompt: Architecture Review

> Use when reviewing the overall architecture of a project or proposing architectural changes.

---

## Task

Review the architecture of: `[PROJECT_PATH]`

**Goal of review:** `[e.g., scale to 10x traffic / add async job processing / migrate to microservices]`

## What to Analyze

1. Read `PROJECT_MAP.md`, `README.md`, and any ADRs in `docs/adr/`
2. Understand the current architecture:
   - How is the system structured? (monolith / microservices / serverless)
   - What are the main data flows?
   - What are the main dependencies between components?
   - Where are the single points of failure?
3. Map the bottlenecks for the stated goal

## Architecture Review Framework

### Current State
- What exists today?
- What works well?
- What are the pain points?

### Target State (for the stated goal)
- What needs to change?
- What can stay the same?

### Gap Analysis
- What is the delta between current and target?
- What is the risk of each change?
- What is the recommended sequence of changes?

### Trade-offs
- What does the proposed architecture optimize for?
- What does it sacrifice?
- What are the failure modes?

## Output Format

1. **Current Architecture Summary** (diagram in ASCII or mermaid if helpful)
2. **Strengths** of current architecture
3. **Weaknesses / bottlenecks** (relative to the goal)
4. **Proposed Changes** (ordered by priority and risk)
5. **ADR draft** for the most significant decision
6. **Open Questions** that need human input before proceeding
