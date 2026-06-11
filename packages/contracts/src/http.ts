export type Role = "player" | "staff" | "admin";
export type GameMode = "ranked" | "unranked" | "fun";
export type MapStatus = "draft" | "beta" | "stable" | "hidden";
export type RewardType = "soft_currency" | "cosmetic" | "title";

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
  name: string;
  currencyType: "soft" | "hard";
  price: number;
}

export interface WalletResponse {
  softBalance: number;
  hardBalance: number;
}

export interface PurchaseRequest {
  storeItemId: string;
  quantity: number;
}

export interface TransactionResponse {
  transactionId: string;
  status: "accepted" | "rejected";
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
  mapId: string;
  versionLabel: string;
  createdAt: string;
}

export interface VoteMapRequest {
  value: -1 | 1;
}

export interface TestMapRequest {
  completed: boolean;
}

export interface ActionAcceptedResponse {
  accepted: boolean;
}

export interface MapSummary {
  id: string;
  title: string;
  status: MapStatus;
  popularityScore: number;
}

export interface AdminDashboardSummary {
  activePlayers: number;
  dailyMatches: number;
  virtualRevenue: number;
  mapActivity: number;
}
