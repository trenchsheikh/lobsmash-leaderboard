import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Calendar, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { Badge } from "@/components/ui/badge";
import { FriendlyInviteCta } from "./friendly-invite-cta";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreviewRow = {
  session_id: string;
  title: string | null;
  capacity: number;
  starts_at: string | null;
  status: string;
  match_kind: string;
  creator_name: string;
  creator_username: string | null;
  filled_count: number;
  creator_user_id: string;
};

type PageProps = { params: Promise<{ token: string }> };

export default async function FriendlyInvitePage({ params }: PageProps) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw).trim();

  if (!UUID_RE.test(token)) notFound();

  const anon = createAnonClient();
  const { data: previewData, error: previewErr } = await anon.rpc("get_friendly_invite_preview", {
    p_invite_token: token,
  });

  if (previewErr || !previewData?.length) notFound();

  const preview = previewData[0] as PreviewRow;
  const invitePath = `/friendly/invite/${token}`;
  const redirectParam = encodeURIComponent(invitePath);
  const loginHref = `/login?redirect_url=${redirectParam}`;
  const signUpHref = `/sign-up?redirect_url=${redirectParam}`;
  const onboardingHref = `/onboarding?redirect_url=${redirectParam}`;

  const { userId } = await auth();

  let onboarded = false;
  let isCreator = false;
  let isOnRoster = false;
  let hasPendingRequest = false;

  const filled = Number(preview.filled_count);
  const isFull = filled >= preview.capacity;
  const isOpen = preview.status === "open";
  const isCompetitive = preview.match_kind === "competitive";

  if (userId) {
    isCreator = userId === preview.creator_user_id;

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

    if (!isCreator) {
      const { data: rosterRow } = await supabase
        .from("friendly_session_roster")
        .select("user_id")
        .eq("session_id", preview.session_id)
        .eq("user_id", userId)
        .maybeSingle();
      isOnRoster = Boolean(rosterRow);

      if (!isOnRoster) {
        const { data: req } = await supabase
          .from("friendly_session_join_requests")
          .select("status")
          .eq("session_id", preview.session_id)
          .eq("user_id", userId)
          .maybeSingle();
        hasPendingRequest = req?.status === "pending";
      }
    }
  }

  const ownerLabel =
    preview.creator_name?.trim() ||
    (preview.creator_username ? `@${preview.creator_username}` : "Organiser");

  const ownerSub =
    preview.creator_username?.trim() && preview.creator_name?.trim()
      ? `@${preview.creator_username}`
      : null;

  const starts =
    preview.starts_at != null
      ? new Date(preview.starts_at).toLocaleString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
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
              {isCompetitive ? "Competitive pickup" : "Friendly pickup"}
            </span>
            <h1 className="mt-5 text-balance font-heading text-[1.5rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl sm:leading-tight">
              {preview.title?.trim() || "Padel pickup"}
            </h1>
            <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
              {isCompetitive
                ? "Joining is by request. When the match is completed with results, global LobSmash skill can update for participants."
                : "Casual match — joining is by request. Ratings help balance sides; global skill is not changed."}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-7">
            <Badge
              variant="secondary"
              className="border border-border/80 bg-secondary/80 px-2.5 py-0.5 font-medium text-secondary-foreground"
            >
              Friendly
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm text-muted-foreground">
              <Users className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span>
                {filled} / {preview.capacity} players
              </span>
            </span>
            {starts ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm text-muted-foreground">
                <Calendar className="size-3.5 shrink-0 opacity-90" aria-hidden />
                {starts}
              </span>
            ) : null}
          </div>

          <div className="mt-8 rounded-2xl border border-border/50 bg-gradient-to-b from-muted/50 to-muted/20 p-4 text-center sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
              Host
            </p>
            <p className="mt-1.5 text-base font-semibold text-foreground">{ownerLabel}</p>
            {ownerSub ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{ownerSub}</p>
            ) : null}
          </div>

          <div className="mt-8 flex w-full flex-col items-stretch gap-4 sm:mt-9 sm:items-center">
            <FriendlyInviteCta
              inviteToken={token}
              sessionId={preview.session_id}
              loginHref={loginHref}
              signUpHref={signUpHref}
              onboardingHref={onboardingHref}
              onboarded={onboarded}
              signedIn={Boolean(userId)}
              isCreator={isCreator}
              isOnRoster={isOnRoster}
              hasPendingRequest={hasPendingRequest}
              isFull={isFull}
              isOpen={isOpen}
            />
            <p className="text-balance px-1 text-center text-[13px] leading-relaxed text-muted-foreground sm:max-w-sm sm:text-xs">
              The host approves who joins. Global leaderboard ratings are not updated from friendly
              sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
