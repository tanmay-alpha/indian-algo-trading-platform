# Prompt: Shipd Challenge Authoring

> Use this prompt when creating a verifiable coding challenge from a real repository.

---

## Task

Create a coding challenge from the following repository: `[REPO_URL or PATH]`

**Target difficulty:** `[Easy / Medium / Hard]`
**Target skill area:** `[e.g., API design / async Python / data pipeline / error handling]`
**Estimated solve time:** `[e.g., 30 min / 2 hours]`

## Challenge Authoring Workflow

### Step 1: Repository Analysis (Read-Only)
1. Clone or access the repository
2. Read the README and understand what the project does
3. Read the main source files
4. Identify 3–5 candidate issues or improvements that would make a good challenge:
   - A real bug that could be fixed
   - A missing feature that is well-scoped
   - A performance problem with a clear fix
   - A security issue that is educational to fix

### Step 2: Select the Challenge
Select one issue that meets these criteria:
- [ ] Solvable in the target time frame
- [ ] Requires meaningful code understanding (not just a config change)
- [ ] Has a deterministic, testable solution
- [ ] Does not require external credentials or live APIs
- [ ] Can be reproduced with a pinned commit hash

### Step 3: Problem Description
Write the challenge description:
- **Title:** [Clear, action-oriented title]
- **Context:** [Explain the system without spoiling the solution]
- **Task:** [Precise description of what the solver must implement/fix]
- **Constraints:** [Language version, libraries allowed, time limit]
- **Examples:** [Input/output examples or test cases the solver can run]

### Step 4: Test Design
Create deterministic tests:
- Tests must FAIL on the original code
- Tests must PASS with the correct solution
- Tests must NOT require external network calls
- Tests must NOT require environment variables with real values
- Tests must run in under 30 seconds

### Step 5: Reference Solution
- Create a minimal patch that passes all tests
- Do not gold-plate the solution
- Document WHY this is the correct fix

### Step 6: Sanitization
Before publishing:
- [ ] Remove all references to private user data
- [ ] Remove all credentials and API keys
- [ ] Remove internal company context
- [ ] Verify tests pass on a clean environment
- [ ] Verify the Dockerfile builds and runs tests correctly

## Output Format

Provide:
1. **Challenge title and description** (ready to copy-paste)
2. **Test file** (language-appropriate, ready to use)
3. **Reference solution patch** (diff format)
4. **Dockerfile** for the test environment
5. **Submission checklist** (all items checked)
