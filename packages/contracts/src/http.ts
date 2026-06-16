export type Role = "player" | "staff" | "admin";
export type GameMode = "ranked" | "unranked" | "fun";
export type MapStatus = "draft" | "beta" | "stable" | "hidden";
export type RewardType = "soft_currency" | "cosmetic" | "title";
export type CurrencyType = "soft" | "hard";
export type TransactionStatus = "accepted" | "rejected";
export type AccountModerationAction = "warn" | "suspend" | "ban";
export type MapModerationAction = "hide" | "restore" | "feature" | "validate";
export type ModerationTargetType = "account" | "map";
export type ModerationSignalStatus = "open" | "reviewed" | "dismissed";

export interface HealthResponse {
  status: "ok" | "degraded";
  time: string;
  version: string;
  uptimeSeconds: number;
  checks: HealthCheckResponse[];
  observability: ObservabilitySnapshotResponse;
}

export interface HealthCheckResponse {
  name: string;
  status: "ok" | "degraded";
  detail?: string;
}

export interface ObservabilityErrorResponse {
  method: string;
  path: string;
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  occurredAt: string;
}

export interface ObservabilitySnapshotResponse {
  startedAt: string;
  uptimeSeconds: number;
  requestCount: number;
  errorCount: number;
  criticalErrorCount: number;
  lastRequestAt?: string;
  p95DurationMs: number;
  recentErrors: ObservabilityErrorResponse[];
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    requestId: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  pseudo: string;
  avatarUrl?: string;
  region?: string;
  bio?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface PlayerProfileResponse {
  userId: string;
  pseudo: string;
  avatarUrl?: string;
  region?: string;
  bio?: string;
}

export interface UpdatePlayerProfileRequest {
  pseudo?: string;
  avatarUrl?: string;
  region?: string;
  bio?: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  role: Role;
  profile: PlayerProfileResponse;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  role: Role;
  user: AuthUserResponse;
}

export interface QueueJoinRequest {
  mode: GameMode;
}

export interface QueueStatusResponse {
  playerId?: string;
  state: "offline" | "online" | "in_queue" | "in_match";
  mode?: GameMode;
  estimatedWaitSeconds?: number;
  queuedAt?: string;
  matchId?: string;
  opponentPlayerId?: string;
}

export interface MatchResultRequest {
  winnerPlayerId: string;
  notes?: string;
}

export interface MatchParticipantResult {
  playerId: string;
  outcome: "win" | "loss" | "draw";
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  rankBefore: string;
  rankAfter: string;
  progression: MatchProgressionResult;
}

export interface MatchResultResponse {
  accepted: boolean;
  mmrUpdated: boolean;
  matchId: string;
  mode: GameMode;
  participants: MatchParticipantResult[];
}

export interface PlayerMmrRating {
  mode: GameMode;
  mmr: number;
  rank: string;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PlayerMmrResponse {
  playerId: string;
  ratings: PlayerMmrRating[];
}

export interface MatchHistoryItem {
  matchId: string;
  mode: GameMode;
  createdAt: string;
  finishedAt?: string;
  result?: "win" | "loss" | "draw";
  opponentPlayerId?: string;
  mmrBefore?: number;
  mmrAfter?: number;
  mmrDelta?: number;
  rankBefore?: string;
  rankAfter?: string;
  xpAwarded?: number;
  durationSeconds?: number;
  winnerPlayerId?: string;
}

export interface RankConfig {
  mode: GameMode;
  minMmr: number;
  maxMmr?: number;
  rank: string;
  sortOrder: number;
}

export interface LevelReward {
  level: number;
  code: string;
  label: string;
  rewardType: RewardType;
  quantity?: number;
}

export interface GrantedLevelReward extends LevelReward {
  grantedAt: string;
}

export interface LevelThreshold {
  level: number;
  minLifetimeXp: number;
}

export interface ProgressionRulesResponse {
  baseXpByMode: Record<GameMode, number>;
  outcomeXp: Record<"win" | "loss" | "draw", number>;
  levelThresholds: LevelThreshold[];
}

export interface MatchProgressionResult {
  xpAwarded: number;
  levelBefore: number;
  levelAfter: number;
  lifetimeXpBefore: number;
  lifetimeXpAfter: number;
  rewardsGranted: GrantedLevelReward[];
}

export interface PlayerProgressionResponse {
  playerId: string;
  level: number;
  lifetimeXp: number;
  currentLevelXp: number;
  nextLevelXp?: number;
  xpToNextLevel?: number;
  levelProgressPercent: number;
  rewards: GrantedLevelReward[];
  updatedAt: string;
}

export interface StoreItem {
  id: string;
  itemCode: string;
  name: string;
  description?: string;
  currencyType: CurrencyType;
  price: number;
  active: boolean;
  sortOrder: number;
}

export interface WalletResponse {
  playerId: string;
  softBalance: number;
  hardBalance: number;
  updatedAt: string;
}

export interface PurchaseRequest {
  storeItemId: string;
  quantity: number;
}

export interface TransactionResponse {
  transactionId: string;
  status: TransactionStatus;
  storeItemId?: string;
  itemCode?: string;
  currencyType: CurrencyType;
  unitPrice: number;
  quantity: number;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string;
  createdAt: string;
}

export interface InventoryItemResponse {
  id: string;
  playerId: string;
  itemCode: string;
  name: string;
  quantity: number;
  equipped: boolean;
  updatedAt: string;
}

export interface PurchaseResponse {
  transaction: TransactionResponse;
  wallet: WalletResponse;
  inventoryItem?: InventoryItemResponse;
}

export interface CreateMapRequest {
  title: string;
  description: string;
  tags?: string[];
  status: MapStatus;
}

export interface CreateMapVersionRequest {
  versionLabel: string;
  releaseNotes: string;
}

export interface MapVersionResponse {
  id: string;
  mapId: string;
  versionLabel: string;
  releaseNotes: string;
  createdAt: string;
}

export interface VoteMapRequest {
  value: -1 | 1;
}

export interface TestMapRequest {
  completed: boolean;
}

export interface FavoriteMapRequest {
  favorited: boolean;
}

export interface ActionAcceptedResponse {
  accepted: boolean;
}

export interface MapStatsResponse {
  mapId: string;
  versionCount: number;
  voteScore: number;
  upvotes: number;
  downvotes: number;
  completedTests: number;
  favorites: number;
  popularityScore: number;
}

export interface MapSummary {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  tags: string[];
  status: MapStatus;
  popularityScore: number;
  latestVersionLabel?: string;
  createdAt: string;
  updatedAt: string;
  stats: MapStatsResponse;
}

export interface MapDetailResponse extends MapSummary {
  versions: MapVersionResponse[];
}

export interface MapInteractionResponse extends ActionAcceptedResponse {
  map: MapSummary;
}

export interface CreatorMapStatsResponse {
  creatorId: string;
  totalMaps: number;
  publishedMaps: number;
  totalVotes: number;
  totalTests: number;
  totalFavorites: number;
  averagePopularityScore: number;
}

export interface AdminDashboardSummary {
  activePlayers: number;
  dailyMatches: number;
  virtualRevenue: number;
  mapActivity: number;
  openModerationSignals: number;
  activeSanctions: number;
  settingsLastUpdated: string;
}

export interface MatchmakingSettings {
  rankedQueueMaxWaitSeconds: number;
  funQueueMaxWaitSeconds: number;
  matchSize: number;
}

export interface MmrSettings {
  placementMmr: number;
  rankedWinDelta: number;
  rankedLossDelta: number;
  unrankedWinDelta: number;
  unrankedLossDelta: number;
}

export interface EconomySettings {
  starterSoftBalance: number;
  starterHardBalance: number;
  purchaseEnabled: boolean;
  refundWindowHours: number;
}

export interface StudioSettingsResponse {
  matchmaking: MatchmakingSettings;
  mmr: MmrSettings;
  economy: EconomySettings;
  updatedAt: string;
  updatedBy?: string;
}

export interface UpdateStudioSettingsRequest {
  matchmaking?: Partial<MatchmakingSettings>;
  mmr?: Partial<MmrSettings>;
  economy?: Partial<EconomySettings>;
}

export interface AccountModerationRequest {
  action: AccountModerationAction;
  reason: string;
  durationHours?: number;
}

export interface MapModerationRequest {
  action: MapModerationAction;
  reason: string;
}

export interface ModerationActionResponse {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  action: string;
  reason: string;
  actorId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ModerationSignalResponse {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  reason: string;
  status: ModerationSignalStatus;
  source: string;
  createdAt: string;
}

export interface AdminPlayerResponse {
  id: string;
  email: string;
  role: "player" | "staff" | "admin";
  pseudo?: string;
  region?: string;
  bio?: string;
  createdAt: string;
}

export interface AdminUpdatePlayerRequest {
  role?: "player" | "staff" | "admin";
  email?: string;
  pseudo?: string;
  region?: string;
  bio?: string;
}

export interface StaffRankDistributionItem {
  rank: string;
  tier: string;
  division: string;
  count: number;
  avgWinRate: number;
}

export interface StaffRankAnalyticsResponse {
  distribution: StaffRankDistributionItem[];
  totalRankedPlayers: number;
  globalAvgWinRate: number;
}

export interface StaffMapAdminItem {
  id: string;
  title: string;
  creatorId: string;
  creatorPseudo?: string;
  status: MapStatus;
  popularityScore: number;
  reviewStatus: string;
  reportCount: number;
  voteScore: number;
  testCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
  lastModerationAt?: string;
}

export interface StaffActiveCreator {
  creatorId: string;
  pseudo?: string;
  mapCount: number;
  totalVotes: number;
  totalTests: number;
}

export interface StaffMapsAnalyticsResponse {
  topPlayed: StaffMapAdminItem[];
  topRated: StaffMapAdminItem[];
  growing: StaffMapAdminItem[];
  abandoned: StaffMapAdminItem[];
  activeCreators: StaffActiveCreator[];
}

export interface StaffEconomyItemStat {
  itemCode: string;
  name: string;
  salesCount: number;
  revenue: number;
  currencyType: CurrencyType;
}

export interface StaffEconomyAnalyticsResponse {
  revenueToday: number;
  revenueWeek: number;
  salesToday: number;
  salesWeek: number;
  topItems: StaffEconomyItemStat[];
}

export interface AdminCreateStoreItemRequest {
  itemCode: string;
  name: string;
  description?: string;
  currencyType: CurrencyType;
  price: number;
  sortOrder?: number;
}

export interface AdminUpdateStoreItemRequest {
  name?: string;
  description?: string;
  price?: number;
  active?: boolean;
  sortOrder?: number;
}

export interface AdminActivePlayerStatus {
  playerId: string;
  pseudo?: string;
  state: "online" | "in_queue" | "in_match";
  mode?: GameMode;
  matchId?: string;
  queuedAt?: string;
}

export interface AdminMatchParticipantDetail {
  playerId: string;
  pseudo?: string;
  outcome: "win" | "loss" | "draw";
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
}

export interface AdminMatchDetail {
  matchId: string;
  mode: GameMode;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  participants: AdminMatchParticipantDetail[];
}

export interface AdminRankConfigItem {
  id: string;
  mode: GameMode;
  rank: string;
  minMmr: number;
  maxMmr?: number;
  sortOrder: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId?: string;
  actorId: string;
  actorPseudo?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminTransactionJournalEntry {
  id: string;
  playerId: string;
  playerPseudo?: string;
  itemCode?: string;
  itemName?: string;
  currencyType: CurrencyType;
  unitPrice: number;
  quantity: number;
  amount: number;
  status: "accepted" | "rejected";
  reason?: string;
  createdAt: string;
}

export interface AdminSanctionEntry {
  id: string;
  userId: string;
  userPseudo?: string;
  actorId?: string;
  actorPseudo?: string;
  type: string;
  reason: string;
  status: string;
  startedAt: string;
  endsAt?: string;
}

export interface AdminCreateRankConfigRequest {
  mode: GameMode;
  rank: string;
  minMmr: number;
  maxMmr?: number;
  sortOrder: number;
}

export interface AdminUpdateRankConfigRequest {
  rank?: string;
  minMmr?: number;
  maxMmr?: number | null;
  sortOrder?: number;
}
