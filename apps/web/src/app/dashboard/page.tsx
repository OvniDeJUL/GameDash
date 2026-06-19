"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AuthUserResponse,
  MatchFormat,
  PendingWarning,
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
  const [queueFormat, setQueueFormat] = useState<MatchFormat>("1v1");
  const [queueLoading, setQueueLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchResult, setMatchResult] = useState<MatchHistoryItem | null>(null);
  const [pendingWarnings, setPendingWarnings] = useState<PendingWarning[]>([]);
  const matchStartedAtRef = useRef<number | null>(null);
  const userRef = useRef<AuthUserResponse | null>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  const refreshStats = useCallback(async (userId: string) => {
    const [mmrData, progData, matchData] = await Promise.allSettled([
      withToken((t) => players.getMmr(userId, t)),
      withToken((t) => players.getProgression(userId, t)),
      withToken((t) => players.getMatches(userId, t))
    ]);
    if (mmrData.status === "fulfilled") setMmr(mmrData.value);
    if (progData.status === "fulfilled") setProgression(progData.value);
    if (matchData.status === "fulfilled") {
      const list = matchData.value;
      setRecentMatches(list.slice(0, 5));
      const latest = list[0];
      if (latest?.finishedAt) setMatchResult(latest);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        setUser(me);
        userRef.current = me;
        const [mmrData, progData, qData, matchData, warnData] = await Promise.allSettled([
          withToken((t) => players.getMmr(me.id, t)),
          withToken((t) => players.getProgression(me.id, t)),
          withToken((t) => matchmaking.getStatus(t)),
          withToken((t) => players.getMatches(me.id, t)),
          withToken((t) => players.getPendingWarnings(t))
        ]);
        if (mmrData.status === "fulfilled") setMmr(mmrData.value);
        if (progData.status === "fulfilled") setProgression(progData.value);
        if (qData.status === "fulfilled") setQueueStatus(qData.value);
        if (matchData.status === "fulfilled") setRecentMatches(matchData.value.slice(0, 5));
        if (warnData.status === "fulfilled" && warnData.value.length > 0) setPendingWarnings(warnData.value);
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

  // Countdown tick while in_match
  useEffect(() => {
    if (queueStatus?.state !== "in_match") {
      setCountdown(null);
      matchStartedAtRef.current = null;
      return;
    }
    if (!matchStartedAtRef.current) {
      matchStartedAtRef.current = Date.now();
    }
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - matchStartedAtRef.current!) / 1000);
      setCountdown(Math.max(0, (queueStatus?.matchDurationSeconds ?? 15) - elapsed));
    }, 250);
    return () => clearInterval(tick);
  }, [queueStatus?.state]);

  // Poll queue status while in_match; refresh stats on match end
  useEffect(() => {
    if (queueStatus?.state !== "in_match") return;
    const poll = setInterval(async () => {
      try {
        const s = await withToken((t) => matchmaking.getStatus(t));
        setQueueStatus(s);
        if (s.state !== "in_match" && userRef.current) {
          await refreshStats(userRef.current.id);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [queueStatus?.state, refreshStats]);

  async function handleJoinQueue() {
    setQueueLoading(true);
    setMatchResult(null);
    try {
      const s = await withToken((t) => matchmaking.joinQueue({ mode: queueMode, format: queueFormat }, t));
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

  async function handleDismissWarning(id: string) {
    try {
      await withToken((t) => players.acknowledgeWarning(id, t));
    } catch { /* ignore */ }
    setPendingWarnings((prev) => prev.filter((w) => w.id !== id));
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

      {pendingWarnings[0] && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <div style={{
            background: "var(--bg, #0f1117)",
            border: "1px solid var(--red, #ef4444)",
            borderRadius: "0.75rem",
            padding: "2rem",
            maxWidth: "480px",
            width: "90%"
          }}>
            <h2 style={{ color: "var(--red, #ef4444)", marginTop: 0, marginBottom: "0.5rem" }}>
              Warning from staff
            </h2>
            <p style={{ color: "var(--text-muted, #888)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
              {new Date(pendingWarnings[0].createdAt).toLocaleString()}
            </p>
            <p style={{ marginBottom: "1.5rem", lineHeight: 1.6 }}>{pendingWarnings[0].reason}</p>
            {pendingWarnings.length > 1 && (
              <p style={{ color: "var(--text-muted, #888)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                {pendingWarnings.length - 1} more warning{pendingWarnings.length > 2 ? "s" : ""} pending.
              </p>
            )}
            <button
              className="btn btn-primary"
              onClick={() => handleDismissWarning(pendingWarnings[0]!.id)}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      <main className="page">
        {error && <div className="error-banner" role="alert">{error}</div>}

        {/* Match result banner */}
        {matchResult && queueStatus?.state !== "in_match" && (
          <div
            role="alert"
            style={{
              padding: "1rem 1.5rem",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              cursor: "pointer",
              background: matchResult.result === "win" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${matchResult.result === "win" ? "var(--green, #22c55e)" : "var(--red, #ef4444)"}`
            }}
            onClick={() => setMatchResult(null)}
          >
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: matchResult.result === "win" ? "var(--green, #22c55e)" : "var(--red, #ef4444)" }}>
              {matchResult.result?.toUpperCase() ?? "DRAW"}
            </span>
            {matchResult.mmrDelta !== undefined && (
              <span style={{ color: matchResult.mmrDelta >= 0 ? "var(--green, #22c55e)" : "var(--red, #ef4444)", fontWeight: 600 }}>
                MMR {matchResult.mmrDelta >= 0 ? "+" : ""}{matchResult.mmrDelta}
              </span>
            )}
            {matchResult.xpAwarded !== undefined && (
              <span style={{ color: "var(--cyan)", fontWeight: 600 }}>+{matchResult.xpAwarded} XP</span>
            )}
            {matchResult.durationSeconds !== undefined && (
              <span style={{ color: "var(--text-muted, #888)", fontSize: "0.85rem" }}>{matchResult.durationSeconds}s</span>
            )}
            <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: "0.75rem" }}>click to dismiss</span>
          </div>
        )}

        {/* Hero */}
        {user && (
          <section aria-label="Player overview">
            <div className="hero-card">
              <div className="hero-avatar" style={{ padding: 0, overflow: "hidden" }}>
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.pseudo ?? user.email}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const fallback = document.createElement("span");
                      fallback.textContent = (profile?.pseudo ?? user.email).charAt(0).toUpperCase();
                      el.parentElement?.appendChild(fallback);
                    }}
                  />
                ) : (
                  (profile?.pseudo ?? user.email).charAt(0).toUpperCase()
                )}
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
                {rankedRating && (
                  <div>
                    <span className="hero-stat-value">{rankedRating.winRate}%</span>
                    <span className="hero-stat-label">Win rate</span>
                  </div>
                )}
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

              {queueStatus?.state === "in_match" && countdown !== null && (
                <div style={{
                  textAlign: "center",
                  padding: "1.25rem 0",
                  borderRadius: "0.5rem",
                  background: "rgba(0,200,255,0.08)",
                  border: "1px solid var(--cyan)",
                  marginBottom: "0.75rem"
                }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #888)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {queueStatus.format === "3v3" ? "3v3 match in progress" : "Match in progress"}
                  </div>
                  <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: "2.5rem", fontWeight: 700, color: "var(--cyan)", lineHeight: 1 }}>
                    {countdown}s
                  </div>
                  {queueStatus.format === "3v3" && queueStatus.teammateIds && queueStatus.teammateIds.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #888)", marginTop: "0.25rem" }}>
                      teammates: {queueStatus.teammateIds.map((id) => id.slice(0, 8)).join(", ")}…
                    </div>
                  )}
                  {queueStatus.format !== "3v3" && queueStatus.opponentPlayerId && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #888)", marginTop: "0.25rem" }}>
                      vs {queueStatus.opponentPlayerId.slice(0, 8)}…
                    </div>
                  )}
                </div>
              )}

              {queueStatus && queueStatus.state === "in_queue" && (
                <div className="queue-status">
                  <span className="queue-indicator" />
                  <div className="queue-text">
                    <div className="queue-state">searching{queueStatus.format === "3v3" ? " (3v3 — need 6 players)" : ""}…</div>
                    {queueStatus.matchId && (
                      <div className="queue-detail">Match {queueStatus.matchId.slice(0, 8)}…</div>
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

              <div className="form-group">
                <label className="form-label">Format</label>
                <select
                  className="form-input"
                  value={queueFormat}
                  onChange={(e) => setQueueFormat(e.target.value as MatchFormat)}
                  disabled={queueLoading || inQueue}
                >
                  <option value="1v1">1v1 — Solo</option>
                  <option value="3v3">3v3 — Team</option>
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
                    {match.format === "3v3" && (
                      <span className="tag tag-purple" style={{ fontSize: "0.7rem" }}>3v3</span>
                    )}
                    {match.durationSeconds !== undefined && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #888)" }}>{match.durationSeconds}s</span>
                    )}
                    {match.mmrDelta !== undefined && (
                      <span className={`match-delta ${match.mmrDelta >= 0 ? "positive" : "negative"}`}>
                        {match.mmrDelta >= 0 ? "+" : ""}{match.mmrDelta} MMR
                      </span>
                    )}
                    {match.xpAwarded !== undefined && (
                      <span className="match-delta positive">+{match.xpAwarded} XP</span>
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
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #888)", display: "flex", gap: "0.75rem" }}>
                    <span style={{ color: "var(--green, #22c55e)" }}>{r.wins}W</span>
                    <span style={{ color: "var(--red, #ef4444)" }}>{r.losses}L</span>
                    <span>{r.winRate}% WR</span>
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
