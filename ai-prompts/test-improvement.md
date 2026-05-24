# Prompt: Test Improvement

> Use when you want to improve test coverage or test quality.

---

## Task

Improve the tests in: `[PROJECT_PATH]`

**Priority area:** `[e.g., authentication module / order processing / data pipeline]`

## What to Analyze

1. Read all test files in `tests/` or `__tests__/`
2. Read the source code for the priority area
3. Identify:
   - Code paths with no test coverage
   - Tests that only test the happy path
   - Tests with no assertions (meaningless tests)
   - Flaky tests (time-dependent, order-dependent, or network-dependent)
   - Tests that require live external services

## Rules for New Tests

- Tests must be deterministic (same result every run)
- Tests must not require live API keys, database connections, or network
- Mock external calls with `unittest.mock` (Python) or `jest.mock()` (JS)
- Use descriptive test names: `test_should_raise_when_quantity_is_negative`
- Test edge cases: empty input, None/null, max values, invalid types

## Do Not

- Do not add tests that call live APIs
- Do not add tests that write to production databases
- Do not add tests that place real orders (trading projects)
- Do not reduce test quality to increase coverage numbers

## Output Format

1. **Coverage gaps identified** (list functions/paths with no tests)
2. **New tests written** (with code)
3. **Existing tests improved** (with diff)
4. **Mocks added** (for external dependencies)
5. **Run command** to verify all tests pass
