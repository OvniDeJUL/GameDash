"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthUserResponse,
  MapSummary,
  MapDetailResponse,
  MapStatus,
  CreatorMapStatsResponse
} from "@gamedash/contracts";
import { auth as authApi, maps } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";
import { Nav } from "../../components/Nav";

function getMapIcon(tags: string[]): string {
  if (tags.includes("arena")) return "⚔️";
  if (tags.includes("speedrun")) return "⚡";
  if (tags.includes("puzzle")) return "🧩";
  if (tags.includes("survival")) return "🛡️";
  return "🗺️";
}

const STATUS_COLORS: Record<string, string> = {
  draft: "tag-purple",
  beta: "tag-gold",
  stable: "tag-green",
  hidden: "tag-red"
};

// ─── Create map modal ──────────────────────────────────────────────────────

interface CreateMapModalProps {
  onClose: () => void;
  onCreated: (map: MapSummary) => void;
}

function CreateMapModal({ onClose, onCreated }: CreateMapModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<MapStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const created = await withToken((t) =>
        maps.create({ title, description, tags: tagList, status }, t)
      );
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create map");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Publish new map</div>
        {error && <div className="error-banner">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Map name" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} placeholder="What is this map about?" style={{ resize: "vertical" }} />
          </div>
          <div className="form-group">
            <label className="form-label">Tags (comma-separated)</label>
            <input className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="arena, pvp, ranked" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as MapStatus)}>
              <option value="draft">Draft</option>
              <option value="beta">Beta</option>
              <option value="stable">Stable</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Test deployability modal ──────────────────────────────────────────────

interface TestDeployabilityModalProps {
  mapTitle: string;
  onAnswer: (deployable: boolean) => void;
  onClose: () => void;
  busy: boolean;
}

function TestDeployabilityModal({ mapTitle, onAnswer, onClose, busy }: TestDeployabilityModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">Test review — {mapTitle}</div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.7, margin: "0.75rem 0 1.25rem" }}>
          Is this map <strong>deployable</strong>? It should respect:
        </p>
        <ul style={{ fontSize: "0.82rem", lineHeight: 1.8, paddingLeft: "1.25rem", margin: "0 0 1.5rem", color: "var(--text-secondary)" }}>
          <li>Game rules and fair play</li>
          <li>Anti-hate and anti-harassment policy</li>
          <li>No exploits or game-breaking mechanics</li>
          <li>Appropriate content for all players</li>
        </ul>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
          Voting <strong>No</strong> will automatically report this map to staff for review.
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn"
            style={{ background: "rgba(239,68,68,0.15)", color: "var(--red, #ef4444)", border: "1px solid rgba(239,68,68,0.3)" }}
            onClick={() => onAnswer(false)}
            disabled={busy}
          >
            {busy ? "…" : "No — report"}
          </button>
          <button className="btn btn-primary" onClick={() => onAnswer(true)} disabled={busy}>
            {busy ? "…" : "Yes — deployable"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add version modal ─────────────────────────────────────────────────────

interface AddVersionModalProps {
  mapId: string;
  onClose: () => void;
  onAdded: () => void;
}

function AddVersionModal({ mapId, onClose, onAdded }: AddVersionModalProps) {
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await withToken((t) => maps.createVersion(mapId, { versionLabel: label, releaseNotes: notes }, t));
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add version");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Add version</div>
        {error && <div className="error-banner">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Version label</label>
            <input className="form-input" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="v1.1, hotfix-2…" />
          </div>
          <div className="form-group">
            <label className="form-label">Release notes</label>
            <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} required rows={4} placeholder="What changed in this version?" style={{ resize: "vertical" }} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Adding…" : "Add version"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Map card ──────────────────────────────────────────────────────────────

interface MapCardProps {
  map: MapSummary;
  userId: string;
  onUpdate: (updated: MapSummary) => void;
  onOpenDetail: (mapId: string) => void;
}

function MapCard({ map, userId, onUpdate, onOpenDetail }: MapCardProps) {
  const [busy, setBusy] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  async function handleVote(value: 1 | -1) {
    setBusy(true);
    try {
      const res = await withToken((t) => maps.vote(map.id, { value }, t));
      onUpdate(res.map);
    } catch { /* ignore */ } finally {
      setBusy(false); }
  }

  async function handleTestAnswer(deployable: boolean) {
    setTestBusy(true);
    try {
      const res = await withToken((t) => maps.test(map.id, { completed: deployable }, t));
      onUpdate(res.map);
      setShowTestModal(false);
      if (!deployable) setReportDone(true);
    } catch { /* ignore */ } finally { setTestBusy(false); }
  }

  async function handleFavorite() {
    setBusy(true);
    try {
      const newFav = !isFav;
      const res = await withToken((t) => maps.favorite(map.id, { favorited: newFav }, t));
      setIsFav(newFav);
      onUpdate(res.map);
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setReportBusy(true);
    try {
      await withToken((t) => maps.report(map.id, { reason: reportReason.trim() }, t));
      setReportDone(true);
      setShowReport(false);
      setReportReason("");
    } catch { /* ignore */ } finally { setReportBusy(false); }
  }

  const isOwn = map.creatorId === userId;

  return (
    <div className="map-card">
      {showTestModal && (
        <TestDeployabilityModal
          mapTitle={map.title}
          onAnswer={handleTestAnswer}
          onClose={() => setShowTestModal(false)}
          busy={testBusy}
        />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
        <div className="map-thumb">{getMapIcon(map.tags)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <div className="map-card-title">{map.title}</div>
            <span className={`tag ${STATUS_COLORS[map.status] ?? "tag-purple"}`}>{map.status}</span>
            {isOwn && <span className="tag tag-cyan">mine</span>}
          </div>
          <div className="map-tags" style={{ marginTop: "0.375rem" }}>
            {map.tags.map((tag) => <span key={tag} className="map-tag">{tag}</span>)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="map-score-value">{map.popularityScore}</div>
          <div className="map-score-label">score</div>
        </div>
      </div>

      <p className="map-card-desc">{map.description}</p>

      {map.latestVersionLabel && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Latest: <strong style={{ color: "var(--cyan)" }}>v{map.latestVersionLabel}</strong>
        </div>
      )}

      <div className="map-stats-row">
        <span className="map-stat">👍 <strong>{map.stats.upvotes}</strong></span>
        <span className="map-stat">👎 <strong>{map.stats.downvotes}</strong></span>
        <span className="map-stat">🎮 <strong>{map.stats.completedTests}</strong></span>
        <span className="map-stat">⭐ <strong>{map.stats.favorites}</strong></span>
        <span className="map-stat">📋 <strong>{map.stats.versionCount} ver</strong></span>
      </div>

      <div className="map-card-footer">
        <div className="map-actions">
          <button className="vote-btn up" disabled={busy} onClick={() => handleVote(1)}>👍 {map.stats.upvotes}</button>
          <button className="vote-btn down" disabled={busy} onClick={() => handleVote(-1)}>👎</button>
          <button className={`vote-btn fav${isFav ? " active" : ""}`} disabled={busy} onClick={handleFavorite}>{isFav ? "★" : "⭐"} {map.stats.favorites}</button>
          <button className="vote-btn" disabled={busy} onClick={() => setShowTestModal(true)}>🎮 Test</button>
          {!isOwn && !reportDone && (
            <button
              className="vote-btn"
              disabled={busy}
              onClick={() => setShowReport((v) => !v)}
              style={{ color: "var(--red, #ef4444)", fontSize: "0.75rem" }}
            >
              🚩 Report
            </button>
          )}
          {reportDone && <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #888)" }}>Reported</span>}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => onOpenDetail(map.id)}
          style={{ fontSize: "0.75rem" }}
        >
          Details
        </button>
      </div>

      {showReport && (
        <form onSubmit={handleReport} style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexDirection: "column" }}>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Describe the issue…"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            required
            style={{ resize: "none", fontSize: "0.82rem" }}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-sm" style={{ background: "var(--red, #ef4444)" }} disabled={reportBusy}>
              {reportBusy ? "…" : "Submit report"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowReport(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Map detail panel ──────────────────────────────────────────────────────

interface MapDetailPanelProps {
  mapId: string;
  userId: string;
  onClose: () => void;
  onMapUpdated: (map: MapSummary) => void;
}

function MapDetailPanel({ mapId, userId, onClose, onMapUpdated }: MapDetailPanelProps) {
  const [detail, setDetail] = useState<MapDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddVersion, setShowAddVersion] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const d = await withToken((t) => maps.get(mapId, t));
      setDetail(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [mapId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  if (loading || !detail) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 600 }}>
          <div style={{ color: "var(--cyan)", textAlign: "center" }}>Loading…</div>
        </div>
      </div>
    );
  }

  const isOwn = detail.creatorId === userId;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
        {showAddVersion && (
          <AddVersionModal
            mapId={mapId}
            onClose={() => setShowAddVersion(false)}
            onAdded={async () => {
              setShowAddVersion(false);
              await loadDetail();
              const updated = await withToken((t) => maps.get(mapId, t));
              onMapUpdated(updated);
            }}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <div className="modal-title">{detail.title}</div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span className={`tag ${STATUS_COLORS[detail.status] ?? "tag-purple"}`}>{detail.status}</span>
          {isOwn && <span className="tag tag-cyan">my map</span>}
          {detail.tags.map((tag) => <span key={tag} className="map-tag">{tag}</span>)}
        </div>
        {detail.creatorPseudo && (
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            by <strong style={{ color: "var(--cyan)" }}>{detail.creatorPseudo}</strong>
          </div>
        )}

        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {detail.description}
        </p>

        <div className="map-stats-row">
          <span className="map-stat">👍 <strong>{detail.stats.upvotes}</strong></span>
          <span className="map-stat">👎 <strong>{detail.stats.downvotes}</strong></span>
          <span className="map-stat">🎮 <strong>{detail.stats.completedTests}</strong></span>
          <span className="map-stat">⭐ <strong>{detail.stats.favorites}</strong></span>
          <span className="map-stat">🏆 <strong>{detail.popularityScore} pts</strong></span>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span className="card-title">Version history</span>
            {isOwn && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddVersion(true)}>
                + Add version
              </button>
            )}
          </div>

          <div className="map-version-list">
            {detail.versions.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No versions published yet.</div>
            )}
            {detail.versions.map((v, i) => (
              <div key={v.id} className="map-version-item">
                <span className="map-version-label">v{v.versionLabel}</span>
                <div style={{ flex: 1 }}>
                  <div className="map-version-notes">{v.releaseNotes}</div>
                </div>
                <span className="map-version-date">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
                {i === 0 && <span className="tag tag-cyan">latest</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Updated {new Date(detail.updatedAt).toLocaleDateString()}
          </span>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [allMaps, setAllMaps] = useState<MapSummary[]>([]);
  const [creatorStats, setCreatorStats] = useState<CreatorMapStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"explore" | "mine">("explore");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<MapStatus | "">("");

  const [showCreate, setShowCreate] = useState(false);
  const [detailMapId, setDetailMapId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  const loadMaps = useCallback(async (userId: string) => {
    try {
      const [all, stats] = await Promise.allSettled([
        withToken((t) => maps.list({}, t)),
        withToken((t) => maps.getCreatorStats(userId, t))
      ]);
      if (all.status === "fulfilled") setAllMaps(all.value);
      if (stats.status === "fulfilled") setCreatorStats(stats.value);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const me = await withToken((t) => authApi.me(t));
        setUser(me);
        await loadMaps(me.id);
      } catch {
        await logout();
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, loadMaps]);

  function updateMap(updated: MapSummary) {
    setAllMaps((prev) => prev.map((m) => m.id === updated.id ? updated : m));
  }

  const myMaps = allMaps.filter((m) => m.creatorId === user?.id);

  const exploreMaps = allMaps.filter((m) => {
    if (tab !== "explore") return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) &&
        !m.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter && !m.tags.includes(tagFilter.toLowerCase())) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });

  const allTags = [...new Set(allMaps.flatMap((m) => m.tags))].sort();

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

      {showCreate && (
        <CreateMapModal
          onClose={() => setShowCreate(false)}
          onCreated={(map) => {
            setAllMaps((prev) => [map, ...prev]);
            setShowCreate(false);
            if (user) loadMaps(user.id);
          }}
        />
      )}

      {detailMapId && user && (
        <MapDetailPanel
          mapId={detailMapId}
          userId={user.id}
          onClose={() => setDetailMapId(null)}
          onMapUpdated={(updated) => { updateMap(updated); }}
        />
      )}

      <main className="page">
        {error && <div className="error-banner">{error}</div>}

        {/* Creator stats banner */}
        {creatorStats && creatorStats.totalMaps > 0 && (
          <section>
            <p className="section-title">My creator stats</p>
            <div className="grid-4">
              {[
                { label: "Maps published", val: creatorStats.publishedMaps, color: "cyan" },
                { label: "Total votes", val: creatorStats.totalVotes, color: "purple" },
                { label: "Total tests", val: creatorStats.totalTests, color: "gold" },
                { label: "Avg popularity", val: creatorStats.averagePopularityScore.toFixed(1), color: "green" }
              ].map(({ label, val, color }) => (
                <div key={label} className={`kpi-card ${color}`}>
                  <span className="kpi-value">{val}</span>
                  <span className="kpi-label">{label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab bar */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div className="tab-bar" style={{ border: "none" }}>
              <button className={`tab-btn${tab === "explore" ? " active" : ""}`} onClick={() => setTab("explore")}>
                Explore ({allMaps.filter((m) => m.creatorId !== user?.id).length})
              </button>
              <button className={`tab-btn${tab === "mine" ? " active" : ""}`} onClick={() => setTab("mine")}>
                My maps ({myMaps.length})
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + Publish map
            </button>
          </div>

          {/* Explore filters */}
          {tab === "explore" && (
            <div className="filter-bar" style={{ marginBottom: "1rem" }}>
              <input
                className="form-input"
                placeholder="Search maps…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
              />
              <select
                className="form-input"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                style={{ width: 160 }}
              >
                <option value="">All tags</option>
                {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MapStatus | "")}
                style={{ width: 140 }}
              >
                <option value="">All statuses</option>
                <option value="beta">Beta</option>
                <option value="stable">Stable</option>
                <option value="draft">Draft</option>
              </select>
              {(search || tagFilter || statusFilter) && (
                <button
                  className="btn btn-sm"
                  onClick={() => { setSearch(""); setTagFilter(""); setStatusFilter(""); }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Explore grid */}
          {tab === "explore" && (
            <>
              {exploreMaps.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "2rem 0", textAlign: "center" }}>
                  No maps match your filters.
                </div>
              ) : (
                <div className="map-grid">
                  {exploreMaps
                    .sort((a, b) => b.popularityScore - a.popularityScore)
                    .map((map) => (
                      <MapCard
                        key={map.id}
                        map={map}
                        userId={user?.id ?? ""}
                        onUpdate={updateMap}
                        onOpenDetail={setDetailMapId}
                      />
                    ))}
                </div>
              )}
            </>
          )}

          {/* My maps list */}
          {tab === "mine" && (
            <>
              {myMaps.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0" }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
                    You haven't published any maps yet.
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    Publish your first map
                  </button>
                </div>
              ) : (
                <div className="map-grid">
                  {myMaps
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .map((map) => (
                      <MapCard
                        key={map.id}
                        map={map}
                        userId={user?.id ?? ""}
                        onUpdate={updateMap}
                        onOpenDetail={setDetailMapId}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
