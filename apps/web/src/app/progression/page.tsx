"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthUserResponse,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  MatchHistoryItem,
  GameMode
} from "@gamedash/contracts";
import { auth as authApi, players } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";
import { Nav } from "../../components/Nav";

function getRankClass(rank: string): string {
  const r = rank.toLowerCase();
  if (r.includes("bronze")) return "rank-bronze";
  if (r.includes("silver")) return "rank-silver";
  if (r.includes("gold")) return "rank-gold";
  if (r.includes("platinum")) return "rank-platinum";
  return "rank-casual";
}

export default function ProgressionPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [mmr, setMmr] = useState<PlayerMmrResponse | null>(null);
  const [progression, setProgression] = useState<PlayerProgressionResponse | null>(null);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<GameMode | "all">("all");

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        setUser(me);
        const [mmrData, progData, matchData] = await Promise.allSettled([
          withToken((t) => players.getMmr(me.id, t)),
          withToken((t) => players.getProgression(me.id, t)),
          withToken((t) => players.getMatches(me.id, t))
        ]);
        if (mmrData.status === "fulfilled") setMmr(mmrData.value);
        if (progData.status === "fulfilled") setProgression(progData.value);
        if (matchData.status === "fulfilled") setMatches(matchData.value);
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
        <main className="page" style={{ textAlign: "center", paddingTop: "4rem" }}>
          <div style={{ color: "var(--cyan)", fontSize: "1.2rem" }}>Loading…</div>
        </main>
      </>
    );
  }

  const filteredMatches = modeFilter === "all"
    ? matches
    : matches.filter((m) => m.mode === modeFilter);

  const winCount = matches.filter((m) => m.result === "win").length;
  const lossCount = matches.filter((m) => m.result === "loss").length;
  const winrate = matches.length > 0 ? Math.round((winCount / matches.length) * 100) : 0;

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />

      <main className="page">

        {/* MMR & Ranks */}
        <section>
          <p className="section-title">MMR & Ranks</p>
          <div className="grid-3">
            {mmr?.ratings.map((rating) => (
              <div key={rating.mode} className="card" style={{ gap: "0.75rem" }}>
                <div className="card-header">
                  <span className="card-title">{rating.mode}</span>
                  <span className={`rank-badge ${getRankClass(rating.rank)}`}>{rating.rank}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                  <span style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    color: "var(--cyan)",
                    lineHeight: 1
                  }}>
                    {rating.mmr}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
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
                    <div className="xp-display">{progression.lifetimeXp.toLocaleString()} XP</div>
                  </div>
                </div>
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={progression.levelProgressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="progress-fill" style={{ width: `${progression.levelProgressPercent}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="xp-detail">{progression.currentLevelXp} XP in level</span>
                  {progression.xpToNextLevel !== undefined && (
                    <span className="xp-detail">{progression.xpToNextLevel} to next level</span>
                  )}
                </div>

                {/* Global match stats */}
                <div style={{ marginTop: "0.5rem", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem", textAlign: "center" }}>
                  {[
                    { label: "Matches", val: matches.length },
                    { label: "Wins", val: winCount },
                    { label: "Winrate", val: `${winrate}%` }
                  ].map(({ label, val }) => (
                    <div key={label} style={{ padding: "0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--cyan)" }}>{val}</div>
                      <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Level rewards</span>
                  <span className="tag tag-purple">{progression.rewards.length} claimed</span>
                </div>
                <div className="reward-list">
                  {progression.rewards.length === 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No rewards yet. Play more matches!</div>
                  )}
                  {progression.rewards.map((r) => (
                    <div key={r.code} className="reward-item">
                      <span className="reward-lv">Lv {r.level}</span>
                      <span className="reward-name">{r.label}</span>
                      {r.quantity && <span className="tag tag-gold">×{r.quantity}</span>}
                      <span className="reward-claimed">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

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
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "0.5rem 0" }}>
                  No matches found.
                </div>
              )}
              {filteredMatches.map((match) => (
                <div key={match.matchId} className={`match-item ${match.result ?? ""}`}>
                  <span className={`match-result ${match.result ?? ""}`}>{match.result ?? "?"}</span>
                  <span className="match-mode">{match.mode}</span>
                  <span style={{ flex: 1, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {match.createdAt ? new Date(match.createdAt).toLocaleDateString() : ""}
                  </span>
                  {match.mmrBefore !== undefined && match.mmrAfter !== undefined && (
                    <span className="match-mmr">{match.mmrBefore} → {match.mmrAfter}</span>
                  )}
                  {match.mmrDelta !== undefined && (
                    <span className={`match-delta ${match.mmrDelta >= 0 ? "positive" : "negative"}`}>
                      {match.mmrDelta >= 0 ? "+" : ""}{match.mmrDelta}
                    </span>
                  )}
                  {match.rankBefore && match.rankAfter && match.rankBefore !== match.rankAfter && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
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
