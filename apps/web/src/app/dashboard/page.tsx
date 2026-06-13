"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AuthUserResponse,
  PlayerMmrResponse,
  PlayerProgressionResponse,
  QueueStatusResponse,
  MatchHistoryItem,
  GameMode
} from "@gamedash/contracts";
import { auth as authApi, players, matchmaking } from "../../lib/api";
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [mmr, setMmr] = useState<PlayerMmrResponse | null>(null);
  const [progression, setProgression] = useState<PlayerProgressionResponse | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueMode, setQueueMode] = useState<GameMode>("ranked");
  const [queueLoading, setQueueLoading] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        setUser(me);
        const [mmrData, progData, qData, matchData] = await Promise.allSettled([
          withToken((t) => players.getMmr(me.id, t)),
          withToken((t) => players.getProgression(me.id, t)),
          withToken((t) => matchmaking.getStatus(t)),
          withToken((t) => players.getMatches(me.id, t))
        ]);
        if (mmrData.status === "fulfilled") setMmr(mmrData.value);
        if (progData.status === "fulfilled") setProgression(progData.value);
        if (qData.status === "fulfilled") setQueueStatus(qData.value);
        if (matchData.status === "fulfilled") setRecentMatches(matchData.value.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        await logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleJoinQueue() {
    setQueueLoading(true);
    try {
      const s = await withToken((t) => matchmaking.joinQueue({ mode: queueMode }, t));
      setQueueStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Queue error");
    } finally { setQueueLoading(false); }
  }

  async function handleLeaveQueue() {
    setQueueLoading(true);
    try {
      const s = await withToken((t) => matchmaking.leaveQueue(t));
      setQueueStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Queue error");
    } finally { setQueueLoading(false); }
  }

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

  const profile = user?.profile;
  const rankedRating = mmr?.ratings.find((r) => r.mode === "ranked");
  const inQueue = queueStatus?.state === "in_queue" || queueStatus?.state === "in_match";

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />

      <main className="page">
        {error && <div className="error-banner" role="alert">{error}</div>}

        {/* Hero */}
        {user && (
          <section aria-label="Player overview">
            <div className="hero-card">
              <div className="hero-avatar">
                {(profile?.pseudo ?? user.email).charAt(0).toUpperCase()}
              </div>
              <div className="hero-info">
                <h1>{profile?.pseudo ?? user.email}</h1>
                <div className="hero-meta">
                  {profile?.region && <span className="tag tag-cyan">{profile.region}</span>}
                  {progression && <span className="tag tag-gold">Level {progression.level}</span>}
                  {rankedRating && (
                    <span className={`tag ${rankedRating.rank.toLowerCase().includes("bronze") ? "tag-purple" : "tag-cyan"}`}>
                      {rankedRating.rank}
                    </span>
                  )}
                  {queueStatus && (
                    <span className="tag tag-green">{queueStatus.state.replace("_", " ")}</span>
                  )}
                </div>
              </div>
              <div className="hero-stats">
                <div>
                  <span className="hero-stat-value">{rankedRating?.mmr ?? "—"}</span>
                  <span className="hero-stat-label">MMR</span>
                </div>
                <div>
                  <span className="hero-stat-value">{progression?.lifetimeXp ?? "—"}</span>
                  <span className="hero-stat-label">XP total</span>
                </div>
                <div>
                  <span className="hero-stat-value">{progression?.level ?? "—"}</span>
                  <span className="hero-stat-label">Level</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Quick nav */}
        <section>
          <p className="section-title">Navigate</p>
          <div className="quick-nav">
            <Link href="/progression" className="quick-nav-card">
              <span className="quick-nav-icon">📈</span>
              Progression
            </Link>
            <Link href="/store" className="quick-nav-card">
              <span className="quick-nav-icon">🛒</span>
              Store
            </Link>
            <Link href="/community" className="quick-nav-card">
              <span className="quick-nav-icon">🗺️</span>
              Community
            </Link>
            <Link href="/account" className="quick-nav-card">
              <span className="quick-nav-icon">👤</span>
              Account
            </Link>
          </div>
        </section>

        {/* Matchmaking */}
        <section aria-label="Matchmaking">
          <p className="section-title">Matchmaking</p>
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Queue</span>
                {queueStatus && <span className="tag tag-cyan">{queueStatus.state.replace("_", " ")}</span>}
              </div>

              {queueStatus && queueStatus.state !== "online" && (
                <div className="queue-status">
                  <span className="queue-indicator" />
                  <div className="queue-text">
                    <div className="queue-state">{queueStatus.state.replace("_", " ")}</div>
                    {queueStatus.matchId && (
                      <div className="queue-detail">Match {queueStatus.matchId.slice(0, 8)}…</div>
                    )}
                    {queueStatus.opponentPlayerId && (
                      <div className="queue-detail">vs {queueStatus.opponentPlayerId}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Mode</label>
                <select
                  className="form-input"
                  value={queueMode}
                  onChange={(e) => setQueueMode(e.target.value as GameMode)}
                  disabled={queueLoading || inQueue}
                >
                  <option value="ranked">Ranked</option>
                  <option value="unranked">Unranked</option>
                  <option value="fun">Fun</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleJoinQueue} disabled={queueLoading || inQueue}>
                  {queueLoading ? "…" : "Join queue"}
                </button>
                <button className="btn" style={{ flex: 1 }} onClick={handleLeaveQueue} disabled={queueLoading || !inQueue}>
                  Leave
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Recent matches</span>
                <Link href="/progression" style={{ fontSize: "0.75rem", color: "var(--cyan)", textDecoration: "none" }}>
                  View all →
                </Link>
              </div>
              <div className="match-list">
                {recentMatches.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No matches yet.</div>
                )}
                {recentMatches.map((match) => (
                  <div key={match.matchId} className={`match-item ${match.result ?? ""}`}>
                    <span className={`match-result ${match.result ?? ""}`}>{match.result ?? "?"}</span>
                    <span className="match-mode">{match.mode}</span>
                    {match.mmrDelta !== undefined && (
                      <span className={`match-delta ${match.mmrDelta >= 0 ? "positive" : "negative"}`}>
                        {match.mmrDelta >= 0 ? "+" : ""}{match.mmrDelta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* MMR snapshot */}
        {mmr && (
          <section>
            <p className="section-title">MMR snapshot</p>
            <div className="grid-3">
              {mmr.ratings.map((r) => (
                <div key={r.mode} className="card" style={{ gap: "0.5rem" }}>
                  <div className="card-header">
                    <span className="card-title">{r.mode}</span>
                    <span className={`rank-badge ${getRankClass(r.rank)}`}>{r.rank}</span>
                  </div>
                  <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "2rem", fontWeight: 700, color: "var(--cyan)" }}>
                    {r.mmr}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Admin shortcut */}
        {(user?.role === "staff" || user?.role === "admin") && (
          <section>
            <p className="section-title">Studio</p>
            <Link href="/admin" className="quick-nav-card" style={{ maxWidth: 200 }}>
              <span className="quick-nav-icon">🏢</span>
              Backoffice
            </Link>
          </section>
        )}
      </main>
    </>
  );
}
