# Phase Execution Protocol

## Purpose

Define how Codex must interpret prompts such as `/phase1`, `/phase 3`, or `/phase 7`.

This is a prompt convention for Codex sessions that load this repository. It is not a native shell command.

## Source of truth

- Phase scope, order, and expected outcomes are defined in `docs/03-roadmap-gamedash.md`.
- Validation gates are defined in `docs/phase-gates.md`.
- Repository-local operating rules are defined in `AGENTS.md`.

If two documents disagree, `docs/03-roadmap-gamedash.md` wins for scope and ordering, then `docs/phase-gates.md` wins for pass/fail criteria, then `AGENTS.md` wins for operating behavior.

## Accepted prompt forms

- `/phase0`
- `/phase 0`
- `/phase1`
- `/phase 1`
- `/phase8`
- `/phase 8`

Any such prompt means: execute the requested roadmap phase end-to-end under this protocol.

## Mandatory execution flow

1. Parse the target phase number from the prompt.
2. Read `AGENTS.md`, `docs/03-roadmap-gamedash.md`, `docs/phase-gates.md`, `docs/mvp-scope.md`, `docs/backlog-mvp.md`, `docs/security-baseline.md`, and `docs/decision-log.md`.
3. Sync the branch with `main` using `git pull --rebase`.
4. If rebase conflicts happen, resolve them directly, then continue.
5. Evaluate every prerequisite phase gate from `0` up to `target - 1`.
6. If any prerequisite phase fails, stop immediately and return a simple blockage report. Do not implement the requested phase and do not continue to later phases.
7. If all prerequisite phases pass, implement the target phase with full vertical-slice scope:
   API + schema + shared contracts + UI + tests + docs.
8. Update every affected artifact in the same phase when relevant:
   code, docs, tests, `contracts/openapi.yaml`, `prisma/schema.prisma`, migrations, local seed or fixture data.
9. Run the mandatory validation suite.
10. If any validation fails, fix the issue, rerun the failing validation, then rerun the full suite until everything passes or a hard blocker is reached.
11. Use as many commits as needed during execution, but keep them reviewable and use Conventional Commits.
12. Push the result to `main`.
13. If push is rejected because the remote moved, run `git pull --rebase` again, rerun the full validation suite, then retry the push.
14. Finish with the standard phase report.

## Blocking rule

For a requested phase `N`, every earlier phase must already pass its gate on the current branch before implementation starts.

Example:
- `/phase3` must block if phase 0, phase 1, or phase 2 fails.
- `/phase1` must block if phase 0 fails.

## Scope correction rule

Once prerequisite phases pass, Codex may fix older defects outside the nominal target phase if they block:

- implementation of the requested phase
- repository integrity
- the mandatory validation suite
- `git pull --rebase` or `git push`

This permission only applies after prerequisite phases pass.

## Mandatory validation suite

Run the repository validation commands corresponding to these checks:

- `build`
- `lint`
- `typecheck`
- `test`
- `validate:openapi`
- `validate:prisma`

Use the package-manager entrypoints defined by the repository when available.

## Git and reporting rules

- Work on `main`.
- Start with `git pull --rebase`.
- End with `git push` to `main`.
- Use neutral Conventional Commit messages.
- Do not mention automation, Codex, or generated-work wording in commit messages unless the user explicitly asks for it.

## Report formats

### Blockage report

Keep it short and include only:

1. Requested phase.
2. First prerequisite phase that failed.
3. Gate or validation that failed.

### Completion report

Always include:

1. Delivered behavior.
2. Changed files.
3. Validation executed.
4. Remaining gaps vs scope.
