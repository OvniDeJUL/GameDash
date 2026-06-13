"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth as authApi, ApiError } from "../../lib/api";
import { saveTokens, isLoggedIn } from "../../lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokens = await authApi.login({ email, password });
      saveTokens(tokens);
      const from = searchParams.get("from") ?? "/dashboard";
      router.replace(from);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error — is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Player login</span>
        <span className="tag tag-cyan">JWT</span>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="player@example.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        No account?{" "}
        <a href="/register" style={{ color: "var(--cyan)", textDecoration: "none" }}>
          Register
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <nav className="topnav">
        <span className="topnav-logo">GameDash</span>
      </nav>
      <main className="page" style={{ maxWidth: "420px" }}>
        <section>
          <p className="section-title">Sign in</p>
          <Suspense fallback={<div style={{ color: "var(--text-muted)" }}>Loading…</div>}>
            <LoginForm />
          </Suspense>
        </section>
      </main>
    </>
  );
}
