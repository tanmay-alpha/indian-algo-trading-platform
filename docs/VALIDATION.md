# Workspace Validation

This repository includes a validation script to ensure that the toolkit remains healthy, secure, and ready for public use.

## Why Validation Exists

- **Consistency:** Ensures all required templates and documentation are present.
- **Security:** Scans for potential secrets or sensitive patterns accidentally committed.
- **Public-Readiness:** Checks for forbidden personal or platform-specific wording.
- **Structure:** Verifies that GitHub Action templates have the correct YAML structure.

## When To Run It

- Before committing changes to this repository.
- After adding new templates or documentation.
- Before applying this toolkit to a new project.

## How To Run It

Run the following command from the root of the repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\validate-workspace.ps1
```

## What Is Checked

1. **Required Folders:** Confirms all core directories exist.
2. **Required Files:** Confirms all essential templates and docs exist.
3. **Empty Files:** Identifies files that may have been created but not yet populated.
4. **Markdown Formatting:** Warns about suspicious one-line Markdown files.
5. **GitHub Action Structure:** Checks for mandatory YAML keys (`name:`, `on:`, `jobs:`).
6. **Forbidden Wording:** Searches for personal names, private project names, or platform-specific terms.
7. **Secret Scanning:** Performs basic regex matching for common secret patterns (API keys, tokens, etc.).

## How To Fix Failures

- **Missing Files:** Restore the missing file from a template or backup.
- **Forbidden Wording:** Replace the offending text with generic, public-friendly placeholders.
- **Secret Patterns:** Ensure no real secrets are committed. If a false positive occurs (e.g., in a documentation example), consider reframing the text to avoid the pattern.
- **Empty Files:** Populate the file with useful content or remove it if it is truly unnecessary (and update the validation script).
