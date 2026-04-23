# Local Setup (Native PostgreSQL + Redis)

This project intentionally uses native local installs (no Docker) for now.

## 1. Requirements
- Node.js >= 20
- pnpm via Corepack (`corepack pnpm`) or a local pnpm install
- PostgreSQL (local service)
- Redis (local service)

## 2. Environment
Copy values from `.env.example` and adjust credentials if needed.

Minimum required:
- `DATABASE_URL`
- `REDIS_URL`
- JWT secrets

## 3. PostgreSQL health checks
Example commands:
```bash
psql -h localhost -U postgres -d postgres -c "select version();"
psql -h localhost -U postgres -d gamedash -c "select now();"
```

## 4. Redis health checks
Example command:
```bash
redis-cli ping
```
Expected output: `PONG`

## 5. Install and validate project
```bash
corepack pnpm install
corepack pnpm validate:openapi
corepack pnpm validate:prisma
corepack pnpm lint
corepack pnpm typecheck
```

## 6. Run apps
```bash
corepack pnpm --filter @gamedash/api dev
corepack pnpm --filter @gamedash/web dev
```

API health:
`GET http://localhost:3001/api/v1/health`
