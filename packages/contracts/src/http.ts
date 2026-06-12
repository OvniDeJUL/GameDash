export type Role = "player" | "staff" | "admin";
export type GameMode = "ranked" | "unranked" | "fun";
export type MapStatus = "draft" | "beta" | "stable" | "hidden";
export type RewardType = "soft_currency" | "cosmetic" | "title";
export type CurrencyType = "soft" | "hard";
export type TransactionStatus = "accepted" | "rejected";
export type AccountModerationAction = "warn" | "suspend" | "ban";
export type MapModerationAction = "hide" | "restore" | "feature";
export type ModerationTargetType = "account" | "map";
export type ModerationSignalStatus = "open" | "reviewed" | "dismissed";

export interface HealthResponse {
  status: "ok" | "degraded";
  time: string;
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
