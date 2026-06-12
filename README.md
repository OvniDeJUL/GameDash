# GameDash

GameDash is a unified platform for a competitive online game with community map content.

## Product goal
- Player surface: account, progression, matchmaking, economy, maps.
- Studio surface: monitoring, balancing, moderation, economy, UGC oversight.

## Locked technical baseline
- Monorepo: `pnpm` + `turborepo`
- Web app: Next.js (`apps/web`)
- API app: NestJS (`apps/api`)
- Shared contracts: `packages/contracts`
- Data model baseline: Prisma schema (`prisma/schema.prisma`)
- API baseline: OpenAPI (`contracts/openapi.yaml`)
- API versioning: `/api/v1`
- Realtime baseline: WebSocket namespaces + polling fallback

## Current milestone
Phase 9: final review, grading readiness, and next iteration planning.

Start here for the final review:
- `docs/final-delivery.md`
- `docs/phase-9-final-review.md`
- `docs/requirements-traceability-matrix.md`
- `docs/demo-guide.md`
- `docs/technical-handbook.md`
- `docs/business-viability-checklist.md`
- `docs/next-iteration-plan.md`

## Repository layout
- `apps/web`: player/studio frontend shell
- `apps/api`: REST + WebSocket backend shell
- `packages/contracts`: shared DTO and payload types
- `contracts`: OpenAPI contracts
- `prisma`: DB schema baseline
- `docs`: product, security, risk, backlog, events, setup

## Main commands
```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm validate:openapi
corepack pnpm validate:prisma
corepack pnpm validate:contracts
```

## Local run (minimal)
1. Copy `.env.example` values where needed.
2. Start API: `corepack pnpm --filter @gamedash/api dev`
3. Start Web: `corepack pnpm --filter @gamedash/web dev`
4. Health check: `GET http://localhost:3001/api/v1/health`

## Governance entrypoints
- Execution rules for agents: `AGENTS.md`
- Final delivery package: `docs/final-delivery.md`
- Product scope: `docs/mvp-scope.md`
- Executable backlog: `docs/backlog-mvp.md`
- Security baseline: `docs/security-baseline.md`
- Decision log: `docs/decision-log.md`
- Phase protocol: `docs/phase-protocol.md`
- Phase gates: `docs/phase-gates.md`
