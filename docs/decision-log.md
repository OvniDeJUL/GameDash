# Decision Log

## 2026-03-31
- Locked stack: Next.js (web) + NestJS (api).
- Locked workspace: pnpm + turborepo monorepo.
- Locked contracts strategy: OpenAPI first + shared TypeScript contracts package.
- Locked auth baseline: email/password + JWT access/refresh.
- Locked data baseline: PostgreSQL + Prisma + Redis.
- Locked realtime baseline: WebSocket namespaces with polling fallback.
- Locked target quality: MVP demo robuste.
- Locked CI posture for now: no CI in this phase.

## 2026-04-27
- Phase 1 auth runtime uses in-memory storage until Prisma repositories are wired in a later persistence pass.
- Passwords are hashed with PBKDF2-SHA512, access tokens are HMAC-signed, and refresh tokens are hash-stored and revocable.
- Admin dashboard access is restricted to `staff` and `admin` roles through Nest guards.

## 2026-06-11
- Phase 2 matchmaking/MMR runtime uses in-memory queues, matches, ratings, histories, and MMR audit entries until Prisma repositories are wired in a later persistence pass.
- Matchmaking creates a simulated match when two authenticated players join the same mode queue.
- MMR deltas are mode-specific for MVP: ranked (+32/-24), unranked (+10/-8), fun (+5/-4).
- Rank mapping is exposed as read-only configuration through the player API baseline.
- Phase 3 progression runtime uses in-memory account progression, level reward configuration, reward grants, and XP audit entries until Prisma repositories are wired in a later persistence pass.
- XP is awarded from accepted match results using mode base XP plus outcome bonus XP: ranked 120, unranked 90, fun 60, win 60, draw 40, loss 25.
- Account levels use cumulative XP thresholds; level-up rewards are granted once per player and reward code.
- Quests remain out of scope for Phase 3 and are documented as optional future scope.
