# Performance Baseline

## Phase 7 baseline

The MVP remains in-memory for runtime behavior, so the phase 7 performance work focuses on observability and obvious hot paths rather than infrastructure tuning.

## Measured and exposed signals

- Request count.
- Error count.
- Critical error count.
- Last request timestamp.
- p95 request duration over the latest request samples.
- Health status degraded when a critical runtime error is observed.

## Current bottleneck review

- UGC map listing performs in-memory filtering and sorting. This is acceptable for MVP demo data but must move to indexed database queries before production traffic.
- Audit and moderation history are append-only arrays in runtime services. This is acceptable for a demo process but must move to durable storage for scale and recovery.
- Next.js type generation is now run before web typecheck to avoid unstable validation behavior around generated route types.

## Production follow-up

- Persist runtime events and audits in PostgreSQL with retention policies.
- Add pagination to list endpoints before real data volume.
- Add database indexes matching `prisma/schema.prisma` for map status/popularity, audit action/date, moderation targets, and runtime event source/level/date.
- Add load testing for queue join, match result submission, map browsing, purchase, and admin dashboard reads.
