# Movimento Certo public health checks

Fixed, read-only checks for https://movimentocerto.app and its public aggregate-health endpoint.

The workflow checks the reviewed homepage, browser configuration, script and stylesheet by SHA-256, then validates aggregate endpoint status and freshness. Tests include wrong deadlines, changed assets, unhealthy provider flags and sanitized failures. It never creates Checkout sessions or reads individual customer records. Output contains check names, booleans and static failure reasons.

Standard GitHub-hosted Linux runners run these checks hourly at minute 17 UTC and on explicit dispatch or monitor-source changes. This repository uses no stored service credentials, caches or uploaded build artifacts. Workflow contents access is read-only and official actions are pinned to full commits. GitHub scheduling can be delayed or skipped; public schedules can be disabled after 60 days of repository inactivity. This is limited public-service monitoring, not an uptime guarantee or app/payment acceptance.

Run locally with Node 24 or newer:

```
node --test .github/scripts/public-health.test.mjs
node .github/scripts/public-health.mjs
```

After an actual reviewed website release, copy the changed public fixture assets, update only their reviewed fingerprints, and rerun both commands before publishing. Downloaded website JavaScript is hashed, never executed. The fixed target URLs are not configurable by workflow input.

`exercise_alert` deliberately fails only after real health checks pass and labels the run as a controlled notification exercise. It does not induce a production outage. Notification receipt and calendar-triggered execution need separate actual evidence.

GitHub describes free standard runners for public repositories: https://docs.github.com/en/actions/concepts/billing-and-usage . Larger runners and extra storage have different billing rules; this workflow uses neither.
