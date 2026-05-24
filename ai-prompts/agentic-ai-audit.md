# Prompt: Agentic AI Project Audit

> Use to audit an agentic AI project (LangChain, CrewAI, AutoGen, custom agents, MCP).

---

## Task

Audit the agentic AI project at: `[PROJECT_PATH]`

**Agent framework:** `[e.g., LangChain / CrewAI / AutoGen / custom / MCP-based]`

**Main agent capabilities:** `[e.g., web search / code execution / file writes / email / API calls]`

## Safety Audit

### Credential Safety
- [ ] Are LLM API keys (OpenAI, Anthropic, etc.) in `.env` only?
- [ ] Are tool-specific credentials (search APIs, database URLs) in `.env` only?
- [ ] Is `.env` in `.gitignore`?
- [ ] Does CI run with no real API keys? (mock or stub external calls)

### Tool Scope Audit
For each tool the agent can use, verify:
- [ ] What is the minimum permission scope? (read-only vs read-write)
- [ ] Is the tool scope documented?
- [ ] Can the tool send emails or messages to real users?
- [ ] Can the tool modify the filesystem? What paths?
- [ ] Can the tool execute arbitrary code? (this is high risk)
- [ ] Can the tool commit to git? (should require human approval)

### Prompt Injection Risk
- [ ] Is user-provided content ever inserted directly into system prompts?
- [ ] Are tool outputs sanitized before being fed back into the agent?
- [ ] Are there guardrails preventing the agent from being instructed to ignore its rules?

### Autonomy Limits
- [ ] Are there explicit human-in-the-loop checkpoints for irreversible actions?
- [ ] Is there a maximum number of autonomous steps before pausing for human approval?
- [ ] Are all agent actions logged with timestamp and action type?

### Output Safety
- [ ] Is agent output validated before being used downstream?
- [ ] Can the agent produce outputs that would be directly executed (SQL, shell commands)?
- [ ] Are there output length limits to prevent runaway responses?

## CI Safety
- [ ] Does CI mock all external LLM calls?
- [ ] Does CI mock all tool calls that touch external services?
- [ ] Are there fast, deterministic tests that verify agent routing logic?

## Output Format

1. **Tool inventory** (list every tool with its permission scope)
2. **Critical risks** (prompt injection, unbounded tool use, credential exposure)
3. **Autonomy analysis** (where can the agent act without human review?)
4. **Recommended guardrails** to add
5. **CI mocking strategy** for agent tests
