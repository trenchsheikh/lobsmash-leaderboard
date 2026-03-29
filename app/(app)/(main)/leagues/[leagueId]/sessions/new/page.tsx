import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  isLeagueFormat,
  sessionInputModeForFormat,
  type LeagueFormat,
} from "@/lib/league-format";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { SessionCreateWizard } from "@/components/session-create-wizard";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function NewSessionPage({ params }: PageProps) {
  noStore();
  const { leagueId: leagueIdRaw } = await params;
  const leagueId = leagueIdRaw.trim().toLowerCase();
  const { supabase, user } = await requireOnboarded();

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (lErr || !league) notFound();

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect(`/leagues/${leagueId}`);
  }

  const { data: rosterRows } = await supabase
    .from("league_players")
    .select(
      `
      player_id,
      players (
        id,
        name,
        user_id,
        users ( username )
      )
    `,
    )
    .eq("league_id", leagueId);

  const roster =
    rosterRows?.map((r) => {
      const p = r.players as unknown as {
        id: string;
        name: string;
        user_id: string | null;
        users: { username: string | null } | null;
      } | null;
      const un = p?.users?.username?.trim() ?? null;
      return {
        playerId: p?.id ?? (r.player_id as string),
        displayName: p?.name ?? "Player",
        username: un,
        isGuest: !p?.user_id,
      };
    }) ?? [];

  const rosterPlayerIds = roster.map((r) => r.playerId);
  const { data: ratingRows } =
    rosterPlayerIds.length > 0
      ? await supabase.from("player_ratings").select("player_id, skill").in("player_id", rosterPlayerIds)
      : { data: [] as { player_id: string; skill: number }[] | null };
  const skillsByPlayerId: Record<string, number> = {};
  for (const row of ratingRows ?? []) {
    skillsByPlayerId[row.player_id as string] = row.skill as number;
  }

  const lc = (league as { last_court_count?: number | null }).last_court_count;
  const defaultCourts =
    typeof lc === "number" && lc >= 1 && lc <= 12 ? lc : 4;

  const leagueFormat: LeagueFormat = isLeagueFormat(String(league.format))
    ? (league.format as LeagueFormat)
    : "americano";
  const leagueResultsMode = sessionInputModeForFormat(leagueFormat);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <PageHeader
        title="New session"
        description={
          <>
            Set up teams, courts, and results in{" "}
            <Link
              href={`/leagues/${leagueId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {league.name}
            </Link>
            . Nothing is stored until you click <span className="font-medium text-foreground">Save draft</span>
            —you can leave or cancel anytime before that with no session row created.
          </>
        }
      />

      <SessionCreateWizard
        leagueId={leagueId}
        sessionId={null}
        defaultCourts={defaultCourts}
        roster={roster}
        leagueResultsMode={leagueResultsMode}
        initialNumCourts={defaultCourts}
        skillsByPlayerId={skillsByPlayerId}
        sessionCompletionStatus="draft"
      />

      <Link
        href={`/leagues/${leagueId}`}
        prefetch={false}
        className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
      >
        Cancel
      </Link>
    </div>
  );
}
