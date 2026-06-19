"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { AuthUserResponse } from "@gamedash/contracts";
import { REGIONS } from "@gamedash/contracts";
import { auth as authApi, players } from "../../lib/api";
import { withToken, logout, clearTokens } from "../../lib/auth";
import { Nav } from "../../components/Nav";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== user?.email) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await withToken((t) => players.deleteAccount(t));
      clearTokens();
      router.replace("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
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
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={pseudo || "avatar"}
                    className="profile-avatar-lg"
                    style={{ objectFit: "cover", borderRadius: "50%" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
                    }}
                  />
                ) : null}
                <div className="profile-avatar-lg" style={{ display: avatarUrl ? "none" : "flex" }}>{initials}</div>
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
                  <label className="form-label">Profile picture (JPG / PNG — max 20 MB)</label>
                  <input
                    className="form-input"
                    type="file"
                    accept="image/jpeg,image/png"
                    style={{ padding: "0.35rem 0.5rem", cursor: "pointer" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20 * 1024 * 1024) {
                        setError("Image too large — max 20 MB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setAvatarUrl(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  {avatarUrl && (
                    <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <img
                        src={avatarUrl}
                        alt="preview"
                        style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }}
                      />
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                        onClick={() => setAvatarUrl("")}
                      >
                        Remove
                      </button>
                    </div>
                  )}
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

        {/* Danger zone */}
        <section>
          <p className="section-title">Danger zone</p>
          <div className="card" style={{ maxWidth: 480, borderColor: "var(--red, #e05c5c)" }}>
            <div className="card-header">
              <span className="card-title" style={{ color: "var(--red, #e05c5c)" }}>Delete account</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: 1.6 }}>
              This permanently deletes your account and all associated data — profile, match history, wallet, inventory, maps, and sanctions. This action cannot be undone.
            </p>
            {deleteError && <div className="error-banner">{deleteError}</div>}
            <form onSubmit={handleDeleteAccount} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Type your email to confirm: <strong>{user?.email}</strong></label>
                <input
                  className="form-input"
                  type="email"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={user?.email ?? ""}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={deleting || deleteConfirm !== user?.email}
              >
                {deleting ? "Deleting…" : "Delete my account permanently"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
