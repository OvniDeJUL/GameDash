"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUserResponse } from "@gamedash/contracts";

interface NavProps {
  user?: AuthUserResponse | null;
  onLogout?: () => void;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/progression", label: "Progression" },
  { href: "/store", label: "Store" },
  { href: "/community", label: "Community" },
  { href: "/account", label: "Account" },
];

export function Nav({ user, onLogout }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="topnav">
      <div className="topnav-left">
        <Link href="/dashboard" className="topnav-logo">GameDash</Link>
        <div className="topnav-links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`topnav-link${pathname === link.href ? " active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          {(user?.role === "staff" || user?.role === "admin") && (
            <Link
              href="/admin"
              className={`topnav-link topnav-link-admin${pathname === "/admin" ? " active" : ""}`}
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      <div className="topnav-badge">
        <span className="status-dot" />
        <span>{user?.profile?.pseudo ?? user?.email}</span>
        {user && <span className="tag tag-cyan">{user.role}</span>}
        {onLogout && (
          <button
            className="btn"
            style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
            onClick={onLogout}
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
