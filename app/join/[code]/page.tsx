import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Hash, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { joinPathFromLeagueCode } from "@/lib/safe-redirect-url";
import { isValidLeagueInviteCode, normalizeLeagueCode } from "@/lib/league-code";
import { formatDisplayName } from "@/lib/league-format";
import { Badge } from "@/components/ui/badge";
import { JoinInviteCta } from "./join-invite-cta";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreviewRow = {
  league_id: string;
  league_code: string;
  league_name: string;
  format: string;
  member_count: number;
  owner_name: string;
  owner_username: string | null;
};

type PageProps = { params: Promise<{ code: string }> };

export default async function JoinLeagueInvitePage({ params }: PageProps) {
  const { code: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();

  const anon = createAnonClient();
  let previewData: PreviewRow[] | null = null;
  let previewErr: Error | null = null;

  if (isValidLeagueInviteCode(slug)) {
    const { data, error } = await anon.rpc("get_league_invite_preview_by_code", {
      p_code: normalizeLeagueCode(slug),
    });
    previewData = data as PreviewRow[] | null;
    previewErr = error;
  } else if (UUID_RE.test(slug)) {
    const { data, error } = await anon.rpc("get_league_invite_preview", {
      p_invite_token: slug,
    });
    previewData = data as PreviewRow[] | null;
    previewErr = error;
  } else {
    notFound();
  }

  if (previewErr || !previewData?.length) notFound();

  const preview = previewData[0] as PreviewRow;
  const leagueCode = preview.league_code?.trim() || normalizeLeagueCode(slug);
  const joinPath = joinPathFromLeagueCode(leagueCode);
  const redirectParam = encodeURIComponent(joinPath);
  const loginHref = `/login?redirect_url=${redirectParam}`;
  const signUpHref = `/sign-up?redirect_url=${redirectParam}`;
  const onboardingHref = `/onboarding?redirect_url=${redirectParam}`;

  const { userId } = await auth();

  let onboarded = false;
  let isMember = false;
  let hasPendingRequest = false;

  if (userId) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("users")
      .select("name, username")
      .eq("id", userId)
      .maybeSingle();
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    onboarded = Boolean(
      profile?.name?.trim() && profile?.username?.trim() && player,
    );

    const { data: mem } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", preview.league_id)
      .eq("user_id", userId)
      .maybeSingle();
    isMember = Boolean(mem);

    if (!isMember) {
      const { data: req } = await supabase
        .from("league_join_requests")
        .select("status")
        .eq("league_id", preview.league_id)
        .eq("user_id", userId)
        .maybeSingle();
      hasPendingRequest = req?.status === "pending";
    }
  }

  const ownerLabel =
    preview.owner_name?.trim() ||
    (preview.owner_username ? `@${preview.owner_username}` : "Organiser");

  const ownerSub =
    preview.owner_username?.trim() && preview.owner_name?.trim()
      ? `@${preview.owner_username}`
      : null;

  return (
    <div className="relative w-full min-w-0 max-w-md sm:max-w-lg">
      <div
        className="absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-primary/25 via-primary/5 to-transparent opacity-90 sm:rounded-[1.65rem]"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_22px_60px_-28px_rgba(25,45,35,0.35)] backdrop-blur-md dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_64px_-28px_rgba(0,0,0,0.45)]">
        <div className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/[0.07] blur-2xl" aria-hidden />
        <div className="absolute -bottom-20 -left-12 size-40 rounded-full bg-secondary/40 blur-2xl" aria-hidden />

        <div className="relative px-5 pb-8 pt-7 sm:px-10 sm:pb-10 sm:pt-9">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary sm:text-xs">
              League invite
            </span>
            <h1 className="mt-5 text-balance font-heading text-[1.5rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl sm:leading-tight">
              {preview.league_name}
            </h1>
            <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
              You’ve been invited to join this league on LobSmash. Requests are reviewed by the
              organiser.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-7">
            <Badge
              variant="secondary"
              className="border border-border/80 bg-secondary/80 px-2.5 py-0.5 font-medium capitalize text-secondary-foreground"
            >
              {formatDisplayName(preview.format)}
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm text-muted-foreground">
              <Users className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span>
                {Number(preview.member_count)} member
                {Number(preview.member_count) === 1 ? "" : "s"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono text-sm font-medium tracking-wide text-foreground">
              <Hash className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {leagueCode}
            </span>
          </div>

          <div className="mt-8 rounded-2xl border border-border/50 bg-gradient-to-b from-muted/50 to-muted/20 p-4 text-center sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
              Organiser
            </p>
            <p className="mt-1.5 text-base font-semibold text-foreground">{ownerLabel}</p>
            {ownerSub ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{ownerSub}</p>
            ) : null}
          </div>

          <div className="mt-8 flex w-full flex-col items-stretch gap-4 sm:mt-9 sm:items-center">
            <JoinInviteCta
              leagueCode={leagueCode}
              leagueId={preview.league_id}
              loginHref={loginHref}
              signUpHref={signUpHref}
              onboardingHref={onboardingHref}
              onboarded={onboarded}
              signedIn={Boolean(userId)}
              isMember={isMember}
              hasPendingRequest={hasPendingRequest}
            />
            <p className="text-balance px-1 text-center text-[13px] leading-relaxed text-muted-foreground sm:max-w-sm sm:text-xs">
              Joining is by request. An organiser or admin will approve your access before you can
              open the league hub.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
