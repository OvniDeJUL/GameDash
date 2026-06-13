import type {
  AdminDashboardSummary,
  AuthTokensResponse,
  AuthUserResponse,
  CreatorMapStatsResponse,
  FavoriteMapRequest,
  InventoryItemResponse,
  LoginRequest,
  MapDetailResponse,
  MapInteractionResponse,
  MapStatsResponse,
  MapStatus,
  MapSummary,
  MapVersionResponse,
  MatchHistoryItem,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  PurchaseRequest,
  PurchaseResponse,
  QueueJoinRequest,
  QueueStatusResponse,
  RankConfig,
  RefreshRequest,
  RegisterRequest,
  StoreItem,
  StudioSettingsResponse,
  TestMapRequest,
  TransactionResponse,
  UpdatePlayerProfileRequest,
  VoteMapRequest,
  WalletResponse,
  CreateMapRequest,
  CreateMapVersionRequest,
  ModerationActionResponse,
  ModerationSignalResponse,
  MatchResultRequest,
  MatchResultResponse,
  LevelReward,
  ProgressionRulesResponse,
  PlayerProfileResponse,
  UpdateStudioSettingsRequest
} from "@gamedash/contracts";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "unknown", err.message ?? res.statusText);
  }

  return body as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export const auth = {
  register: (data: RegisterRequest) =>
    request<AuthTokensResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: LoginRequest) =>
    request<AuthTokensResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  refresh: (data: RefreshRequest) =>
    request<AuthTokensResponse>("/auth/refresh", { method: "POST", body: JSON.stringify(data) }),

  logout: (refreshToken: string, token: string) =>
    request<void>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }), token }),

  me: (token: string) =>
    request<AuthUserResponse>("/auth/me", { token })
};

// ─── Players ───────────────────────────────────────────────────────────────

export const players = {
  getMyProfile: (token: string) =>
    request<PlayerProfileResponse>("/players/me/profile", { token }),

  updateMyProfile: (data: UpdatePlayerProfileRequest, token: string) =>
    request<PlayerProfileResponse>("/players/me/profile", { method: "PATCH", body: JSON.stringify(data), token }),

  getMmr: (playerId: string, token: string) =>
    request<PlayerMmrResponse>(`/players/${playerId}/mmr`, { token }),

  getMatches: (playerId: string, token: string) =>
    request<MatchHistoryItem[]>(`/players/${playerId}/matches`, { token }),

  getProgression: (playerId: string, token: string) =>
    request<PlayerProgressionResponse>(`/players/${playerId}/progression`, { token }),

  getRanksConfig: (token: string) =>
    request<RankConfig[]>("/players/ranks/config", { token }),

  getProgressionRewards: (token: string) =>
    request<LevelReward[]>("/players/progression/rewards", { token }),

  getProgressionRules: (token: string) =>
    request<ProgressionRulesResponse>("/players/progression/rules", { token })
};

// ─── Matchmaking ───────────────────────────────────────────────────────────

export const matchmaking = {
  joinQueue: (data: QueueJoinRequest, token: string) =>
    request<QueueStatusResponse>("/matchmaking/queue/join", { method: "POST", body: JSON.stringify(data), token }),

  leaveQueue: (token: string) =>
    request<QueueStatusResponse>("/matchmaking/queue/leave", { method: "POST", body: "{}", token }),

  getStatus: (token: string) =>
    request<QueueStatusResponse>("/matchmaking/queue/status", { token })
};

// ─── Matches ───────────────────────────────────────────────────────────────

export const matches = {
  submitResult: (matchId: string, data: MatchResultRequest, token: string) =>
    request<MatchResultResponse>(`/matches/${matchId}/result`, { method: "POST", body: JSON.stringify(data), token })
};

// ─── Economy ───────────────────────────────────────────────────────────────

export const economy = {
  getStoreItems: (token: string) =>
    request<StoreItem[]>("/economy/store/items", { token }),

  getWallet: (token: string) =>
    request<WalletResponse>("/economy/wallet", { token }),

  getInventory: (token: string) =>
    request<InventoryItemResponse[]>("/economy/inventory", { token }),

  getTransactions: (token: string) =>
    request<TransactionResponse[]>("/economy/transactions", { token }),

  purchase: (data: PurchaseRequest, token: string) =>
    request<PurchaseResponse>("/economy/transactions/purchase", { method: "POST", body: JSON.stringify(data), token }),

  equipItem: (itemCode: string, token: string) =>
    request<InventoryItemResponse>(`/economy/inventory/${itemCode}/equip`, { method: "PATCH", body: "{}", token })
};

// ─── Maps ──────────────────────────────────────────────────────────────────

export const maps = {
  list: (params: { q?: string; tag?: string; status?: MapStatus; creatorId?: string }, token: string) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
    return request<MapSummary[]>(`/maps?${qs}`, { token });
  },

  create: (data: CreateMapRequest, token: string) =>
    request<MapSummary>("/maps", { method: "POST", body: JSON.stringify(data), token }),

  get: (mapId: string, token: string) =>
    request<MapDetailResponse>(`/maps/${mapId}`, { token }),

  getStats: (mapId: string, token: string) =>
    request<MapStatsResponse>(`/maps/${mapId}/stats`, { token }),

  createVersion: (mapId: string, data: CreateMapVersionRequest, token: string) =>
    request<MapVersionResponse>(`/maps/${mapId}/versions`, { method: "POST", body: JSON.stringify(data), token }),

  vote: (mapId: string, data: VoteMapRequest, token: string) =>
    request<MapInteractionResponse>(`/maps/${mapId}/votes`, { method: "POST", body: JSON.stringify(data), token }),

  test: (mapId: string, data: TestMapRequest, token: string) =>
    request<MapInteractionResponse>(`/maps/${mapId}/tests`, { method: "POST", body: JSON.stringify(data), token }),

  favorite: (mapId: string, data: FavoriteMapRequest, token: string) =>
    request<MapInteractionResponse>(`/maps/${mapId}/favorites`, { method: "POST", body: JSON.stringify(data), token }),

  getCreatorStats: (creatorId: string, token: string) =>
    request<CreatorMapStatsResponse>(`/maps/creators/${creatorId}/stats`, { token })
};

// ─── Admin ─────────────────────────────────────────────────────────────────

export const admin = {
  getDashboard: (token: string) =>
    request<AdminDashboardSummary>("/admin/dashboard", { token }),

  getSettings: (token: string) =>
    request<StudioSettingsResponse>("/admin/settings", { token }),

  updateSettings: (data: UpdateStudioSettingsRequest, token: string) =>
    request<StudioSettingsResponse>("/admin/settings", { method: "PATCH", body: JSON.stringify(data), token }),

  getModerationSignals: (token: string) =>
    request<ModerationSignalResponse[]>("/admin/moderation/signals", { token }),

  getModerationHistory: (token: string) =>
    request<ModerationActionResponse[]>("/admin/moderation/history", { token }),

  moderateAccount: (userId: string, data: { action: string; reason: string; durationHours?: number }, token: string) =>
    request<ModerationActionResponse>(`/admin/moderation/accounts/${userId}/actions`, { method: "POST", body: JSON.stringify(data), token }),

  moderateMap: (mapId: string, data: { action: string; reason: string }, token: string) =>
    request<ModerationActionResponse>(`/admin/moderation/maps/${mapId}/actions`, { method: "POST", body: JSON.stringify(data), token })
};
