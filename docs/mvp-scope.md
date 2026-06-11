# MVP Scope - GameDash

## In scope

### Auth and identity
- Register, login, refresh, logout.
- Role model: `player`, `staff`, `admin`.
- Player profile baseline (pseudo, avatar, region, bio).

### Competitive loop
- Queue join/leave/status by mode.
- Match result submission.
- Player MMR read endpoint.
- Player match history endpoint.

### Progression loop
- XP awarded after match completion.
- Account level read endpoint.
- Level reward configuration and granted rewards.

### Economy loop
- Store item listing.
- Wallet read.
- Purchase transaction baseline.
- Inventory baseline in data model.

### UGC maps loop
- Create map.
- Create map version.
- Vote map.
- Mark map test.
- Browse maps.

### Studio/admin baseline
- Admin dashboard placeholder endpoint.
- Admin sanctions/moderation represented in schema and contracts.
- Audit log baseline represented in schema and docs.

## Explicit non-goals (phase 0 foundation)
- Full gameplay integration.
- Real payment processing.
- Full moderation workflow UI.
- Season systems and notifications.
- Deep analytics and advanced anti-cheat logic.

## MVP acceptance criteria by module

### Auth
- All auth routes exist under `/api/v1/auth`.
- JWT contract is explicit in OpenAPI.
- Security baseline rules are documented.
- Player profile routes exist under `/api/v1/players/me/profile`.
- Staff/admin role enforcement is represented on protected admin routes.

### Matchmaking/MMR
- Queue routes exist and return stable payload contracts.
- Match result route exists with typed request payload.
- Player MMR and match history routes exist.
- Phase 2 baseline includes simulated match attribution, runtime MMR updates, rank mapping, and MMR audit entries.

### Progression
- Match result submission awards XP to every participant.
- Player progression endpoint exposes level, lifetime XP, current-level XP, next-level target, and granted rewards.
- Level reward configuration is explicit in shared contracts and API responses.
- Phase 3 baseline does not implement quests; quests remain optional future scope.

### Economy
- Store, wallet, and purchase route contracts exist.
- Currency and transaction enums are defined in Prisma.

### Maps/UGC
- All map baseline routes exist with typed payload contracts.
- Versioning and vote/test entities exist in Prisma schema.

### Backoffice/admin
- Admin baseline route exists.
- Moderation/sanction entities exist in Prisma schema.

### Cross-cutting
- OpenAPI passes lint.
- Prisma schema passes `prisma validate`.
- Shared contracts package exports baseline DTOs.
