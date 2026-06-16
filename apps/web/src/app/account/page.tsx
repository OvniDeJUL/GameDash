"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { AuthUserResponse } from "@gamedash/contracts";
import { REGIONS } from "@gamedash/contracts";
import { auth as authApi, players } from "../../lib/api";
import { withToken, logout } from "../../lib/auth";
import { Nav } from "../../components/Nav";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pseudo, setPseudo] = useState("");
  const [bio, setBio] = useState("");
  const [region, setRegion] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    withToken((t) => authApi.me(t))
      .then((me) => {
        setUser(me);
        setPseudo(me.profile?.pseudo ?? "");
        setBio(me.profile?.bio ?? "");
        setRegion(me.profile?.region ?? "");
        setAvatarUrl(me.profile?.avatarUrl ?? "");
      })
      .catch(() => { logout(); router.replace("/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await withToken((t) =>
        players.updateMyProfile({ pseudo, bio, region, avatarUrl }, t)
      );
      setUser((prev) => prev ? { ...prev, profile: updated } : prev);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
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

  const initials = (pseudo || user?.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <Nav user={user} onLogout={handleLogout} />

      <main className="page">
        <section>
          <p className="section-title">My account</p>

          <div className="grid-2" style={{ alignItems: "start" }}>
            {/* Left — avatar + identity */}
            <div className="card" style={{ gap: "1.25rem" }}>
              <div className="card-header">
                <span className="card-title">Profile</span>
                <span className="tag tag-cyan">{user?.role}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <div className="profile-avatar-lg">{initials}</div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {pseudo || "—"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    {user?.email}
                  </div>
                  {region && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span className="tag tag-purple">{region}</span>
                    </div>
                  )}
                </div>
              </div>

              {bio && (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {bio}
                </p>
              )}
            </div>

            {/* Right — edit form */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Edit profile</span>
              </div>

              {success && <div className="success-banner">Profile updated successfully.</div>}
              {error && <div className="error-banner">{error}</div>}

              <form className="auth-form" onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Pseudo</label>
                  <input
                    className="form-input"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder="Your in-game name"
                    required
                    minLength={2}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Avatar URL</label>
                  <input
                    className="form-input"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Region</label>
                  <select
                    className="form-input"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Bio</label>
                  <textarea
                    className="form-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A few words about yourself…"
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Read-only security info */}
        <section>
          <p className="section-title">Security</p>
          <div className="card" style={{ maxWidth: 480 }}>
            <div className="settings-table">
              <div className="settings-row">
                <span className="settings-key">Email</span>
                <span className="settings-val" style={{ fontSize: "0.85rem" }}>{user?.email}</span>
              </div>
              <div className="settings-row">
                <span className="settings-key">Password</span>
                <span className="settings-val">••••••••</span>
              </div>
              <div className="settings-row">
                <span className="settings-key">Role</span>
                <span className="settings-val">{user?.role}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
