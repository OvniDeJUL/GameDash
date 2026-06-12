# Quality and Security Hardening

## Phase 7 baseline

Phase 7 turns the MVP into a demonstrable build by adding runtime guardrails around the critical flows already delivered in phases 1 to 6.

## Error handling

- HTTP failures use one response envelope: `{ error: { code, message, statusCode, timestamp, path, requestId } }`.
- `x-request-id` is accepted from clients when present and generated server-side otherwise.
- Unknown request fields are rejected by the global validation pipe.
- RBAC failures now raise an explicit `403 Forbidden` error instead of returning an implicit guard failure.

## Observability

- Every HTTP request records method, path, status, request id, and duration.
- Exceptions record code, message, status, path, request id, and timestamp.
- `GET /api/v1/health` exposes runtime status, uptime, health checks, request counts, error counts, and p95 latency.
- A `RuntimeEvent` Prisma model represents the persistence target for production-grade runtime events.

## Integration coverage

The phase 7 critical-flow test covers:

- player registration and token verification
- ranked queue match creation and result submission
- MMR and XP audit coverage
- wallet purchase acceptance and rejection
- map publish, versioning, vote, test, favorite, search, and audit coverage
- studio settings update and moderation history/audit coverage

## Permission and logging review

- `staff` and `admin` boundaries remain enforced on studio routes.
- Settings writes stay admin-only.
- Player-owned flows continue to require a bearer token.
- Critical actions retain audit coverage: auth, profile, MMR, XP, purchases, map publish/update, settings, and moderation.

## Known production follow-up

- Replace in-memory observability with durable `RuntimeEvent` writes.
- Add structured log export to the deployment platform.
- Add real integration tests against a running HTTP server once the persistence layer replaces the in-memory repositories.
