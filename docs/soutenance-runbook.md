# Soutenance Runbook

## Objective

Provide a short operational checklist for the final defense.

## Before the session

1. Pull the latest `main`.
2. Install dependencies if needed:

```bash
corepack pnpm install
```

3. Run the full validation suite:

```bash
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm validate:openapi
corepack pnpm validate:prisma
```

4. Open the key documents:

- `docs/final-delivery.md`
- `docs/demo-guide.md`
- `docs/technical-handbook.md`
- `docs/business-viability-checklist.md`
- `docs/phase-9-final-review.md`
- `docs/requirements-traceability-matrix.md`

## Start the demo

Terminal 1:

```bash
corepack pnpm --filter @gamedash/api dev
```

Terminal 2:

```bash
corepack pnpm --filter @gamedash/web dev
```

Browser:

```text
http://localhost:3000
```

Health:

```text
http://localhost:3001/api/v1/health
```

## Talking points

- Product: one platform for player lifecycle and studio operations.
- Architecture: Next.js, NestJS, shared contracts, OpenAPI, Prisma.
- Security: RBAC, hashed passwords, refresh rotation, audit logs, standard errors.
- Quality: mandatory validation suite, critical-flow tests, observability.
- Business: progression, economy, UGC, moderation, operational controls.
- Traceability: each cahier des charges expectation has a repository proof and a validation path.

## Expected questions and short answers

### Is this production-ready?

No. It is a demonstrable MVP. The main production step is replacing in-memory repositories with Prisma-backed persistence and adding CI/CD.

### Why simulate payments?

Real payments require compliance and provider integration. The MVP validates wallet debit, inventory grant, transaction journal, and rejection behavior without handling real money.

### How is moderation handled?

The MVP includes moderation signals, account/map actions, append-only moderation history, and audit entries. Production would add automated detection and reviewer queues.

### How are API contracts controlled?

OpenAPI and shared TypeScript DTOs are maintained together. `validate:openapi`, `typecheck`, and service tests are mandatory gates.

### How do you diagnose failures?

Use `x-request-id`, the standard error envelope, `GET /api/v1/health`, runtime metrics, audit logs, and the documented performance baseline.

### What remains after the MVP?

Persistence wiring, CI/CD, browser E2E tests, connected role-aware UI, durable observability, and deployment preparation. These are prioritized in `docs/next-iteration-plan.md`.

## Emergency fallback

If local runtime fails:

1. Show validation suite output.
2. Show `contracts/openapi.yaml`.
3. Show `prisma/schema.prisma`.
4. Show `apps/api/src/quality/critical-flows.spec.ts`.
5. Continue with `docs/demo-guide.md`.
6. Use `docs/requirements-traceability-matrix.md` to keep the defense evidence-driven.
