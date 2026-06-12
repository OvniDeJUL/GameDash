# Requirements Traceability Matrix

## Purpose

This matrix maps the cahier des charges expectations to concrete repository evidence. It is designed for final review and quick jury questions.

## Traceability

| Requirement | Evidence | Validation | Demo proof | Status |
|---|---|---|---|---|
| Player account creation and login | `apps/api/src/auth`, `contracts/openapi.yaml`, `packages/contracts/src/http.ts`, `prisma/schema.prisma` | `corepack pnpm test`, `corepack pnpm typecheck` | Register/login panel and auth contract | Covered |
| Role boundaries for player, staff, admin | `apps/api/src/auth/roles.guard.ts`, admin controllers, `docs/security-baseline.md` | `corepack pnpm test` | Protected admin/staff explanation | Covered |
| Player profile baseline | `apps/api/src/players`, `PlayerProfile` model, OpenAPI player routes | `corepack pnpm validate:openapi`, `corepack pnpm validate:prisma` | Player profile card | Covered |
| Matchmaking queues | `apps/api/src/matchmaking`, matchmaking DTOs, queue OpenAPI routes | `corepack pnpm test` | Matchmaking card and queue status | Covered |
| Match result and MMR update | `apps/api/src/matchmaking`, `apps/api/src/matches`, `PlayerMmr` model | `corepack pnpm test` | MMR/rank view and match history | Covered |
| XP, levels, and rewards | `apps/api/src/progression`, progression DTOs, Prisma progression models | `corepack pnpm test` | Progression card | Covered |
| Store, wallet, inventory | `apps/api/src/economy`, economy DTOs, wallet/store/inventory models | `corepack pnpm test` | Store, wallet, inventory view | Covered |
| Transaction traceability | Economy transaction journal, `Transaction` model, audit rules | `corepack pnpm test`, `corepack pnpm validate:prisma` | Purchase accepted/rejected explanation | Covered |
| UGC map publication | `apps/api/src/maps`, map DTOs, `GameMap` model | `corepack pnpm test` | Community maps panel | Covered |
| Map versions and release notes | Map version endpoint, `MapVersion` model, OpenAPI map routes | `corepack pnpm validate:openapi` | Map versioning explanation | Covered |
| Votes, tests, favorites, search | Maps service, contracts, OpenAPI, Prisma map interaction models | `corepack pnpm test` | Map activity and search explanation | Covered |
| Popularity and creator stats | Maps service derived stats, `docs/mvp-scope.md` | `corepack pnpm test` | Creator/map stats explanation | Covered |
| Studio dashboard KPIs | `apps/api/src/admin`, admin DTOs, OpenAPI admin routes | `corepack pnpm test` | Studio dashboard panel | Covered |
| Studio settings | Admin settings endpoints, `StudioSetting` model | `corepack pnpm test` | Matchmaking/MMR/economy tuning explanation | Covered |
| Account and map moderation | Admin moderation endpoints, moderation models, audit rules | `corepack pnpm test` | Moderation signals/history panel | Covered |
| Audit logging of critical actions | Security baseline, service audit entries, Prisma `AuditLog` model | `corepack pnpm test` | Show critical-flow test coverage | Covered |
| API under `/api/v1` | Nest bootstrap and OpenAPI paths | `corepack pnpm validate:openapi` | API health and route examples | Covered |
| Standard error and request id | Observability middleware/filter, technical handbook | `corepack pnpm test` | Error envelope example | Covered |
| Runtime health and diagnostics | `apps/api/src/health`, observability service, `RuntimeEvent` model | `corepack pnpm test` | `GET /api/v1/health` | Covered |
| Realtime fallback behavior | `apps/api/src/realtime`, `docs/event-catalog.md` | `corepack pnpm typecheck` | Explain polling fallback | Covered |
| Technical documentation | `docs/technical-handbook.md`, `docs/local-setup-native.md` | Documentation review | Open docs during defense | Covered |
| Security and compliance plan | `docs/security-baseline.md`, `docs/quality-security-hardening.md` | Documentation review | Security talking points | Covered |
| User guide | `docs/user-guide.md` | Documentation review | User journey explanation | Covered |
| Demo and defense preparation | `docs/demo-guide.md`, `docs/soutenance-runbook.md` | Documentation review | Live demo sequence | Covered |
| Business viability | `docs/business-viability-checklist.md` | Documentation review | Product value and risk explanation | Covered |

## Reading strategy for the jury

Use this matrix as the bridge between requirement and proof. If a question challenges a feature, show the relevant row, then open the evidence file and the validation command.
