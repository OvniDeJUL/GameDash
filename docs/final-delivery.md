# GameDash Final Delivery

## Purpose

This document is the entrypoint for the final delivery package. It links the technical, user, demo, business, and grading-readiness material required for the final review.

## Delivery status

- Roadmap phase: Phase 9 - Finition notation et prochaine iteration.
- MVP state: demonstrable end-to-end baseline.
- Validation gate: build, lint, typecheck, tests, OpenAPI validation, and Prisma validation must be green before the demo.
- Runtime scope: in-memory MVP services backed by Prisma/OpenAPI contracts for the production persistence target.

## Final package

| Need | Document |
|---|---|
| Product and scope | `docs/mvp-scope.md` |
| Roadmap and phase gates | `docs/03-roadmap-gamedash.md`, `docs/phase-gates.md` |
| Technical API, DB, security, setup | `docs/technical-handbook.md` |
| Local setup | `docs/local-setup-native.md` |
| Security and hardening | `docs/security-baseline.md`, `docs/quality-security-hardening.md` |
| Realtime and fallback | `docs/event-catalog.md` |
| User guide | `docs/user-guide.md` |
| Demo and video script | `docs/demo-guide.md` |
| Defense runbook | `docs/soutenance-runbook.md` |
| Business viability | `docs/business-viability-checklist.md` |
| Final review and grading readiness | `docs/phase-9-final-review.md` |
| Requirements traceability | `docs/requirements-traceability-matrix.md` |
| Next implementation iteration | `docs/next-iteration-plan.md` |
| Risks and decisions | `docs/risk-register.md`, `docs/decision-log.md` |

## Demo readiness checklist

- `corepack pnpm install` has been run.
- `corepack pnpm build` passes.
- `corepack pnpm lint` passes.
- `corepack pnpm typecheck` passes.
- `corepack pnpm test` passes.
- `corepack pnpm validate:openapi` passes.
- `corepack pnpm validate:prisma` passes.
- API can start with `corepack pnpm --filter @gamedash/api dev`.
- Web can start with `corepack pnpm --filter @gamedash/web dev`.
- `GET http://localhost:3001/api/v1/health` returns status `ok`.
- Web demo loads at `http://localhost:3000`.

## Recommended review flow

1. Open this file to show delivery structure.
2. Run the validation suite to prove repository health.
3. Open the web app and walk through the visible player and studio surfaces.
4. Use `docs/demo-guide.md` for the live demo sequence.
5. Use `docs/technical-handbook.md` for API, database, security, and setup questions.
6. Use `docs/requirements-traceability-matrix.md` to answer cahier des charges coverage questions.
7. Finish with `docs/business-viability-checklist.md` and `docs/next-iteration-plan.md` to show product viability and next steps.
