"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthUserResponse,
  AdminDashboardSummary,
  StudioSettingsResponse,
  ModerationSignalResponse,
  ModerationActionResponse
} from "@gamedash/contracts";
import { auth as authApi, admin } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";
import { Nav } from "../../components/Nav";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [dash, setDash] = useState<AdminDashboardSummary | null>(null);
  const [settings, setSettings] = useState<StudioSettingsResponse | null>(null);
  const [signals, setSignals] = useState<ModerationSignalResponse[]>([]);
  const [modHistory, setModHistory] = useState<ModerationActionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "settings" | "moderation">("overview");

  // Moderation form
  const [modTargetId, setModTargetId] = useState("");
  const [modAction, setModAction] = useState("warn");
  const [modReason, setModReason] = useState("");
  const [modDuration, setModDuration] = useState("");
  const [modType, setModType] = useState<"account" | "map">("account");
  const [modBusy, setModBusy] = useState(false);
  const [modNotice, setModNotice] = useState<string | null>(null);
  const [modError, setModError] = useState<string | null>(null);

  // Settings form
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [rankedWait, setRankedWait] = useState(90);
  const [matchSize, setMatchSize] = useState(2);
  const [rankedWin, setRankedWin] = useState(32);
  const [rankedLoss, setRankedLoss] = useState(-24);
  const [purchaseEnabled, setPurchaseEnabled] = useState(true);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        if (me.role !== "staff" && me.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
        const [dashData, settingsData, signalsData, histData] = await Promise.allSettled([
          withToken((t) => admin.getDashboard(t)),
          withToken((t) => admin.getSettings(t)),
          withToken((t) => admin.getModerationSignals(t)),
          withToken((t) => admin.getModerationHistory(t))
        ]);
        if (dashData.status === "fulfilled") setDash(dashData.value);
        if (settingsData.status === "fulfilled") {
          const s = settingsData.value;
          setSettings(s);
          setRankedWait(s.matchmaking.rankedQueueMaxWaitSeconds);
          setMatchSize(s.matchmaking.matchSize);
          setRankedWin(s.mmr.rankedWinDelta);
          setRankedLoss(s.mmr.rankedLossDelta);
          setPurchaseEnabled(s.economy.purchaseEnabled);
        }
        if (signalsData.status === "fulfilled") setSignals(signalsData.value);
        if (histData.status === "fulfilled") setModHistory(histData.value);
      } catch {
        await logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleModerate(e: React.FormEvent) {
    e.preventDefault();
    setModBusy(true);
    setModError(null);
    try {
      if (modType === "account") {
        await withToken((t) =>
          admin.moderateAccount(modTargetId, { action: modAction, reason: modReason, durationHours: modDuration ? Number(modDuration) : undefined }, t)
        );
      } else {
        await withToken((t) =>
          admin.moderateMap(modTargetId, { action: modAction, reason: modReason }, t)
        );
      }
      const hist = await withToken((t) => admin.getModerationHistory(t));
      setModHistory(hist);
      setModNotice("Action applied successfully.");
      setModTargetId("");
      setModReason("");
      setModDuration("");
      setTimeout(() => setModNotice(null), 3000);
    } catch (err) {
      setModError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setModBusy(false); }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsError(null);
    try {
      const updated = await withToken((t) =>
        admin.updateSettings({
          matchmaking: { rankedQueueMaxWaitSeconds: rankedWait, matchSize },
          mmr: { rankedWinDelta: rankedWin, rankedLossDelta: rankedLoss },
          economy: { purchaseEnabled }
        }, t)
      );
      setSettings(updated);
      setSettingsNotice("Settings saved.");
      setTimeout(() => setSettingsNotice(null), 3000);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSettingsBusy(false);
    }
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

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />

      <main className="page">
        <section>
          <p className="section-title">Studio backoffice</p>

          <div className="tab-bar" style={{ marginBottom: "1.5rem" }}>
            <button className={`tab-btn${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
            <button className={`tab-btn${tab === "settings" ? " active" : ""}`} onClick={() => setTab("settings")}>Settings</button>
            <button className={`tab-btn${tab === "moderation" ? " active" : ""}`} onClick={() => setTab("moderation")}>
              Moderation {signals.filter((s) => s.status === "open").length > 0 && (
                <span className="tag tag-red" style={{ marginLeft: "0.25rem" }}>
                  {signals.filter((s) => s.status === "open").length}
                </span>
              )}
            </button>
          </div>

          {/* Overview tab */}
          {tab === "overview" && dash && (
            <>
              <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
                <div className="kpi-card cyan"><span className="kpi-icon">👥</span><span className="kpi-value">{dash.activePlayers.toLocaleString()}</span><span className="kpi-label">Active players</span></div>
                <div className="kpi-card purple"><span className="kpi-icon">⚔️</span><span className="kpi-value">{dash.dailyMatches.toLocaleString()}</span><span className="kpi-label">Daily matches</span></div>
                <div className="kpi-card gold"><span className="kpi-icon">💰</span><span className="kpi-value">{dash.virtualRevenue.toLocaleString()}</span><span className="kpi-label">Virtual revenue</span></div>
                <div className="kpi-card green"><span className="kpi-icon">🗺️</span><span className="kpi-value">{dash.mapActivity.toLocaleString()}</span><span className="kpi-label">Map tests today</span></div>
              </div>
              <div className="grid-2">
                <div className="kpi-card" style={{ border: "1px solid var(--border)" }}>
                  <span className="kpi-icon">🚨</span>
                  <span className="kpi-value" style={{ color: "var(--orange)" }}>{dash.openModerationSignals}</span>
                  <span className="kpi-label">Open signals</span>
                </div>
                <div className="kpi-card" style={{ border: "1px solid var(--border)" }}>
                  <span className="kpi-icon">🔒</span>
                  <span className="kpi-value" style={{ color: "var(--red)" }}>{dash.activeSanctions}</span>
                  <span className="kpi-label">Active sanctions</span>
                </div>
              </div>
            </>
          )}

          {/* Settings tab */}
          {tab === "settings" && (
            <div style={{ maxWidth: 560 }}>
              {settingsNotice && <div className="success-banner" style={{ marginBottom: "1rem" }}>{settingsNotice}</div>}
              {settingsError && <div className="error-banner" style={{ marginBottom: "1rem" }}>{settingsError}</div>}
              {user?.role !== "admin" && (
                <div className="error-banner" style={{ marginBottom: "1rem" }}>
                  Read-only — only admins can edit settings.
                </div>
              )}
              <form className="card auth-form" onSubmit={handleSaveSettings}>
                <div className="card-header">
                  <span className="card-title">Matchmaking</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Ranked queue max wait (seconds)</label>
                  <input className="form-input" type="number" value={rankedWait} onChange={(e) => setRankedWait(Number(e.target.value))} disabled={user?.role !== "admin"} />
                </div>
                <div className="form-group">
                  <label className="form-label">Match size</label>
                  <input className="form-input" type="number" min={2} value={matchSize} onChange={(e) => setMatchSize(Number(e.target.value))} disabled={user?.role !== "admin"} />
                </div>

                <div className="card-header" style={{ marginTop: "0.5rem" }}>
                  <span className="card-title">MMR</span>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Ranked win delta</label>
                    <input className="form-input" type="number" value={rankedWin} onChange={(e) => setRankedWin(Number(e.target.value))} disabled={user?.role !== "admin"} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ranked loss delta</label>
                    <input className="form-input" type="number" value={rankedLoss} onChange={(e) => setRankedLoss(Number(e.target.value))} disabled={user?.role !== "admin"} />
                  </div>
                </div>

                <div className="card-header" style={{ marginTop: "0.5rem" }}>
                  <span className="card-title">Economy</span>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={purchaseEnabled}
                      onChange={(e) => setPurchaseEnabled(e.target.checked)}
                      disabled={user?.role !== "admin"}
                      style={{ marginRight: "0.5rem" }}
                    />
                    Purchases enabled
                  </label>
                </div>

                {user?.role === "admin" && (
                  <button className="btn btn-primary btn-full" type="submit" disabled={settingsBusy}>
                    {settingsBusy ? "Saving…" : "Save settings"}
                  </button>
                )}
              </form>
            </div>
          )}

          {/* Moderation tab */}
          {tab === "moderation" && (
            <div className="grid-2" style={{ alignItems: "start" }}>
              {/* Action form */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">New action</span>
                </div>
                {modNotice && <div className="success-banner">{modNotice}</div>}
                {modError && <div className="error-banner">{modError}</div>}
                <form className="auth-form" onSubmit={handleModerate}>
                  <div className="form-group">
                    <label className="form-label">Target type</label>
                    <select className="form-input" value={modType} onChange={(e) => setModType(e.target.value as "account" | "map")}>
                      <option value="account">Account</option>
                      <option value="map">Map</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target ID</label>
                    <input className="form-input" value={modTargetId} onChange={(e) => setModTargetId(e.target.value)} required placeholder="User ID or Map ID" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action</label>
                    <select className="form-input" value={modAction} onChange={(e) => setModAction(e.target.value)}>
                      {modType === "account"
                        ? (<>
                            <option value="warn">Warn</option>
                            <option value="suspend">Suspend</option>
                            <option value="ban">Ban</option>
                            <option value="unban">Unban</option>
                          </>)
                        : (<>
                            <option value="hide">Hide</option>
                            <option value="restore">Restore</option>
                          </>)
                      }
                    </select>
                  </div>
                  {modType === "account" && (modAction === "suspend") && (
                    <div className="form-group">
                      <label className="form-label">Duration (hours)</label>
                      <input className="form-input" type="number" min={1} value={modDuration} onChange={(e) => setModDuration(e.target.value)} placeholder="24" />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Reason</label>
                    <textarea className="form-input" value={modReason} onChange={(e) => setModReason(e.target.value)} required rows={2} placeholder="Reason for this action…" style={{ resize: "vertical" }} />
                  </div>
                  <button className="btn btn-primary btn-full" type="submit" disabled={modBusy}>
                    {modBusy ? "Applying…" : "Apply action"}
                  </button>
                </form>
              </div>

              {/* History + signals */}
              <div style={{ display: "grid", gap: "1rem" }}>
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Open signals</span>
                    <span className="tag tag-orange">{signals.filter((s) => s.status === "open").length}</span>
                  </div>
                  <div className="moderation-list">
                    {signals.filter((s) => s.status === "open").length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No open signals.</div>
                    )}
                    {signals.filter((s) => s.status === "open").map((s) => (
                      <div key={s.id} className="moderation-item open">
                        <span className="moderation-type" style={{ color: "var(--orange)" }}>{s.targetType}</span>
                        <span className="moderation-reason">{s.reason}</span>
                        <span className="moderation-status">{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">History</span>
                    <span className="tag tag-purple">{modHistory.length}</span>
                  </div>
                  <div className="moderation-list">
                    {modHistory.length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No actions yet.</div>
                    )}
                    {modHistory.slice(0, 10).map((a) => (
                      <div key={a.id} className="moderation-item action">
                        <span className="moderation-type" style={{ color: "var(--red)", fontSize: "0.65rem" }}>{a.action}</span>
                        <span className="moderation-reason">{a.reason}</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
