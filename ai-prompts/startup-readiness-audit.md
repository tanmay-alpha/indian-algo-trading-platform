# Prompt: Startup Readiness Audit

> Use to assess whether a project is ready to graduate from personal/prototype to startup-grade.

---

## Task

Assess the startup readiness of: `[PROJECT_PATH]`

**Target stage:** `[Pre-seed / Seed / Series A equivalent]`
**Target users:** `[Number and type of users you plan to onboard]`

## Readiness Dimensions

### 1. Engineering Reliability (Score: /10)
- [ ] CI/CD is automated and passing
- [ ] Rollback is possible within 5 minutes
- [ ] Health checks exist on all services
- [ ] Error rates and latency are monitored
- [ ] Database backups are automated and tested

### 2. Security Posture (Score: /10)
- [ ] No secrets in git history
- [ ] All inputs validated server-side
- [ ] Authentication is standard and tested
- [ ] Dependencies are audited for CVEs
- [ ] Secret scanning is in CI

### 3. Scalability (Score: /10)
- [ ] Would this handle 10x current load?
- [ ] Are there obvious bottlenecks? (single-threaded, no caching, N+1 queries)
- [ ] Is the database connection pool configured?
- [ ] Are expensive operations async or queued?

### 4. Observability (Score: /10)
- [ ] Structured logging in place
- [ ] Errors tracked (Sentry or equivalent)
- [ ] Key metrics visible (latency, error rate, queue depth)
- [ ] Alerts configured for critical failures

### 5. Documentation (Score: /10)
- [ ] README is complete and accurate
- [ ] API is documented
- [ ] Architecture decisions recorded
- [ ] Runbook exists for common failures

### 6. Team / Process (Score: /10)
- [ ] Code review process exists
- [ ] No single-developer bus factor on critical paths
- [ ] On-call rotation or clear ownership defined
- [ ] Incident response process documented

## Output Format

1. **Scorecard** (each dimension with score and 2-sentence rationale)
2. **Top 3 blockers** to startup readiness
3. **Top 3 quick wins** (high impact, low effort)
4. **Estimated time to address** blockers
5. **Go / No-Go recommendation** with conditions
