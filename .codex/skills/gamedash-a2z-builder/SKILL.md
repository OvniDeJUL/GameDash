---
name: gamedash-a2z-builder
description: Construire et livrer GameDash de A a Z a partir du cahier des charges (MVP puis durcissement) avec une execution par jalons, priorisee par risque et valeur. Utiliser quand Codex doit analyser, planifier ou implementer les modules Auth, Matchmaking/MMR, Progression, Economie/Boutique, UGC Maps, Backoffice, securite, tests et documentation de ce projet.
---

# GameDash A2Z Builder

## Objectif
Livrer un produit demonstrable et maintenable en respectant strictement le cahier des charges GameDash.
Travailler en iterant par tranches verticales testables, sans sauter les points de securite et de qualite.

## Entrees attendues
- Le fichier `Cahier des Charges.pdf`.
- Les documents de pilotage:
`docs/01-analyse-cahier-des-charges.md`,
`docs/02-diagrammes-gamedash.md`,
`docs/03-roadmap-gamedash.md`.

## Workflow d'execution
1. Charger le contexte projet.
2. Determiner le prochain jalon non termine dans `docs/03-roadmap-gamedash.md`.
3. Decouper le jalon en sous-taches executable en une session:
API + schema + UI + tests + documentation.
4. Implementer puis verifier localement.
5. Produire un compte-rendu bref: changements, preuves (tests), risques residuels.

## Regles de priorisation
- Prioriser P0: Auth/RBAC, Matchmaking/MMR, journalisation, integrite des transactions.
- Prioriser ensuite P1: Boutique/Inventaire, UGC maps, moderation.
- Garder P2 pour la fin: options saisonnieres, notifications avancees.

## Contrat qualite par jalon
- Ajouter ou mettre a jour des tests automatiques.
- Verifier les controles d'acces (joueur/staff/admin).
- Verifier les logs d'audit des actions critiques:
achats, sanctions, modification MMR, publication/update de maps.
- Refuser les TODO non traces: documenter tout compromis dans la sortie.

## Definition of Done minimale (MVP)
- Authentification fonctionnelle + roles.
- Matchmaking simule operant avec historique des matchs.
- MMR/rangs calcules et visualisables.
- Progression XP/niveaux active.
- Economie virtuelle + transactions tracees.
- Publication/versionning/votes/tests des maps.
- Backoffice studio (monitoring, moderation, parametres de base).
- Documentation technique et guide utilisateur initial.

## Mode de sortie attendu
- Commencer par le resultat concret (ce qui est implemente).
- Lister les fichiers modifies.
- Donner l'etat des tests/lint/build.
- Signaler explicitement les ecarts restants avec le cahier des charges.

## References
- Lire `references/project-baseline.md` avant toute implementation importante.
