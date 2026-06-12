# Backlog MVP - Vertical Slices

## Slice 1 - Auth baseline
Status: done
- API: register/login/refresh/logout endpoints.
- Schema: user, profile, refresh token.
- Contracts: auth request/response DTOs.
- Validation: auth route smoke tests + typecheck.

## Slice 2 - Matchmaking and MMR baseline
Status: done
- API: queue join/leave/status.
- API: match result submit.
- API: player mmr and match history.
- Schema: queue entry, match, participant, player mmr.
- Contracts: queue/match/mmr DTOs.

## Slice 3 - Progression baseline
Status: done
- API: player progression, progression rules, level rewards.
- API: match result awards XP and grants level-up rewards.
- Schema: account progression, level rewards, player reward grants.
- Contracts: progression, XP rules, level reward DTOs.

## Slice 4 - Economy baseline
Status: done
- API: store items, wallet, purchase transaction.
- Schema: wallet, store item, transaction, inventory item.
- Contracts: wallet/store/purchase DTOs.

## Slice 5 - UGC maps baseline
Status: done
- API: create map, add version, vote, test, list maps.
- Schema: map, map version, vote, test, favorite.
- Contracts: map creation/version/vote/test DTOs.

## Slice 6 - Admin and observability baseline
Status: done
- API: admin dashboard KPIs, settings, moderation signals, and moderation history.
- Schema: sanctions, moderation events, audit log.
- Realtime: event catalog namespaces and fallback docs.
- Contracts: admin summary and moderation DTOs.

## Slice 7 - Quality and security hardening
Status: done
- API: request-id middleware, standard error envelope, enriched health response.
- Schema: runtime event baseline for future durable observability.
- Tests: critical cross-service flow coverage and observability coverage.
- Docs: hardening notes, permission/logging review, and performance baseline.

## Slice 8 - Final delivery and defense
Status: done
- Docs: final delivery index, technical handbook, user guide, demo guide, defense runbook.
- Docs: business viability checklist and production follow-up summary.
- Validation: mandatory suite documented as the final Go/No-Go gate.
- Demo: live sequence and fallback plan documented.

## Slice 9 - Final review and grading readiness
Status: done
- Docs: phase 9 final review scorecard and grade-risk answers.
- Docs: requirements traceability matrix from cahier des charges expectations to repository evidence.
- Docs: next iteration plan with prioritized acceptance criteria.
- Delivery: final package index and defense flow updated.

## Definition of done for every slice
- OpenAPI updated.
- Prisma schema updated.
- Contracts package updated.
- API endpoints wired and buildable.
- Lint and typecheck passing.
- Scope and security docs updated if behavior changes.
