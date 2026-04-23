---
name: phase-orchestrator
description: Execute the GameDash roadmap phases autonomously under a strict gate-and-validation protocol. Use when the user sends prompts such as `/phase0`, `/phase1`, `/phase 2`, `/phase3`, or otherwise asks to execute a specific roadmap phase end-to-end with prerequisite checks, validations, commits, and push to `main`.
---

# Phase Orchestrator

Read `AGENTS.md`, `docs/03-roadmap-gamedash.md`, `docs/phase-protocol.md`, and `docs/phase-gates.md` before acting.

## Workflow

1. Parse the target phase number from the user prompt.
2. Sync the repository with `main` via `git pull --rebase`.
3. Resolve rebase conflicts directly if they occur.
4. Evaluate every earlier phase gate before implementing the target phase.
5. If any prerequisite phase fails, stop immediately and return the short blockage report defined in `docs/phase-protocol.md`.
6. If every prerequisite passes, implement the requested phase as a full vertical slice.
7. Update code, docs, tests, `contracts/openapi.yaml`, `prisma/schema.prisma`, migrations, and local data when relevant.
8. Run the mandatory validation suite from `docs/phase-protocol.md`.
9. Fix failures and rerun validations until the suite is green or a hard blocker is reached.
10. Use neutral Conventional Commit messages and push to `main`.
11. If push is rejected because the remote moved, rerun `git pull --rebase`, rerun the validation suite, and retry the push.
12. End with the standard completion report.

## Non-negotiable rules

- Treat `/phaseN` as a prompt convention, not a shell command.
- Use `docs/03-roadmap-gamedash.md` as the source of truth for phase scope and order.
- Use `docs/phase-gates.md` for pass/fail decisions.
- Do not continue to the requested phase if any prerequisite phase fails.
- Do not mention automation or Codex in commit messages unless the user explicitly asks.
