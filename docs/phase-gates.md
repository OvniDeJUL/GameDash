# Phase Gates

## Purpose

Define objective pass/fail gates for each roadmap phase.

A phase is considered complete only when:

- the roadmap scope for that phase is implemented
- the gates below pass on the current branch
- the mandatory validation suite is green

This file derives implementation gates from `docs/03-roadmap-gamedash.md`. The roadmap remains the source of truth for scope and ordering.

## Cross-phase rules

Every phase that changes behavior must also update the relevant:

- API implementation
- data model and migrations
- shared contracts
- OpenAPI contract
- tests
- technical docs
- fallback or realtime docs when applicable

Every phase must preserve:

- REST API under `/api/v1`
- role boundaries `player`, `staff`, `admin`
- audit logging for critical actions
- security baseline rules

## Phase 0 gate - Cadrage et socle

Pass when all of the following are true:

- monorepo structure exists and is coherent
- `apps/api` and `apps/web` are present and buildable
- `contracts/openapi.yaml` exists and is maintained
- `prisma/schema.prisma` exists and is maintained
- shared contracts package exists and is consumed by API and web
- base docs exist for scope, backlog, security, decisions, risks, realtime fallback, and local setup
- repository scripts exist for `build`, `lint`, `typecheck`, `test`, `validate:openapi`, and `validate:prisma`

## Phase 1 gate - Identite, Auth, RBAC

Pass when all of the following are true:

- registration, login, refresh, and logout are implemented under `/api/v1/auth`
- passwords are hashed and never stored or echoed in plaintext
- access and refresh token flow is implemented
- refresh tokens are revocable server-side
- roles `player`, `staff`, and `admin` are enforced in code
- player profile baseline exists with pseudo, avatar, region, and bio at minimum
- sensitive auth and admin actions write audit logs
- endpoints are secured and tested

## Phase 2 gate - Matchmaking, matchs, MMR, rangs

Pass when all of the following are true:

- multi-mode queues exist for ranked, unranked, and fun
- player state transitions are represented across online, queue, and match
- simulated match attribution exists
- match result submission persists a match outcome
- MMR update logic exists and is applied after match results
- MMR to rank mapping is configurable
- match history can be queried with stable payloads
- player-facing progression views for MMR and ranks exist in the UI
- MMR updates write audit logs

## Phase 3 gate - Progression, XP, niveaux

Pass when all of the following are true:

- XP is awarded after match completion
- account level is persisted and exposed
- level progression is visible on the player surface
- level-up rewards are modeled and granted
- progression rules are covered by tests
- if quests are implemented, they remain optional and documented as optional

## Phase 4 gate - Economie, boutique, inventaire

Pass when all of the following are true:

- soft and hard currency are modeled explicitly
- store catalog is persisted and queryable
- wallet balances are persisted and queryable
- purchase flow updates wallet, inventory, and transaction history consistently
- transaction journal is immutable or append-only by design
- simulated payment behavior is documented when used
- economy actions write audit logs
- transaction integrity is covered by tests

## Phase 5 gate - UGC maps communautaires

Pass when all of the following are true:

- map creation flow exists with metadata, tags, and status
- map versioning exists with release notes
- votes, tests, favorites, and search are implemented
- popularity score uses votes, tests, and recency with documented rules
- creator and map stats are available
- map publish and update actions write audit logs
- moderation-relevant data exists for later backoffice use

## Phase 6 gate - Backoffice studio

Pass when all of the following are true:

- admin dashboard exposes the core KPIs from the project baseline
- settings exist for matchmaking, MMR, and economy tuning
- moderation actions exist for accounts and maps
- moderation history and reporting or signals are represented
- admin and staff permissions are enforced
- moderation and settings actions write audit logs
- studio workflows are usable end-to-end

## Phase 7 gate - Durcissement qualite et securite

Pass when all of the following are true:

- integration coverage exists for critical user and admin flows
- error handling is consistent and documented
- observability is sufficient to diagnose critical failures
- permissions and logging rules are reviewed and enforced
- baseline performance bottlenecks have been addressed or documented
- the repository is stable under the mandatory validation suite

## Phase 8 gate - Livraison et soutenance

Pass when all of the following are true:

- technical documentation exists for API, database, security, and setup
- an initial user guide exists
- demo script or demo guide exists
- business viability checklist exists
- the repository is in a demonstrable state with the validation suite green
