"use client";

import { auth as authApi } from "./api";

const ACCESS_KEY = "gd_access";
const REFRESH_KEY = "gd_refresh";
const SESSION_COOKIE = "gd_session";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Storage ───────────────────────────────────────────────────────────────

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  // Cookie for middleware route protection (no JS-accessible value needed)
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Strict`;
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

// ─── Token refresh ─────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    throw new Error("No refresh token");
  }

  refreshPromise = authApi
    .refresh({ refreshToken })
    .then((tokens) => {
      saveTokens(tokens);
      return tokens.accessToken;
    })
    .catch((err) => {
      clearTokens();
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ─── Authenticated fetch helper ────────────────────────────────────────────

export async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    clearTokens();
    throw new Error("Not authenticated");
  }

  try {
    return await fn(token);
  } catch (err: unknown) {
    const isUnauthorized =
      err instanceof Error &&
      "status" in err &&
      (err as { status: number }).status === 401;

    if (isUnauthorized) {
      const newToken = await refreshAccessToken();
      return fn(newToken);
    }
    throw err;
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();
  if (refreshToken && accessToken) {
    await authApi.logout(refreshToken, accessToken).catch(() => {});
  }
  clearTokens();
}
