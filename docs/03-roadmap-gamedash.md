# Roadmap GameDash (A -> Z)

## Vision de delivery
Livrer un MVP jouable et administrable en 8 phases, avec validation continue.

## Execution companion docs
- This roadmap is the source of truth for phase scope and ordering.
- Execution protocol for `/phaseN` prompts: `docs/phase-protocol.md`
- Pass/fail gates used to unlock later phases: `docs/phase-gates.md`

## Phase 0 - Cadrage et socle (Semaine 1)
- Clarifier les user stories MVP.
- Fixer architecture cible et conventions.
- Initialiser repo, CI, qualite (lint/tests), templates docs.

**Sortie attendue**
- Base projet executable.
- Backlog priorise P0/P1/P2.

## Phase 1 - Identite, Auth, RBAC (Semaines 2-3)
- Inscription/connexion, hash mot de passe, sessions/JWT.
- Roles `joueur`, `staff`, `admin`.
- Profil joueur (pseudo, avatar, region, bio, preferences).
- Audit des actions sensibles auth/admin.

**Sortie attendue**
- Parcours onboarding complet.
- Endpoints securises et testes.

## Phase 2 - Matchmaking, matchs, MMR/rangs (Semaines 3-5)
- Files multi-modes (classe/non classe/fun).
- Etats joueur (online/queue/match).
- Attribution de match simulee.
- Elo simplifie + mapping MMR -> rang configurable.
- Historique de matchs et filtres.

**Sortie attendue**
- Match cycle complet avec mise a jour MMR.
- Visualisations de progression et distribution des rangs.

## Phase 3 - Progression, XP, niveaux (Semaine 5)
- XP post-match.
- Niveau de compte.
- Recompenses de passage de niveau.
- Quetes optionnelles (si capacite).

**Sortie attendue**
- Boucle de progression visible cote joueur.

## Phase 4 - Economie, boutique, inventaire (Semaines 6-7)
- Soft/hard currency.
- Catalogue boutique.
- Transactions et inventaire.
- Paiement simule (sandbox/faux service).
- Journal de transactions immuable.

**Sortie attendue**
- Parcours achat complet avec tracabilite.

## Phase 5 - UGC maps communautaires (Semaines 7-9)
- Publication map (metadata, tags, statut).
- Versionning maps + notes de version.
- Votes/tests/favoris/recherche.
- Score de popularite (votes + tests + recence).
- Stats createur et map.

**Sortie attendue**
- Portail communautaire exploitable.

## Phase 6 - Backoffice studio (Semaines 9-10)
- Dashboard KPI (actifs, matchs, revenus, activite maps).
- Reglages matchmaking/MMR/economie.
- Moderation comptes/maps (ban/suspension/masquage/mise en avant).
- Historique moderation + signalements.

**Sortie attendue**
- Pilotage studio end-to-end fonctionnel.

## Phase 7 - Durcissement qualite & securite (Semaine 11)
- Tests integration et parcours critiques.
- Gestion erreurs + observabilite.
- Revue permissions et journalisation.
- Performance de base et nettoyage technique.

**Sortie attendue**
- Build stable et demonstrable.

## Phase 8 - Livraison et soutenance (Semaine 12)
- Documentation technique (API, DB, securite).
- Guide utilisateur.
- Script/demo video.
- Checklist de viabilite metier.

**Sortie attendue**
- Dossier final complet + demo live.

## Repartition proposee (alignement cahier des charges)
- Etudiant 1: Backend Auth + Matchmaking/MMR.
- Etudiant 2: Frontend Joueur + UX mobile first.


## Jalons de controle (Go/No-Go)
- J1 (fin Phase 2): boucle competitive fonctionnelle.
- J2 (fin Phase 4): boucle economique fonctionnelle.
- J3 (fin Phase 6): boucle studio complete.
- J4 (fin Phase 8): documentation + demo pretes.
