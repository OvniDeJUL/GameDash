# GameDash Project Baseline

## Portee fonctionnelle prioritaire
- Authentification + profils joueurs + roles (`joueur`, `staff`, `admin`).
- Matchmaking multi-file avec attribution de match simulee.
- MMR par mode, rangs (tiers/divisions) et progression XP.
- Boutique, inventaire, monnaies soft/hard, journal de transactions.
- UGC maps: publication, versionning, votes/tests, recherche et popularite.
- Backoffice: monitoring activite, moderation comptes/maps, parametres economie/MMR.

## Exigences transverses
- API securisee et robuste.
- Journalisation des actions critiques.
- Gestion d'erreurs exploitable.
- Mobile first cote front joueur.
- KPI de pilotage simples pour la demo.

## Entites coeur
- User, Profile, Role.
- MatchQueue, Match, MatchParticipant.
- PlayerMMR, RankConfig.
- Wallet, InventoryItem, StoreItem, Transaction.
- Map, MapVersion, MapVote, MapTest, MapFavorite, MapModerationEvent.
- Sanction, AuditLog.

## Kpis MVP
- Joueurs actifs.
- Matchs par jour.
- Revenus virtuels.
- Activite maps communautaires (tests, votes, retention simplifiee).

## Criteres de reussite demo
- Parcours joueur complet: inscription -> match -> progression -> boutique -> map.
- Parcours studio complet: visualisation KPI -> moderation -> ajustement parametre.
- Documentation deploiement + API + securite presente.
