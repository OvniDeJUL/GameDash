"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";
import type {
  AuthUserResponse,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  MatchHistoryItem,
  GameMode,
  RankConfig,
} from "@gamedash/contracts";
import { auth as authApi, players } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";
import { Nav } from "../../components/Nav";

// ─── Tier colours ─────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#94a3b8",
  Gold: "#f59e0b",
  Platinum: "#00b4d8",
  Diamond: "#8b5cf6",
  Master: "#ec4899",
  Grandmaster: "#ef4444",
  Challenger: "#00d4ff",
};

function getTierFromRank(rank: string): string {
  const r = rank.toLowerCase();
  if (r.includes("grandmaster")) return "Grandmaster";
  if (r.includes("master")) return "Master";
  if (r.includes("challenger")) return "Challenger";
  if (r.includes("diamond")) return "Diamond";
  if (r.includes("platinum")) return "Platinum";
  if (r.includes("gold")) return "Gold";
  if (r.includes("silver")) return "Silver";
  if (r.includes("bronze")) return "Bronze";
  return "Unranked";
}

function getRankClass(rank: string): string {
  const r = rank.toLowerCase();
  if (r.includes("bronze")) return "rank-bronze";
  if (r.includes("silver")) return "rank-silver";
  if (r.includes("gold")) return "rank-gold";
  if (r.includes("platinum")) return "rank-platinum";
  return "rank-casual";
}

// ─── Chart data builders ──────────────────────────────────────────────────────

interface MmrDataPoint {
  match: number;
  mmr: number;
  date: string;
  result?: string;
  delta?: number;
}

function buildMmrProgressionData(
  matchList: MatchHistoryItem[],
  mode: GameMode
): MmrDataPoint[] {
  return matchList
    .filter((m) => m.mode === mode && m.mmrAfter !== undefined)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map((m, i) => ({
      match: i + 1,
      mmr: m.mmrAfter as number,
      date: new Date(m.createdAt).toLocaleDateString("fr-FR"),
      result: m.result,
      delta: m.mmrDelta,
    }));
}

interface RankLadderItem {
  tier: string;
  offset: number;
  size: number;
  color: string;
  min: number;
  max: number;
}

function buildRankLadderData(
  ranksConfig: RankConfig[],
  mode: GameMode
): RankLadderItem[] {
  const tierBounds: Record<string, { min: number; max: number }> = {};

  for (const r of ranksConfig.filter((rc) => rc.mode === mode)) {
    const tier = getTierFromRank(r.rank);
    const maxMmr = r.maxMmr ?? r.minMmr + 500;
    const curr = tierBounds[tier];
    if (!curr) {
      tierBounds[tier] = { min: r.minMmr, max: maxMmr };
    } else {
      tierBounds[tier] = {
        min: Math.min(curr.min, r.minMmr),
        max: Math.max(curr.max, maxMmr),
      };
    }
  }

  return Object.entries(tierBounds)
    .sort(([, a], [, b]) => a.min - b.min)
    .map(([tier, { min, max }]) => ({
      tier,
      offset: min,
      size: max - min,
      color: TIER_COLORS[tier] ?? "#475569",
      min,
      max,
    }));
}

// ─── Custom tooltips ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MmrTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MmrDataPoint;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-bright)",
        borderRadius: 8,
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{d.date}</div>
      <div
        style={{
          fontFamily: "Rajdhani, sans-serif",
          fontSize: "1.2rem",
          fontWeight: 700,
          color: "var(--cyan)",
        }}
      >
        {d.mmr} MMR
      </div>
      {d.delta !== undefined && (
        <div
          style={{
            color: d.delta >= 0 ? "var(--green)" : "var(--red)",
            fontWeight: 600,
          }}
        >
          {d.delta >= 0 ? "+" : ""}
          {d.delta}
        </div>
      )}
      {d.result && (
        <div
          style={{
            color: "var(--text-secondary)",
            textTransform: "capitalize",
            marginTop: 2,
          }}
        >
          {d.result}
        </div>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RankLadderTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (payload.find((p: any) => p.dataKey === "size") as any)
    ?.payload as RankLadderItem | undefined;
  if (!d) return null;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-bright)",
        borderRadius: 8,
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ color: d.color, fontWeight: 700, marginBottom: 2 }}>
        {d.tier}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {d.min} – {d.max} MMR
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressionPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [mmr, setMmr] = useState<PlayerMmrResponse | null>(null);
  const [progression, setProgression] =
    useState<PlayerProgressionResponse | null>(null);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [ranksConfig, setRanksConfig] = useState<RankConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<GameMode | "all">("all");
  const [chartMode, setChartMode] = useState<GameMode>("ranked");

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        setUser(me);
        const [mmrData, progData, matchData, ranksData] =
          await Promise.allSettled([
            withToken((t) => players.getMmr(me.id, t)),
            withToken((t) => players.getProgression(me.id, t)),
            withToken((t) => players.getMatches(me.id, t)),
            withToken((t) => players.getRanksConfig(t)),
          ]);
        if (mmrData.status === "fulfilled") setMmr(mmrData.value);
        if (progData.status === "fulfilled") setProgression(progData.value);
        if (matchData.status === "fulfilled") setMatches(matchData.value);
        if (ranksData.status === "fulfilled") setRanksConfig(ranksData.value);
      } catch {
        await logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <>
        <Nav user={null} onLogout={handleLogout} />
        <main
          className="page"
          style={{ textAlign: "center", paddingTop: "4rem" }}
        >
          <div style={{ color: "var(--cyan)", fontSize: "1.2rem" }}>
            Loading…
          </div>
        </main>
      </>
    );
  }

  const filteredMatches =
    modeFilter === "all"
      ? matches
      : matches.filter((m) => m.mode === modeFilter);

  const winCount = matches.filter((m) => m.result === "win").length;
  const winrate =
    matches.length > 0 ? Math.round((winCount / matches.length) * 100) : 0;

  const mmrProgressionData = buildMmrProgressionData(matches, chartMode);
  const rankLadderData = buildRankLadderData(ranksConfig, "ranked");
  const maxLadderMmr = rankLadderData.length
    ? Math.max(...rankLadderData.map((d) => d.max))
    : 5000;
  const currentRankedMmr = mmr?.ratings.find((r) => r.mode === "ranked")?.mmr;

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />

      <main className="page">

        {/* MMR & Ranks */}
        <section>
          <p className="section-title">MMR & Ranks</p>
          <div className="grid-3">
            {mmr?.ratings.map((rating) => (
              <div
                key={rating.mode}
                className="card"
                style={{ gap: "0.75rem" }}
              >
                <div className="card-header">
                  <span className="card-title">{rating.mode}</span>
                  <span className={`rank-badge ${getRankClass(rating.rank)}`}>
                    {rating.rank}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontSize: "2.5rem",
                      fontWeight: 700,
                      color: "var(--cyan)",
                      lineHeight: 1,
                    }}
                  >
                    {rating.mmr}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    MMR
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* XP & Level */}
        {progression && (
          <section>
            <p className="section-title">Account progression</p>
            <div className="grid-2" style={{ alignItems: "start" }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Level</span>
                  <span className="tag tag-gold">Level {progression.level}</span>
                </div>
                <div className="level-display">
                  <div>
                    <span className="level-label">Current level</span>
                    <div className="level-number">{progression.level}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="xp-label">Lifetime XP</span>
                    <div className="xp-display">
                      {progression.lifetimeXp.toLocaleString()} XP
                    </div>
                  </div>
                </div>
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={progression.levelProgressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${progression.levelProgressPercent}%` }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="xp-detail">
                    {progression.currentLevelXp} XP in level
                  </span>
                  {progression.xpToNextLevel !== undefined && (
                    <span className="xp-detail">
                      {progression.xpToNextLevel} to next level
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: "0.5rem",
                    textAlign: "center",
                  }}
                >
                  {[
                    { label: "Matches", val: matches.length },
                    { label: "Wins", val: winCount },
                    { label: "Winrate", val: `${winrate}%` },
                  ].map(({ label, val }) => (
                    <div
                      key={label}
                      style={{
                        padding: "0.75rem",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Rajdhani, sans-serif",
                          fontSize: "1.4rem",
                          fontWeight: 700,
                          color: "var(--cyan)",
                        }}
                      >
                        {val}
                      </div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "var(--text-muted)",
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Level rewards</span>
                  <span className="tag tag-purple">
                    {progression.rewards.length} claimed
                  </span>
                </div>
                <div className="reward-list">
                  {progression.rewards.length === 0 && (
                    <div
                      style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                    >
                      No rewards yet. Play more matches!
                    </div>
                  )}
                  {progression.rewards.map((r) => (
                    <div key={r.code} className="reward-item">
                      <span className="reward-lv">Lv {r.level}</span>
                      <span className="reward-name">{r.label}</span>
                      {r.quantity && (
                        <span className="tag tag-gold">×{r.quantity}</span>
                      )}
                      <span className="reward-claimed">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Visualisations ──────────────────────────────────────────── */}
        <section>
          <p className="section-title">Visualisations</p>
          <div className="grid-2" style={{ alignItems: "start" }}>

            {/* MMR progression line chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">MMR progression</span>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {(["ranked", "unranked", "fun"] as GameMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={`tab-btn${chartMode === mode ? " active" : ""}`}
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.65rem" }}
                      onClick={() => setChartMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {mmrProgressionData.length === 0 ? (
                <div
                  style={{
                    height: 220,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  No {chartMode} match data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={mmrProgressionData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 18 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(56,189,248,0.08)"
                    />
                    <XAxis
                      dataKey="match"
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                      label={{
                        value: "Match #",
                        position: "insideBottom",
                        offset: -10,
                        fill: "var(--text-muted)",
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                      domain={["auto", "auto"]}
                      width={44}
                    />
                    <RechartsTooltip content={<MmrTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="mmr"
                      stroke="var(--cyan)"
                      strokeWidth={2}
                      dot={{ fill: "var(--cyan)", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "var(--cyan)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Rank ladder (ranked mode only) */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Rank distribution</span>
                {currentRankedMmr !== undefined && (
                  <span className="tag tag-cyan">{currentRankedMmr} MMR</span>
                )}
              </div>

              {rankLadderData.length === 0 ? (
                <div
                  style={{
                    height: 220,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  Rank config unavailable.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    layout="vertical"
                    data={rankLadderData}
                    barSize={18}
                    margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(56,189,248,0.08)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, maxLadderMmr]}
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="tier"
                      width={90}
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    />
                    <RechartsTooltip content={<RankLadderTooltip />} />
                    {/* transparent offset bar to push visible bar to correct MMR position */}
                    <Bar dataKey="offset" stackId="ladder" fill="transparent" />
                    <Bar dataKey="size" stackId="ladder" radius={[0, 4, 4, 0]}>
                      {rankLadderData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={entry.color}
                          fillOpacity={0.75}
                        />
                      ))}
                    </Bar>
                    {currentRankedMmr !== undefined && (
                      <ReferenceLine
                        x={currentRankedMmr}
                        stroke="#00d4ff"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        label={{
                          value: "You",
                          position: "insideTopRight",
                          fill: "#00d4ff",
                          fontSize: 10,
                        }}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* Match history */}
        <section>
          <p className="section-title">Match history</p>
          <div className="card">
            <div className="card-header">
              <span className="card-title">All matches</span>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {(["all", "ranked", "unranked", "fun"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`tab-btn${modeFilter === mode ? " active" : ""}`}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "0.7rem" }}
                    onClick={() => setModeFilter(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="match-list">
              {filteredMatches.length === 0 && (
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    padding: "0.5rem 0",
                  }}
                >
                  No matches found.
                </div>
              )}
              {filteredMatches.map((match) => (
                <div
                  key={match.matchId}
                  className={`match-item ${match.result ?? ""}`}
                >
                  <span className={`match-result ${match.result ?? ""}`}>
                    {match.result ?? "?"}
                  </span>
                  <span className="match-mode">{match.mode}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {match.createdAt
                      ? new Date(match.createdAt).toLocaleDateString()
                      : ""}
                  </span>
                  {match.mmrBefore !== undefined &&
                    match.mmrAfter !== undefined && (
                      <span className="match-mmr">
                        {match.mmrBefore} → {match.mmrAfter}
                      </span>
                    )}
                  {match.mmrDelta !== undefined && (
                    <span
                      className={`match-delta ${match.mmrDelta >= 0 ? "positive" : "negative"}`}
                    >
                      {match.mmrDelta >= 0 ? "+" : ""}
                      {match.mmrDelta}
                    </span>
                  )}
                  {match.rankBefore &&
                    match.rankAfter &&
                    match.rankBefore !== match.rankAfter && (
                      <span
                        style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                      >
                        {match.rankBefore} → {match.rankAfter}
                      </span>
                    )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
