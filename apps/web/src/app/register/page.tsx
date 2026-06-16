"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth as authApi, ApiError } from "../../lib/api";
import { saveTokens, isLoggedIn } from "../../lib/auth";
import { REGIONS } from "@gamedash/contracts";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    pseudo: "",
    region: "",
    bio: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) router.replace("/dashboard");
  }, [router]);

  function set(field: Exclude<keyof typeof form, "region">) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokens = await authApi.register({
        email: form.email,
        password: form.password,
        pseudo: form.pseudo,
        region: form.region || undefined,
        bio: form.bio || undefined
      });
      saveTokens(tokens);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Network error — is the API running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="topnav">
        <span className="topnav-logo">GameDash</span>
      </nav>

      <main className="page" style={{ maxWidth: "480px" }}>
        <section>
          <p className="section-title">Create account</p>
          <div className="card">
            <div className="card-header">
              <span className="card-title">New player</span>
              <span className="tag tag-purple">free</span>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={set("email")}
                  disabled={loading}
                  placeholder="you@example.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password (min 8 chars)</label>
                <input
                  id="password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={set("password")}
                  disabled={loading}
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pseudo">Pseudo</label>
                <input
                  id="pseudo"
                  className="form-input"
                  required
                  value={form.pseudo}
                  onChange={set("pseudo")}
                  disabled={loading}
                  placeholder="PlayerOne"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="region">Region (optional)</label>
                <select
                  id="region"
                  className="form-input"
                  value={form.region}
                  onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                  disabled={loading}
                >
                  <option value="">— select a region —</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bio">Bio (optional)</label>
                <input
                  id="bio"
                  className="form-input"
                  value={form.bio}
                  onChange={set("bio")}
                  disabled={loading}
                  placeholder="Ranked climber…"
                />
              </div>

              {error && (
                <div className="error-banner" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <div style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Already a player?{" "}
              <a href="/login" style={{ color: "var(--cyan)", textDecoration: "none" }}>
                Sign in
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
