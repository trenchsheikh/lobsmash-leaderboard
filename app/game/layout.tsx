import type { Metadata } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(base),
};

export default function GameShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
