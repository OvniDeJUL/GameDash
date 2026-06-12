import type {
  AdminDashboardSummary,
  AuthTokensResponse,
  ErrorResponse,
  HealthResponse,
  InventoryItemResponse,
  LevelReward,
  MatchHistoryItem,
  MapSummary,
  ModerationActionResponse,
  ModerationSignalResponse,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  StudioSettingsResponse,
  StoreItem,
  TransactionResponse,
  WalletResponse,
  QueueStatusResponse,
  RankConfig,
  RegisterRequest
} from "@gamedash/contracts";

const registrationPayload: RegisterRequest = {
  email: "player@example.test",
  password: "minimum-8",
  pseudo: "PlayerOne",
  avatarUrl: "https://cdn.example.test/avatar.png",
  region: "EU",
  bio: "Ranked and UGC map player"
};

const authContract: AuthTokensResponse = {
  accessToken: "jwt-access-token",
  refreshToken: "gd_rt_refresh-token",
  role: "player",
  user: {
    id: "usr_demo",
    email: registrationPayload.email,
    role: "player",
    profile: {
      userId: "usr_demo",
      pseudo: registrationPayload.pseudo,
      avatarUrl: registrationPayload.avatarUrl,
      region: registrationPayload.region,
      bio: registrationPayload.bio
    }
  }
};

const queueStatus: QueueStatusResponse = {
  playerId: "usr_demo",
  state: "in_match",
  mode: "ranked",
  matchId: "7cfb7e0c-91f5-4bd7-b8ac-9843d3aa42c9",
  opponentPlayerId: "usr_rival",
  estimatedWaitSeconds: 0
};

const mmr: PlayerMmrResponse = {
  playerId: "usr_demo",
  ratings: [
    { mode: "ranked", mmr: 1032, rank: "BRONZE II" },
    { mode: "unranked", mmr: 1000, rank: "UNRANKED" },
    { mode: "fun", mmr: 1000, rank: "CASUAL" }
  ]
};

const recentMatches: MatchHistoryItem[] = [
  {
    matchId: queueStatus.matchId ?? "match-demo",
    mode: "ranked",
    createdAt: "2026-06-11T10:00:00.000Z",
    finishedAt: "2026-06-11T10:08:00.000Z",
    result: "win",
    opponentPlayerId: queueStatus.opponentPlayerId,
    mmrBefore: 1000,
    mmrAfter: 1032,
    mmrDelta: 32,
    rankBefore: "BRONZE II",
    rankAfter: "BRONZE II"
  }
];

const rankConfig: RankConfig[] = [
  { mode: "ranked", minMmr: 0, maxMmr: 899, rank: "BRONZE III", sortOrder: 10 },
  { mode: "ranked", minMmr: 900, maxMmr: 1099, rank: "BRONZE II", sortOrder: 20 },
  { mode: "ranked", minMmr: 1100, maxMmr: 1299, rank: "SILVER I", sortOrder: 30 }
];

const progression: PlayerProgressionResponse = {
  playerId: "usr_demo",
  level: 2,
  lifetimeXp: 180,
  currentLevelXp: 30,
  nextLevelXp: 350,
  xpToNextLevel: 170,
  levelProgressPercent: 15,
  updatedAt: "2026-06-11T10:08:00.000Z",
  rewards: [
    {
      level: 2,
      code: "profile_border_copper",
      label: "Copper profile border",
      rewardType: "cosmetic",
      grantedAt: "2026-06-11T10:08:00.000Z"
    }
  ]
};

const levelRewards: LevelReward[] = [
  {
    level: 2,
    code: "profile_border_copper",
    label: "Copper profile border",
    rewardType: "cosmetic"
  },
  {
    level: 3,
    code: "title_queue_climber",
    label: "Queue Climber title",
    rewardType: "title"
  },
  {
    level: 4,
    code: "soft_currency_250",
    label: "250 soft currency",
    rewardType: "soft_currency",
    quantity: 250
  }
];

const wallet: WalletResponse = {
  playerId: "usr_demo",
  softBalance: 600,
  hardBalance: 20,
  updatedAt: "2026-06-11T11:00:00.000Z"
};

const storeItems: StoreItem[] = [
  {
    id: "item_starter_skin",
    itemCode: "skin_starter",
    name: "Starter Skin",
    description: "Baseline character skin purchasable with soft currency.",
    currencyType: "soft",
    price: 200,
    active: true,
    sortOrder: 10
  },
  {
    id: "item_premium_skin",
    itemCode: "skin_premium",
    name: "Premium Skin",
    description: "Sandbox premium cosmetic purchasable with hard currency.",
    currencyType: "hard",
    price: 5,
    active: true,
    sortOrder: 30
  }
];

const inventory: InventoryItemResponse[] = [
  {
    id: "14bb9e5e-e3a6-4ee5-bb09-992018f5e9d5",
    playerId: "usr_demo",
    itemCode: "skin_starter",
    name: "Starter Skin",
    quantity: 2,
    equipped: false,
    updatedAt: wallet.updatedAt
  }
];

const latestTransaction: TransactionResponse = {
  transactionId: "abf2c698-9e1f-4c05-b9e7-94f75e2e74c2",
  status: "accepted",
  storeItemId: "item_starter_skin",
  itemCode: "skin_starter",
  currencyType: "soft",
  unitPrice: 200,
  quantity: 2,
  amount: 400,
  balanceBefore: 1000,
  balanceAfter: 600,
  createdAt: wallet.updatedAt
};

const communityMaps: MapSummary[] = [
  {
    id: "2a62f52f-9f7c-43e3-9201-897ad1627262",
    creatorId: "usr_creator",
    title: "Sky Arena",
    description: "Vertical duel arena with jump pads and fast test loops.",
    tags: ["arena", "ranked"],
    status: "beta",
    popularityScore: 30,
    latestVersionLabel: "v1",
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:20:00.000Z",
    stats: {
      mapId: "2a62f52f-9f7c-43e3-9201-897ad1627262",
      versionCount: 1,
      voteScore: 1,
      upvotes: 1,
      downvotes: 0,
      completedTests: 1,
      favorites: 1,
      popularityScore: 30
    }
  },
  {
    id: "b2351fd5-3838-40c5-9df6-f79b55ed0e58",
    creatorId: "usr_creator",
    title: "Factory Rush",
    description: "Compact route for speedrun tests and creator iteration.",
    tags: ["speedrun", "fun"],
    status: "stable",
    popularityScore: 18,
    latestVersionLabel: "v2",
    createdAt: "2026-06-11T09:00:00.000Z",
    updatedAt: "2026-06-11T12:10:00.000Z",
    stats: {
      mapId: "b2351fd5-3838-40c5-9df6-f79b55ed0e58",
      versionCount: 2,
      voteScore: 0,
      upvotes: 1,
      downvotes: 1,
      completedTests: 1,
      favorites: 0,
      popularityScore: 18
    }
  }
];

const adminDashboard: AdminDashboardSummary = {
  activePlayers: 1200,
  dailyMatches: 9800,
  virtualRevenue: 45200,
  mapActivity: 310,
  openModerationSignals: 2,
  activeSanctions: 1,
  settingsLastUpdated: "2026-06-12T08:00:00.000Z"
};

const studioSettings: StudioSettingsResponse = {
  matchmaking: {
    rankedQueueMaxWaitSeconds: 120,
    funQueueMaxWaitSeconds: 45,
    matchSize: 2
  },
  mmr: {
    placementMmr: 1000,
    rankedWinDelta: 28,
    rankedLossDelta: -22,
    unrankedWinDelta: 10,
    unrankedLossDelta: -8
  },
  economy: {
    starterSoftBalance: 1000,
    starterHardBalance: 20,
    purchaseEnabled: true,
    refundWindowHours: 24
  },
  updatedAt: adminDashboard.settingsLastUpdated,
  updatedBy: "usr_admin"
};

const moderationSignals: ModerationSignalResponse[] = [
  {
    id: "sig_map_report_spam",
    targetType: "map",
    targetId: "map_reported_spam",
    reason: "Repeated low-quality map reports",
    status: "open",
    source: "map_report",
    createdAt: "2026-06-12T08:00:00.000Z"
  }
];

const moderationHistory: ModerationActionResponse[] = [
  {
    id: "8f599355-f43d-45a7-b028-f38d982d8fd6",
    targetType: "map",
    targetId: "map_reported_spam",
    action: "map.hide",
    reason: "Unsafe UGC metadata",
    actorId: "usr_staff",
    createdAt: "2026-06-12T08:05:00.000Z"
  }
];

const qualityHealth: HealthResponse = {
  status: "ok",
  time: "2026-06-12T09:00:00.000Z",
  version: "0.1.0",
  uptimeSeconds: 3600,
  checks: [
    {
      name: "api",
      status: "ok",
      detail: "NestJS runtime is accepting requests."
    },
    {
      name: "contracts",
      status: "ok",
      detail: "OpenAPI and shared DTO validation are in the mandatory suite."
    },
    {
      name: "storage",
      status: "ok",
      detail: "MVP runtime uses in-memory repositories with Prisma baseline."
    }
  ],
  observability: {
    startedAt: "2026-06-12T08:00:00.000Z",
    uptimeSeconds: 3600,
    requestCount: 128,
    errorCount: 2,
    criticalErrorCount: 0,
    lastRequestAt: "2026-06-12T09:00:00.000Z",
    p95DurationMs: 42,
    recentErrors: []
  }
};

const errorContract: ErrorResponse = {
  error: {
    code: "forbidden",
    message: "Insufficient role for this action.",
    statusCode: 403,
    timestamp: "2026-06-12T09:00:00.000Z",
    path: "/api/v1/admin/settings",
    requestId: "req_demo_quality"
  }
};

export default function HomePage() {
  return (
    <main className="container">
      <h1>GameDash Player Access</h1>

      <section className="auth-grid" aria-label="Authentication baseline">
        <form className="panel">
          <h2>Create account</h2>
          <label>
            Email
            <input defaultValue={registrationPayload.email} type="email" />
          </label>
          <label>
            Password
            <input defaultValue={registrationPayload.password} type="password" />
          </label>
          <label>
            Pseudo
            <input defaultValue={registrationPayload.pseudo} />
          </label>
          <label>
            Region
            <input defaultValue={registrationPayload.region} />
          </label>
          <button type="button">Register</button>
        </form>

        <section className="panel">
          <h2>Session contract</h2>
          <dl>
            <div>
              <dt>Role</dt>
              <dd>{authContract.role}</dd>
            </div>
            <div>
              <dt>Profile</dt>
              <dd>{authContract.user.profile.pseudo}</dd>
            </div>
            <div>
              <dt>Refresh</dt>
              <dd>Server revocable</dd>
            </div>
          </dl>
        </section>
      </section>

      <section>
        <h2>Protected routes</h2>
        <ul className="route-list">
          <li>
            <code>GET /api/v1/auth/me</code>
            <span>Bearer token required</span>
          </li>
          <li>
            <code>GET /api/v1/players/me/profile</code>
            <span>Player profile baseline</span>
          </li>
          <li>
            <code>GET /api/v1/admin/dashboard</code>
            <span>Staff or admin only</span>
          </li>
        </ul>
      </section>

      <section className="competition-grid" aria-label="Competitive loop baseline">
        <section className="panel">
          <h2>Matchmaking</h2>
          <dl>
            <div>
              <dt>State</dt>
              <dd>{queueStatus.state}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{queueStatus.mode}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{queueStatus.matchId}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>MMR</h2>
          <ul className="rating-list">
            {mmr.ratings.map((rating) => (
              <li key={rating.mode}>
                <span>{rating.mode}</span>
                <strong>{rating.mmr}</strong>
                <em>{rating.rank}</em>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="competition-grid" aria-label="Match history and ranks">
        <section className="panel">
          <h2>Recent matches</h2>
          <ul className="history-list">
            {recentMatches.map((match) => (
              <li key={match.matchId}>
                <span>{match.mode}</span>
                <strong>{match.result}</strong>
                <em>
                  {match.mmrBefore} to {match.mmrAfter} ({match.mmrDelta})
                </em>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Rank map</h2>
          <ul className="history-list">
            {rankConfig.map((rank) => (
              <li key={`${rank.mode}-${rank.rank}`}>
                <span>{rank.rank}</span>
                <strong>{rank.minMmr}+</strong>
                <em>{rank.mode}</em>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="competition-grid" aria-label="Account progression">
        <section className="panel progression-card">
          <h2>Account progression</h2>
          <div className="level-meter">
            <span>Level {progression.level}</span>
            <strong>{progression.lifetimeXp} XP</strong>
          </div>
          <div
            aria-label={`${progression.levelProgressPercent}% progress to next level`}
            className="progress-track"
          >
            <span style={{ width: `${progression.levelProgressPercent}%` }} />
          </div>
          <p>
            {progression.currentLevelXp} XP in current level, {progression.xpToNextLevel} XP to next.
          </p>
        </section>

        <section className="panel">
          <h2>Level rewards</h2>
          <ul className="reward-list">
            {levelRewards.map((reward) => {
              const claimed = progression.rewards.some((grant) => grant.code === reward.code);

              return (
                <li key={reward.code}>
                  <span>Level {reward.level}</span>
                  <strong>{reward.label}</strong>
                  <em>{claimed ? "granted" : reward.rewardType}</em>
                </li>
              );
            })}
          </ul>
        </section>
      </section>

      <section className="competition-grid" aria-label="Economy baseline">
        <section className="panel wallet-card">
          <h2>Wallet</h2>
          <div className="wallet-balance">
            <span>Soft</span>
            <strong>{wallet.softBalance}</strong>
          </div>
          <div className="wallet-balance">
            <span>Hard</span>
            <strong>{wallet.hardBalance}</strong>
          </div>
          <p>Latest purchase: {latestTransaction.status}</p>
        </section>

        <section className="panel">
          <h2>Store</h2>
          <ul className="store-list">
            {storeItems.map((item) => (
              <li key={item.id}>
                <span>{item.currencyType}</span>
                <strong>{item.name}</strong>
                <em>{item.price}</em>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="competition-grid" aria-label="Inventory and transaction journal">
        <section className="panel">
          <h2>Inventory</h2>
          <ul className="inventory-list">
            {inventory.map((item) => (
              <li key={item.id}>
                <span>{item.itemCode}</span>
                <strong>{item.name}</strong>
                <em>x{item.quantity}</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Transaction journal</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{latestTransaction.status}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>
                {latestTransaction.amount} {latestTransaction.currencyType}
              </dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>
                {latestTransaction.balanceBefore} to {latestTransaction.balanceAfter}
              </dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="competition-grid" aria-label="Community maps">
        <section className="panel">
          <h2>Community maps</h2>
          <ul className="map-list">
            {communityMaps.map((map) => (
              <li key={map.id}>
                <span>{map.status}</span>
                <strong>{map.title}</strong>
                <em>{map.popularityScore}</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>UGC activity</h2>
          <dl>
            <div>
              <dt>Search tags</dt>
              <dd>{communityMaps[0]?.tags.join(", ")}</dd>
            </div>
            <div>
              <dt>Latest version</dt>
              <dd>{communityMaps[0]?.latestVersionLabel}</dd>
            </div>
            <div>
              <dt>Votes / tests / favs</dt>
              <dd>
                {communityMaps[0]?.stats.voteScore} / {communityMaps[0]?.stats.completedTests} /{" "}
                {communityMaps[0]?.stats.favorites}
              </dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="competition-grid" aria-label="Studio backoffice">
        <section className="panel">
          <h2>Studio dashboard</h2>
          <ul className="admin-list">
            <li>
              <span>Players</span>
              <strong>{adminDashboard.activePlayers}</strong>
              <em>active</em>
            </li>
            <li>
              <span>Matches</span>
              <strong>{adminDashboard.dailyMatches}</strong>
              <em>daily</em>
            </li>
            <li>
              <span>Signals</span>
              <strong>{adminDashboard.openModerationSignals}</strong>
              <em>open</em>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Studio settings</h2>
          <dl>
            <div>
              <dt>Ranked wait</dt>
              <dd>{studioSettings.matchmaking.rankedQueueMaxWaitSeconds}s</dd>
            </div>
            <div>
              <dt>Ranked MMR</dt>
              <dd>
                +{studioSettings.mmr.rankedWinDelta} / {studioSettings.mmr.rankedLossDelta}
              </dd>
            </div>
            <div>
              <dt>Purchases</dt>
              <dd>{studioSettings.economy.purchaseEnabled ? "enabled" : "disabled"}</dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="competition-grid" aria-label="Moderation backoffice">
        <section className="panel">
          <h2>Moderation signals</h2>
          <ul className="admin-list">
            {moderationSignals.map((signal) => (
              <li key={signal.id}>
                <span>{signal.targetType}</span>
                <strong>{signal.reason}</strong>
                <em>{signal.status}</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Moderation history</h2>
          <ul className="admin-list">
            {moderationHistory.map((action) => (
              <li key={action.id}>
                <span>{action.action}</span>
                <strong>{action.reason}</strong>
                <em>{action.actorId}</em>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="competition-grid" aria-label="Quality and security hardening">
        <section className="panel">
          <h2>Quality guardrails</h2>
          <ul className="quality-list">
            <li>
              <span>Health</span>
              <strong>{qualityHealth.status}</strong>
              <em>{qualityHealth.observability.p95DurationMs}ms p95</em>
            </li>
            <li>
              <span>Requests</span>
              <strong>{qualityHealth.observability.requestCount}</strong>
              <em>{qualityHealth.observability.errorCount} errors</em>
            </li>
            <li>
              <span>Integration</span>
              <strong>critical flows</strong>
              <em>covered</em>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Error contract</h2>
          <dl>
            <div>
              <dt>Code</dt>
              <dd>{errorContract.error.code}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{errorContract.error.statusCode}</dd>
            </div>
            <div>
              <dt>Trace</dt>
              <dd>{errorContract.error.requestId}</dd>
            </div>
          </dl>
        </section>
      </section>
    </main>
  );
}
