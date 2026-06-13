import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameDash",
  description: "Competitive gaming dashboard by Nebula Studio"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
