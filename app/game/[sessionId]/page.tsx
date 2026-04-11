import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAnonClient } from "@/lib/supabase/anon";
import { buttonVariants } from "@/lib/button-variants";
import { BrandShellHeader } from "@/components/brand-shell-header";
import { cn } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreviewRow = {
  session_id: string;
  league_id: string;
  league_name: string;
  session_date: string;
  scheduled_at: string | null;
  share_location: string | null;
  share_restriction: string | null;
  share_duration_minutes: number | null;
  num_courts: number;
  match_kind: string;
  filled_players: number;
  capacity_players: number;
};

async function fetchPreview(sessionId: string): Promise<PreviewRow | null> {
  const anon = createAnonClient();
  const { data, error } = await anon.rpc("get_public_session_share_preview", {
    p_session_id: sessionId,
  });
  if (error || !data?.length) return null;
  return data[0] as PreviewRow;
}

function formatWhen(row: PreviewRow): string {
  if (row.scheduled_at) {
    const d = new Date(row.scheduled_at);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  const parts = String(row.session_date).split("-").map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return String(row.session_date);
}

function absoluteGameUrl(sessionId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}/game/${sessionId}`;
}

type PageProps = { params: Promise<{ sessionId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  if (!UUID_RE.test(sessionId)) {
    return { title: "LobSmash" };
  }

  const row = await fetchPreview(sessionId);
  if (!row) {
    return {
      title: "LobSmash",
      description: "Padel league sessions and leaderboards.",
    };
  }

  const when = formatWhen(row);
  const title = `LobSmash — ${row.league_name}`;
  const description = `${when}. ${row.filled_players}/${row.capacity_players} players. Tap to open.`;
  const url = absoluteGameUrl(sessionId);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "LobSmash",
      type: "website",
      images: [
        {
          url: "/lobsmash-logo.png",
          width: 1200,
          height: 630,
          alt: "LobSmash",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/lobsmash-logo.png"],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function PublicGamePage({ params }: PageProps) {
  const { sessionId } = await params;
  const id = decodeURIComponent(sessionId).trim().toLowerCase();

  if (!UUID_RE.test(id)) notFound();

  const row = await fetchPreview(id);
  if (!row) notFound();

  const when = formatWhen(row);
  const redirectTarget = `/leagues/${row.league_id}/sessions/${row.session_id}`;
  const loginHref = `/login?redirect_url=${encodeURIComponent(redirectTarget)}`;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-transparent">
      <BrandShellHeader centered />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
          style={{
            backgroundImage: `
              radial-gradient(ellipse 90% 55% at 50% -15%, color-mix(in srgb, var(--brand-lime) 18%, transparent), transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 60%, color-mix(in srgb, var(--brand-lime) 10%, transparent), transparent 45%)
            `,
          }}
        />
        <div
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6",
            "pb-6",
          )}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card/95 px-6 py-8 shadow-lg backdrop-blur-md">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              LobSmash session
            </p>
            <h1 className="mt-3 text-balance text-center font-heading text-2xl font-bold text-foreground">
              {row.league_name}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">{when}</p>
            {row.share_location?.trim() ? (
              <p className="mt-3 text-center text-sm text-foreground/90">
                📍 {row.share_location.trim()}
              </p>
            ) : null}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {row.filled_players}/{row.capacity_players} players
              {row.match_kind === "friendly" ? (
                <span className="block text-xs">Friendly — global skill not affected</span>
              ) : null}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:items-center">
              <Link href={loginHref} className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}>
                Sign in to open in app
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                You need a LobSmash account and league access to view full session details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
