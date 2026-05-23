---

# 5. `templates/prompts/frontend-qa.md`

```markdown
# Frontend QA Prompt

You are testing this frontend as a first-time user, frontend engineer, and product reviewer.

## Main Rule

Be honest. Do not pretend broken UI is working.

## Context

This repo is part of my universal AI/vibe-coding workflow. The same QA method should work for:

- static websites
- React apps
- Next.js apps
- dashboards
- admin panels
- trading terminals
- hackathon demos
- startup MVPs

## Testing Goals

Evaluate:

1. First impression
2. Navigation
3. Responsiveness
4. Broken links
5. Broken buttons
6. Console errors
7. Network errors
8. Loading states
9. Empty states
10. Placeholder content
11. Fake data risk
12. Accessibility basics
13. Mobile layout
14. SEO basics
15. Deployment readiness

## User Testing Checklist

Open the app like a new user.

Check:

- Does the homepage explain what this is?
- Is the main CTA clear?
- Are links working?
- Are forms validated?
- Are loading states useful?
- Are errors understandable?
- Does the layout break on mobile?
- Is there fake or placeholder content?
- Does anything look unfinished?
- Does the app feel trustworthy?

## Technical Checklist

Check:

- Browser console errors
- Failed network requests
- Wrong API URLs
- CORS errors
- Broken image paths
- Missing alt text
- Layout overflow
- Hydration errors
- Build errors
- Unused routes/pages
- Placeholder metadata
- Wrong Open Graph data

## Rules

- Do not suggest fake testimonials.
- Do not suggest fake screenshots.
- Do not suggest fake metrics.
- Do not hide broken features.
- If a feature is not working, say so directly.
- Recommend removing or hiding unfinished UI if needed.

## Output Format

Use:

1. First Impression
2. What Works
3. What Looks Broken
4. UX Issues
5. Technical Issues
6. Mobile/Responsive Issues
7. Trust/Professionalism Issues
8. Priority Fixes
9. Exact Files Likely Needing Changes
10. Prompt For Codex/Cline To Fix
```
