# Security Baseline

## RBAC
- Roles: `player`, `staff`, `admin`.
- Default role on register: `player`.
- Staff/admin routes must reject non-privileged roles.

## Authentication baseline
- Email + password (hashed, never stored plaintext).
- JWT access token + refresh token.
- Refresh token must be revocable server-side.
- Phase 1 runtime uses PBKDF2-SHA512 password hashes and HMAC-signed access tokens.
- Refresh token values are stored only as hashes and are rotated on refresh.

## Input and output safety
- Validate all payloads at controller boundary.
- Reject unknown fields where possible.
- Sanitize user-generated text before rendering in frontend.

## Audit logging requirements
Critical actions that must be logged:
- Auth: register, login, refresh, logout.
- Profile: player profile update.
- Account sanctions.
- MMR updates after match result.
- Progression XP awards and level-up reward grants.
- Economy transactions.
- Map publish/update and moderation actions.

Phase 2 runtime requirement:
- Match result submission must write one audit entry per participant MMR update.
- MMR audit metadata must include match id, mode, previous MMR, next MMR, delta, previous rank, and next rank.

Phase 3 runtime requirement:
- Match result submission must award XP only after a valid match outcome is accepted.
- XP audit metadata must include match id, mode, outcome, awarded XP, previous level, next level, previous lifetime XP, next lifetime XP, and granted reward codes.
- Level-up rewards must be granted at most once per player and reward code.

Phase 4 runtime requirement:
- Purchase requests must create an append-only transaction entry for accepted and rejected outcomes.
- Accepted purchases must debit exactly one wallet currency, grant or increment exactly one inventory item, and write a purchase audit entry.
- Rejected purchases must not mutate wallet balances or inventory quantities.
- Purchase audit metadata must include store item id, item code, currency, quantity, amount, previous balance, next balance, and rejection reason when applicable.
- Payment behavior is simulated for MVP and must not call or require real payment credentials.

Phase 5 runtime requirement:
- Map creation with a published status must write a `map.publish` audit entry.
- Map version creation must write a `map.update` audit entry with version id and version label.
- UGC search responses must hide `hidden` maps unless a status filter explicitly asks for them.
- Popularity scoring must be derived from votes, completed tests, favorites, version count, and recency, not from user-controlled raw input.
- Moderation-relevant map data must include status, review metadata, reports, and moderation events for later staff workflows.

Phase 6 runtime requirement:
- Staff and admin can read dashboard, settings, moderation signals, and moderation history.
- Only admin can update studio settings.
- Staff and admin can apply account and map moderation actions.
- Settings updates and moderation actions must write audit entries with actor id, target id, action, reason, and relevant metadata.
- Moderation history must be append-only in the runtime baseline.

## Secret and environment handling
- Never commit real secrets.
- Use `.env.example` as contract only.
- Keep JWT and DB secrets outside source control.

## Data and transport
- Use TLS in non-local environments.
- Enforce least privilege on DB credentials.
- Store timestamps in UTC.

## Threats considered for MVP
- Privilege escalation attempts.
- Broken access control.
- Replay or abuse of refresh token.
- Tampering with transaction endpoints.
- Abuse/spam on UGC endpoints.
