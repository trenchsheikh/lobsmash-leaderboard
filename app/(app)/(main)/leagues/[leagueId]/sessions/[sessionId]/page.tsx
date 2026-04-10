import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { DeleteSessionDraftButton } from "@/components/delete-session-draft-button";
import {
  SessionDetailView,
  type SessionDetailGameRow,
} from "@/components/session/session-detail-view";
import { isLeagueFormat, type LeagueFormat } from "@/lib/league-format";
import { sortPairChampionship, type PairChampionshipRow } from "@/lib/leaderboard";
import { displayFirstName } from "@/lib/display-name";
import { expectedChampShares, skillForPlayer } from "@/lib/rating";
import { teamsCoverCourts } from "@/lib/session-readiness";

type PageProps = {
  params: Promise<{ leagueId: string; sessionId: string }>;
};

type PlayerRow = {
  id: string;
  name: string;
  user_id: string | null;
  users: { username: string | null; avatar_url: string | null } | null;
};

export default async function SessionPage({ params }: PageProps) {
  noStore();
  const raw = await params;
  const leagueId = raw.leagueId.trim().toLowerCase();
  const sessionId = raw.sessionId.trim().toLowerCase();
  const { supabase, user, player: myPlayer } = await requireOnboarded();

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, format")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) notFound();

  const leagueFormat: LeagueFormat = isLeagueFormat(String(league.format))
    ? league.format
    : "americano";

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const canAdmin = membership.role === "owner" || membership.role === "admin";

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session || String(session.league_id).toLowerCase() !== leagueId) {
    notFound();
  }

  const inputMode = (session.input_mode as string | null) ?? "full";
  const isChampOnly = inputMode === "champ_court_only";

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("session_id", sessionId)
    .order("court_number", { ascending: true });

  const { data: court1PairWins } = isChampOnly
    ? await supabase
        .from("session_court1_pair_wins")
        .select("player_low, player_high, wins")
        .eq("session_id", sessionId)
    : { data: null };

  const playerIds = new Set<string>();
  for (const g of games ?? []) {
    for (const id of (g.team_a_players as string[]) ?? []) playerIds.add(id);
    for (const id of (g.team_b_players as string[]) ?? []) playerIds.add(id);
  }
  for (const r of court1PairWins ?? []) {
    playerIds.add(r.player_low);
    playerIds.add(r.player_high);
  }

  const { data: sessionTeamRowsRaw } = await supabase
    .from("session_teams")
    .select("player_a, player_b, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  const sessionTeamRows = sessionTeamRowsRaw ?? [];

  for (const t of sessionTeamRows) {
    playerIds.add(t.player_a as string);
    playerIds.add(t.player_b as string);
  }

  const sessionPlayerIds = new Set(playerIds);

  const myPlayerId = myPlayer?.id as string | undefined;
  const isParticipant = Boolean(myPlayerId && sessionPlayerIds.has(myPlayerId));

  const numCourts =
    typeof session.num_courts === "number" && session.num_courts >= 1 ? session.num_courts : 1;
  const teamPairCount = sessionTeamRows.length;
  const hasTeams = teamPairCount > 0;
  const teamsReady = teamsCoverCourts(numCourts, teamPairCount);

  const { data: ratingRows } =
    playerIds.size > 0
      ? await supabase.from("player_ratings").select("player_id, skill").in("player_id", [...playerIds])
      : { data: [] as { player_id: string; skill: number }[] | null };

  const skillsByPlayerId: Record<string, number> = {};
  for (const r of ratingRows ?? []) {
    skillsByPlayerId[r.player_id as string] = r.skill as number;
  }

  const { data: nameRows } =
    playerIds.size > 0
      ? await supabase
          .from("players")
          .select("id, name, user_id, users ( username, avatar_url )")
          .in("id", [...playerIds])
      : { data: [] as PlayerRow[] };

  const playerById = new Map((nameRows ?? []).map((p) => [p.id, p as PlayerRow]));

  const playersById: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null; isGuest: boolean }
  > = {};
  for (const [id, p] of playerById.entries()) {
    playersById[id] = {
      name: p.name,
      username: p.users?.username?.trim() ?? null,
      avatar_url: p.users?.avatar_url?.trim() ?? null,
      isGuest: !p.user_id,
    };
  }

  function formatTeam(ids: string[]) {
    return ids
      .map((id) => {
        const p = playerById.get(id);
        if (!p) return id.slice(0, 8);
        const un = p.users?.username?.trim();
        if (un) return `@${un}`;
        return p.name;
      })
      .join(" · ");
  }

  const isDraft = session.status === "draft";

  const court1WinRows = court1PairWins ?? [];
  const maxCourt1Wins = court1WinRows.length
    ? Math.max(...court1WinRows.map((r) => r.wins as number))
    : 0;
  const court1LeaderPairs =
    maxCourt1Wins > 0
      ? court1WinRows
          .filter((r) => (r.wins as number) === maxCourt1Wins)
          .map((r) => ({
            playerA: r.player_low as string,
            playerB: r.player_high as string,
          }))
      : [];

  const champTableRows =
    isChampOnly && sessionTeamRows.length > 0
      ? (() => {
          const pairSkills = sessionTeamRows.map((t) => {
            const pa = t.player_a as string;
            const pb = t.player_b as string;
            return (skillForPlayer(pa, skillsByPlayerId) + skillForPlayer(pb, skillsByPlayerId)) / 2;
          });
          const shares = expectedChampShares(pairSkills);
          return sessionTeamRows.map((t, i) => {
            const pa = t.player_a as string;
            const pb = t.player_b as string;
            const lo = pa < pb ? pa : pb;
            const hi = pa < pb ? pb : pa;
            const w =
              court1PairWins?.find((r) => r.player_low === lo && r.player_high === hi)?.wins ?? 0;
            return {
              key: `${lo}-${hi}-${i}`,
              playerA: pa,
              playerB: pb,
              wins: w,
              share: shares[i] ?? 0,
            };
          });
        })()
      : null;

  let pairLeaderboard: PairChampionshipRow[] = [];
  if (isChampOnly) {
    const { data: pairStatsRows } = await supabase
      .from("pair_championship_stats")
      .select("player_low, player_high, championship_wins, sessions_played")
      .eq("league_id", leagueId);

    const pairStatsPlayerIds = new Set<string>();
    for (const r of pairStatsRows ?? []) {
      pairStatsPlayerIds.add(r.player_low as string);
      pairStatsPlayerIds.add(r.player_high as string);
    }

    const { data: pairNameRows } =
      pairStatsPlayerIds.size > 0
        ? await supabase
            .from("players")
            .select("id, name, users ( username, avatar_url )")
            .in("id", [...pairStatsPlayerIds])
        : { data: [] as { id: string; name: string; users: unknown }[] | null };

    const pairStatMetaById = new Map<
      string,
      { name: string; username: string | null; avatar_url: string | null }
    >();
    for (const p of pairNameRows ?? []) {
      const u = p.users as { username: string | null; avatar_url: string | null } | null;
      pairStatMetaById.set(p.id as string, {
        name: (p.name as string)?.trim() || "Player",
        username: u?.username?.trim() ?? null,
        avatar_url: u?.avatar_url?.trim() ?? null,
      });
    }

    const pairLeaderboardRaw: PairChampionshipRow[] =
      pairStatsRows?.map((row) => {
        const pl = row.player_low as string;
        const ph = row.player_high as string;
        const n1 = pairStatMetaById.get(pl)?.name ?? "Player";
        const n2 = pairStatMetaById.get(ph)?.name ?? "Player";
        const sorted = [n1, n2].sort((a, b) => a.localeCompare(b));
        const label = `${displayFirstName(sorted[0])} & ${displayFirstName(sorted[1])}`;
        return {
          player_low: pl,
          player_high: ph,
          label,
          championship_wins: row.championship_wins as number,
          sessions_played: (row.sessions_played as number) ?? 0,
        };
      }) ?? [];

    pairLeaderboard = sortPairChampionship(pairLeaderboardRaw);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Session · ${session.date}`}
        description={
          <Link
            href={`/leagues/${leagueId}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {league.name}
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/leagues/${leagueId}`}
              prefetch={false}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to league
            </Link>
            {canAdmin ? (
              <>
                <Link
                  href={`/leagues/${leagueId}/sessions/${sessionId}/edit`}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Edit session
                </Link>
                {isDraft ? (
                  <DeleteSessionDraftButton
                    leagueId={leagueId}
                    sessionId={sessionId}
                    redirectHref={`/leagues/${leagueId}`}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        }
      />

      <SessionDetailView
        leagueId={leagueId}
        sessionId={sessionId}
        leagueFormat={leagueFormat}
        sessionDate={session.date as string}
        sessionStatus={session.status as string}
        numCourts={numCourts}
        inputMode={session.input_mode as string | null}
        canAdmin={canAdmin}
        isParticipant={isParticipant}
        isDraft={isDraft}
        isChampOnly={isChampOnly}
        hasTeams={hasTeams}
        teamsReady={teamsReady}
        teamPairCount={teamPairCount}
        sessionTeamRows={sessionTeamRows as { player_a: string; player_b: string; sort_order: number }[]}
        games={(games ?? []) as SessionDetailGameRow[]}
        champTableRows={champTableRows}
        court1WinRows={court1WinRows as { player_low: string; player_high: string; wins: number }[]}
        court1LeaderPairs={court1LeaderPairs}
        maxCourt1Wins={maxCourt1Wins}
        pairLeaderboard={pairLeaderboard}
        playersById={playersById}
        skillsByPlayerId={skillsByPlayerId}
        myPlayerId={myPlayerId}
      />
    </div>
  );
}
