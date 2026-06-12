# Next Iteration Plan

## Objective

Move GameDash from a demonstrable MVP to a deployable pilot without adding optional scope before the production foundations are solid.

## Priority order

1. Persistence and seed data.
2. CI/CD and repeatable validation.
3. Browser E2E tests.
4. Role-aware frontend connected to the API.
5. Durable audit and observability.
6. Deployment preparation.
7. Deeper analytics and product polish.

## Recommended next implementation session

Start with the persistence pass. This gives the largest quality gain because it turns the existing contracts, services, and Prisma schema into durable behavior.

Suggested request:

```text
Implemente la phase 10 persistence et seed data, puis lance la suite complete de validation.
```

## Phase 10 candidate - Persistence and seed data

Goal: replace the main in-memory repositories with Prisma-backed persistence for the critical MVP flows.

Acceptance criteria:

- Auth users, profiles, and refresh tokens persist through Prisma.
- Matchmaking, matches, MMR, progression, wallet, inventory, transactions, maps, moderation, audits, and runtime events have durable repository boundaries.
- Database migrations and seed data are documented and executable.
- Demo seed data covers player, staff, admin, store items, maps, rankings, and moderation samples.
- Tests either use isolated repository adapters or a documented test database strategy.
- The full validation suite remains green.

## Phase 11 candidate - Connected role-aware UI and E2E

Goal: turn the current demonstration surface into a role-aware UI connected to live API calls.

Acceptance criteria:

- Player login/session state drives player pages.
- Staff/admin session state drives studio pages.
- Forms call the API for queue, purchase, map, settings, and moderation flows.
- Loading, empty, and error states use the standard API error envelope.
- Playwright smoke tests cover login, player loop, purchase, map interaction, and admin moderation.

## Phase 12 candidate - Deployment and operations

Goal: make the project deployable as a pilot.

Acceptance criteria:

- GitHub Actions runs build, lint, typecheck, tests, OpenAPI validation, and Prisma validation on every pull request.
- Environment variable contracts are documented per environment.
- PostgreSQL and Redis runtime requirements are explicit.
- Health checks and request ids are wired into deployment diagnostics.
- Audit and runtime event retention policies are documented.

## Scope discipline

Do not start seasons, notifications, advanced anti-cheat, or real payment processing until the persistence, CI, E2E, and deployment foundations are complete.
