# AGENTS - GameDash Execution Rules

This file defines repository-local operating rules for coding agents.

## Mission
Deliver GameDash end-to-end in vertical slices with strict MVP-first discipline.

## Priority order
1. P0: Auth/RBAC, Matchmaking/MMR, auditability, transaction integrity.
2. P1: Economy depth, UGC quality/moderation, richer dashboards.
3. P2: Seasonal and optional features.

## Mandatory constraints
- Respect API contract baseline in `contracts/openapi.yaml`.
- Respect DB baseline in `prisma/schema.prisma`.
- Keep REST API under `/api/v1`.
- Maintain role boundaries: `player`, `staff`, `admin`.
- Log critical actions (auth, sanctions, purchases, MMR changes, map publish/update).
- Keep fallback behavior documented when adding realtime behavior.

## Coding behavior
- Implement by vertical slice:
API + schema + shared contracts + minimal UI + tests + docs.
- Prefer small, reviewable changes.
- Keep placeholders explicit and traceable.
- Do not add optional scope if a P0 gap is still open.

## Phase prompt convention
- Treat prompts such as `/phase0`, `/phase1`, `/phase 2`, `/phase3` as repository-supported execution commands.
- Use skill: `$phase-orchestrator`.
- Read:
  - `docs/03-roadmap-gamedash.md`
  - `docs/phase-protocol.md`
  - `docs/phase-gates.md`
- For `/phaseN`, block immediately if any earlier phase gate fails.
- Start phase execution with `git pull --rebase`.
- Resolve rebase conflicts directly if they happen.
- Run the full validation suite before push:
  - `build`
  - `lint`
  - `typecheck`
  - `test`
  - `validate:openapi`
  - `validate:prisma`
- If a validation fails during execution of the requested phase, fix it and rerun until the suite is green or a hard blocker is reached.
- If `git push` is rejected because the remote moved, run `git pull --rebase`, rerun the full validation suite, then retry the push.
- Use neutral Conventional Commit messages. Do not mention automation or Codex in commit messages unless explicitly requested by the user.

## Commit style
- Conventional Commits.
- Examples:
  - `feat(auth): add register and login endpoints`
  - `feat(matchmaking): add queue join/leave status`
  - `docs(scope): refine MVP acceptance criteria`

## Required output format for agent reports
1. Delivered behavior.
2. Changed files.
3. Validation executed (build/lint/typecheck/tests/contract checks).
4. Remaining gaps vs scope.

## Start points
- Use skill: `$gamedash-a2z-builder`
- Use skill: `$phase-orchestrator` when the user sends `/phaseN`
- Read first:
  - `docs/mvp-scope.md`
  - `docs/backlog-mvp.md`
  - `docs/security-baseline.md`
  - `docs/decision-log.md`
  - `docs/phase-protocol.md`
  - `docs/phase-gates.md`
