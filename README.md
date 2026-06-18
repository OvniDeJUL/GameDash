# GameDash

Plateforme compétitive unifiée pour jeu en ligne multijoueur. Gestion de comptes, matchmaking en temps réel, progression de joueurs, économie virtuelle, cartes communautaires et back-office de modération.

---

## Contexte

GameDash est un projet full-stack mono-dépôt couvrant deux surfaces :

- **Player surface** — inscription, profil, matchmaking ranked/unranked/fun, soumission de résultats, progression XP/niveau, récompenses, boutique, inventaire, cartes UGC.
- **Studio surface** — tableau de bord analytique, modération de comptes et de cartes, paramétrage des règles métier (MMR deltas, XP, matchmaking).

Le projet couvre l'ensemble du cycle de vie d'une plateforme gaming : de l'authentification à la gestion de crise modération, en passant par une économie virtuelle traçable et un système de rang complet (BRONZE I → DIAMOND I).

---

## Stack technique

### Pourquoi ces technologies

| Couche | Technologie | Raison du choix |
|---|---|---|
| **Monorepo** | pnpm 10 + Turborepo 2 | Cache de build partagé, orchestration parallèle `dev`/`build`/`lint`/`test` entre apps et packages |
| **Backend** | NestJS 10 (Node.js) | Architecture modulaire orientée DI, support natif WebSocket, intégration Swagger/OpenAPI sans configuration, guards et pipes testables en isolation |
| **Frontend** | Next.js 15 (App Router) | Rendu hybride SSR/CSR, routing basé sur le filesystem, middleware natif pour la protection de routes, compatible React 18 Server Components |
| **ORM / DB** | Prisma 5 + PostgreSQL | Schéma typé source de vérité, migrations versionnées, client auto-généré partagé entre apps |
| **Contrats partagés** | TypeScript workspace package | DTOs partagés entre frontend et backend — aucun drift de types possible entre API et UI |
| **Temps réel** | Socket.io 4 | Namespaces par domaine (`/matchmaking`, `/status`, `/admin`), reconnexion automatique, compatible SSE fallback |
| **Visualisation** | Recharts 3 | Composants React natifs, responsive par défaut, zero dépendances lourdes |
| **Validation API** | OpenAPI (Redocly) + class-validator | Double validation : contrat statique YAML + validation runtime des payloads |

### Versions clés

```
Node.js     >= 20
pnpm        10.33.0
TypeScript  5.7
NestJS      10.4
Next.js     15.0
Prisma      5.22
Socket.io   4.8
React       18.3
```

---

## Architecture

```
GameDash/
├── apps/
│   ├── api/          NestJS — REST + WebSocket (port 3001)
│   └── web/          Next.js — Frontend joueur & studio (port 3000)
├── packages/
│   └── contracts/    DTOs TypeScript partagés
├── contracts/
│   └── openapi.yaml  Contrat OpenAPI v3 — source de vérité API
├── prisma/
│   ├── schema.prisma Schéma de base de données
│   └── migrations/   Historique migrations PostgreSQL
└── docs/             Documentation technique et fonctionnelle
```

**Flux de données :**

```
Browser → Next.js middleware (auth check)
        → Next.js page (SSR ou CSR)
        → API client (Authorization: Bearer)
        → NestJS controller → AuthGuard → RolesGuard
        → Service → Prisma → PostgreSQL

Browser ↔ Socket.io (ws://localhost:3001)
        ↔ NestJS Gateway (/matchmaking, /status, /admin)
```

---

## Prérequis

- **Node.js** >= 20 — [nodejs.org](https://nodejs.org)
- **pnpm** via Corepack : `corepack enable`
- **PostgreSQL** — instance locale sur le port 5432
- **Redis** — instance locale sur le port 6379

Vérifier les services :

```bash
# PostgreSQL
psql -h localhost -U postgres -c "select version();"

# Redis
redis-cli ping
# → PONG
```

---

## Installation et démarrage

### 1. Variables d'environnement

```bash
cp .env.example .env
```

Valeurs minimales à renseigner dans `.env` :

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gamedash
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=changeme_access
JWT_REFRESH_SECRET=changeme_refresh
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
WEB_ORIGIN=http://localhost:3000
API_BASE_URL=http://localhost:3001/api/v1
```

### 2. Installer les dépendances

```bash
corepack pnpm install
```

### 3. Initialiser la base de données

```bash
# Créer la base si elle n'existe pas
psql -U postgres -c "CREATE DATABASE gamedash;"

# Appliquer les migrations
corepack pnpm --filter @gamedash/api exec prisma migrate deploy

# (optionnel) Ouvrir Prisma Studio
corepack pnpm --filter @gamedash/api exec prisma studio
```

### 4. Lancer en développement

```bash
corepack pnpm dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Health check | http://localhost:3001/api/v1/health |

---

## Commandes disponibles

```bash
corepack pnpm dev              # Démarre api + web en parallèle (watch mode)
corepack pnpm build            # Build de production de toutes les apps
corepack pnpm lint             # ESLint sur toutes les apps
corepack pnpm typecheck        # Vérification TypeScript stricte
corepack pnpm test             # Tests unitaires (api seulement pour le MVP)
corepack pnpm validate:openapi # Lint du contrat OpenAPI
corepack pnpm validate:prisma  # Validation du schéma Prisma
corepack pnpm validate:contracts # openapi + prisma ensemble
```

---

## Responsivité et interface

### Breakpoints

Le frontend est conçu mobile-first avec Tailwind CSS. Breakpoints actifs :

| Breakpoint | Largeur | Usage |
|---|---|---|
| `sm` | 640px | Smartphones paysage |
| `md` | 768px | Tablettes |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |

### Comportement adaptatif

- **Navigation** : barre latérale collapsible sur mobile (`Nav.tsx`), topbar sur desktop
- **Tableaux** : scroll horizontal sur petits écrans, colonnes masquées sur mobile pour les vues admin
- **Graphiques** : Recharts responsive containers — s'adaptent automatiquement à la largeur du parent
- **Formulaires** : stacking vertical sur mobile, disposition en colonnes sur `md+`
- **Dashboard admin** : grid 2 colonnes sur `lg+`, colonne unique sur mobile

### Pages et accès

| Route | Rôle requis | Description |
|---|---|---|
| `/login` | — | Connexion |
| `/register` | — | Création de compte |
| `/dashboard` | PLAYER+ | Tableau de bord joueur |
| `/account` | PLAYER+ | Profil et paramètres |
| `/progression` | PLAYER+ | XP, niveau, récompenses |
| `/matchmaking` | PLAYER+ | File d'attente |
| `/store` | PLAYER+ | Boutique et inventaire |
| `/community` | PLAYER+ | Cartes communautaires |
| `/admin` | STAFF+ | Back-office modération |

---

## Sécurité — résumé

- Mots de passe : PBKDF2-SHA512, jamais stockés en clair
- Tokens : JWT HMAC-SHA256 — access 15 min / refresh 30 jours
- Refresh tokens : stockés en hash SHA256, révocables à tout moment
- Guards NestJS : `AuthGuard` (JWT) + `RolesGuard` (RBAC) sur chaque route protégée
- Validation : `ValidationPipe` whitelist sur tous les payloads entrants
- CORS : restreint à `WEB_ORIGIN`
- Audit : toutes les actions sensibles journalisées dans `AuditLog`

Voir [docs/security-architecture.md](docs/security-architecture.md) pour le détail complet.

---

## Documentation

| Document | Contenu |
|---|---|
| [docs/guide-utilisateur.md](docs/guide-utilisateur.md) | Parcours Player, Staff, Admin — pas à pas |
| [docs/api-reference.md](docs/api-reference.md) | Endpoints REST + WebSocket, requêtes/réponses |
| [docs/database-reference.md](docs/database-reference.md) | Schéma complet, relations, index, flux transactionnels |
| [docs/security-architecture.md](docs/security-architecture.md) | Auth, JWT, RBAC, audit, contraintes MVP |
| [docs/technical-handbook.md](docs/technical-handbook.md) | Handbook technique général |
| [docs/local-setup-native.md](docs/local-setup-native.md) | Setup PostgreSQL + Redis natif |
| [docs/mvp-scope.md](docs/mvp-scope.md) | Périmètre MVP |
| [docs/decision-log.md](docs/decision-log.md) | Journal des décisions d'architecture |

---

## Structure de la base de données — aperçu

```
User ──┬── PlayerProfile        (profil public)
       ├── AccountProgression   (XP + niveau)
       ├── PlayerMmr            (1 par mode de jeu)
       ├── Wallet               (soft + hard balance)
       ├── RefreshToken[]       (tokens révocables)
       ├── MatchParticipant[]   (historique parties)
       ├── Transaction[]        (ledger achats)
       ├── InventoryItem[]      (cosmétiques possédés)
       ├── GameMap[]            (cartes créées)
       └── Sanction[]           (historique modération)

Match ─── MatchParticipant[]    (outcome, MMR before/after, XP)

StoreItem ── Transaction[]      (achats, append-only)
```

25 modèles, 11 enums — migrations versionnées dans `prisma/migrations/`.
