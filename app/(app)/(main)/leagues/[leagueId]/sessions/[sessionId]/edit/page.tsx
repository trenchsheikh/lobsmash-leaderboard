import Link from "next/link";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  isLeagueFormat,
  sessionInputModeForFormat,
  type LeagueFormat,
} from "@/lib/league-format";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import {
  SessionCreateWizard,
  type GameRowState,
} from "@/components/session-create-wizard";
import { DeleteSessionDraftButton } from "@/components/delete-session-draft-button";
import { MAX_SESSION_COURTS, MIN_SESSION_COURTS } from "@/lib/session-courts";

type PageProps = {
  params: Promise<{ leagueId: string; sessionId: string }>;
};

function buildGameRowsFromDb(
  games: {
    court_number: number;
    team_a_players: string[];
    team_b_players: string[];
    team_a_score: number;
    team_b_score: number;
    winner: string;
  }[],
  teams: [string, string][],
): GameRowState[] {
  function idxForPlayers(p1: string, p2: string): number {
    const s = new Set([p1, p2]);
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i]!;
      if (s.has(t[0]) && s.has(t[1])) return i;
    }
    return -1;
  }

  const out: GameRowState[] = [];
  for (const g of games) {
    const ta = g.team_a_players;
    const tb = g.team_b_players;
    if (ta.length !== 2 || tb.length !== 2) continue;
    const ai = idxForPlayers(ta[0]!, ta[1]!);
    const bi = idxForPlayers(tb[0]!, tb[1]!);
    if (ai < 0 || bi < 0) continue;
    const w = g.winner;
    if (w !== "team_a" && w !== "team_b") continue;
    out.push({
      courtNumber: g.court_number,
      teamAIdx: ai,
      teamBIdx: bi,
      scoreAStr: String(g.team_a_score),
      scoreBStr: String(g.team_b_score),
      winner: w,
    });
  }
  return out;
}

export default async function EditSessionPage({ params }: PageProps) {
  noStore();
  const raw = await params;
  const leagueId = raw.leagueId.trim().toLowerCase();
  const sessionId = raw.sessionId.trim().toLowerCase();
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
    redirect(`/leagues/${leagueId}/sessions/${sessionId}`);
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (
    sErr ||
    !session ||
    String(session.league_id).toLowerCase() !== leagueId
  ) {
    notFound();
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
    typeof lc === "number" && lc >= MIN_SESSION_COURTS && lc <= MAX_SESSION_COURTS ? lc : 4;

  const initialNumCourts =
    typeof session.num_courts === "number" &&
    session.num_courts >= MIN_SESSION_COURTS &&
    session.num_courts <= MAX_SESSION_COURTS
      ? session.num_courts
      : defaultCourts;

  const { data: teamRows } = await supabase
    .from("session_teams")
    .select("player_a, player_b, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  const initialTeams: [string, string][] = (teamRows ?? []).map((r) => [
    r.player_a as string,
    r.player_b as string,
  ]);

  const inputMode = (session.input_mode as string | null) ?? "full";
  const isChampOnly = inputMode === "champ_court_only";

  const { data: gameRowsDb } = !isChampOnly
    ? await supabase
        .from("games")
        .select(
          "court_number, team_a_players, team_b_players, team_a_score, team_b_score, winner",
        )
        .eq("session_id", sessionId)
        .order("court_number", { ascending: true })
    : { data: [] as never[] };

  const initialGameRows = !isChampOnly
    ? buildGameRowsFromDb(
        (gameRowsDb ?? []) as {
          court_number: number;
          team_a_players: string[];
          team_b_players: string[];
          team_a_score: number;
          team_b_score: number;
          winner: string;
        }[],
        initialTeams,
      )
    : undefined;

  const { data: initialCourt1Rows } = isChampOnly
    ? await supabase
        .from("session_court1_pair_wins")
        .select("player_low, player_high, wins")
        .eq("session_id", sessionId)
    : { data: null };

  const leagueFormat: LeagueFormat = isLeagueFormat(String(league.format))
    ? (league.format as LeagueFormat)
    : "americano";
  const leagueResultsMode = sessionInputModeForFormat(leagueFormat);

  after(() => {
    revalidatePath(`/leagues/${leagueId}`);
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Edit session"
        description={
          <>
            Session in{" "}
            <Link
              href={`/leagues/${leagueId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {league.name}
            </Link>
            {session.status === "draft"
              ? ". Save in the wizard; delete the session only if you want to discard it."
              : ". Saving updates standings and padel levels for linked players."}
          </>
        }
      />

      <SessionCreateWizard
        leagueId={leagueId}
        sessionId={sessionId}
        defaultCourts={defaultCourts}
        roster={roster}
        leagueResultsMode={leagueResultsMode}
        initialNumCourts={initialNumCourts}
        initialCourt1PairWins={
          (initialCourt1Rows ?? []) as {
            player_low: string;
            player_high: string;
            wins: number;
          }[]
        }
        skillsByPlayerId={skillsByPlayerId}
        initialDate={String(session.date)}
        initialTeams={initialTeams}
        initialGameRows={initialGameRows}
        sessionCompletionStatus={session.status === "completed" ? "completed" : "draft"}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/leagues/${leagueId}/sessions/${sessionId}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to session
        </Link>
        {session.status === "draft" ? (
          <DeleteSessionDraftButton
            leagueId={leagueId}
            sessionId={sessionId}
            redirectHref={`/leagues/${leagueId}`}
          />
        ) : null}
      </div>
    </div>
  );
}
