import type { NextConfig } from "next";

function supabaseImageHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const host = supabaseImageHostname();
const remotePatterns =
  host != null
    ? [
        {
          protocol: "https" as const,
          hostname: host,
          pathname: "/storage/v1/object/public/**",
        },
      ]
    : [];

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/lobsmash-logo.png" }];
  },
  reactCompiler: true,
  ...(remotePatterns.length > 0 ? { images: { remotePatterns } } : {}),
  experimental: {
    /** Softer refetch when navigating between dynamic routes (seconds). */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    /** Enables Link `transitionTypes` + browser View Transitions where supported. */
    viewTransition: true,
    /** Match avatar uploads (2MB cap in `app/actions/avatar.ts`); default 1MB caused 413 on Vercel. */
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
