import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteGameButton } from "@/components/delete-game-button";
import { CompleteSessionButton } from "@/components/complete-session-button";
import { DeleteSessionDraftButton } from "@/components/delete-session-draft-button";
import {
  expectedChampShares,
  expectedWinForSides,
  formatPercent,
  skillForPlayer,
} from "@/lib/rating";
import { teamsCoverCourts } from "@/lib/session-readiness";

type PageProps = {
  params: Promise<{ leagueId: string; sessionId: string }>;
};

type PlayerRow = {
  id: string;
  name: string;
  user_id: string | null;
  users: { username: string | null } | null;
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

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const canAdmin =
    membership.role === "owner" || membership.role === "admin";

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

  const numCourts = typeof session.num_courts === "number" && session.num_courts >= 1 ? session.num_courts : 1;
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
          .select("id, name, user_id, users ( username )")
          .in("id", [...playerIds])
      : { data: [] as PlayerRow[] };

  const playerById = new Map(
    (nameRows ?? []).map((p) => [p.id, p as PlayerRow]),
  );

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
  const court1LeaderLabels =
    maxCourt1Wins > 0
      ? court1WinRows.filter((r) => (r.wins as number) === maxCourt1Wins).map((r) => formatTeam([r.player_low, r.player_high]))
      : [];

  const champTableRows =
    isChampOnly && sessionTeamRows.length > 0
      ? (() => {
          const pairSkills = sessionTeamRows.map((t) => {
            const pa = t.player_a as string;
            const pb = t.player_b as string;
            return (
              (skillForPlayer(pa, skillsByPlayerId) + skillForPlayer(pb, skillsByPlayerId)) / 2
            );
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
              label: formatTeam([pa, pb]),
              wins: w,
              share: shares[i] ?? 0,
            };
          });
        })()
      : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Session · ${session.date}`}
        description={
          <>
            <Link href={`/leagues/${leagueId}`} className="hover:underline">
              {league.name}
            </Link>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <Badge variant="outline" className="align-middle capitalize">
              {session.status}
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground">
              {(session.num_courts as number) ?? "—"} courts · {session.input_mode ?? "—"}
            </span>
          </>
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

      {isParticipant ? (
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">You&apos;re playing this session</p>
          <p className="mt-1 text-muted-foreground">
            {canAdmin
              ? "You can edit teams and scores from Edit session, then mark complete when results are final."
              : "League admins enter scores and mark the session complete. You can review teams and results here."}
          </p>
        </div>
      ) : null}

      {!isParticipant && !canAdmin ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re viewing this session as a league member. Only admins can change teams or scores.
        </p>
      ) : null}

      {canAdmin && isDraft ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Finalize session</CardTitle>
            <CardDescription>
              {!hasTeams || !teamsReady ? (
                <>
                  Save teams for every court in the session editor first. This session needs{" "}
                  <span className="font-medium text-foreground">{numCourts * 2}</span> pairs for{" "}
                  <span className="font-medium text-foreground">{numCourts}</span> court
                  {numCourts === 1 ? "" : "s"} ({teamPairCount} pair{teamPairCount === 1 ? "" : "s"} saved
                  {hasTeams ? "" : " — none yet"}).
                </>
              ) : isChampOnly ? (
                <>
                  Save court 1 win counts from the session wizard, then mark complete to update the leaderboard.
                </>
              ) : (
                <>
                  Save games from the session wizard first. When results are correct, mark the session complete to
                  update the leaderboard.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!hasTeams || !teamsReady ? (
              <Link
                href={`/leagues/${leagueId}/sessions/${sessionId}/edit`}
                className={buttonVariants({ variant: "default", size: "default" })}
              >
                Edit session
              </Link>
            ) : (
              <CompleteSessionButton leagueId={leagueId} sessionId={sessionId} />
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isChampOnly && sessionTeamRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>
              Pairs saved for this session. Add game scores in the session editor when ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {sessionTeamRows.map((t, i) => {
                const pa = t.player_a as string;
                const pb = t.player_b as string;
                return (
                  <li
                    key={`${pa}-${pb}-${i}`}
                    className="rounded-md border border-border/80 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">Pair {i + 1}</span>
                    <span className="mt-1 block text-muted-foreground">{formatTeam([pa, pb])}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isChampOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>Court 1 wins</CardTitle>
            <CardDescription>
              Championship court only — wins on other courts are not recorded. Scores are not stored. Exp Win (levels)
              uses your global padel ratings (softmax over pairs in this session).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {court1LeaderLabels.length > 0 ? (
              <p className="text-sm">
                <span className="font-medium text-foreground">Session leader</span>
                {court1LeaderLabels.length === 1 ? "" : "s"}: {court1LeaderLabels.join(" · ")} ({maxCourt1Wins} win
                {maxCourt1Wins === 1 ? "" : "s"} on court 1)
              </p>
            ) : null}
            {!court1WinRows.length && (!champTableRows || champTableRows.length === 0) ? (
              <p className="text-sm text-muted-foreground">No court 1 wins logged yet.</p>
            ) : champTableRows && champTableRows.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Exp Win (levels)</TableHead>
                      <TableHead className="text-right">Wins on court 1</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {champTableRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="max-w-[280px] text-sm">{row.label}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatPercent(row.share, 1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Wins on court 1</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {court1WinRows.map((r) => (
                      <TableRow key={`${r.player_low}-${r.player_high}`}>
                        <TableCell className="max-w-[280px] text-sm">
                          {formatTeam([r.player_low, r.player_high])}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Games</CardTitle>
          <CardDescription>
            {isChampOnly
              ? "Per-game scores are not used in championship court only mode. Legacy rows may appear if this session was recorded before that change."
              : "Courts, teams, and results for this session. Side odds use global padel levels."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!games?.length ? (
            <p className="text-sm text-muted-foreground">
              {isChampOnly ? "No game rows stored for this session." : "No games logged yet."}
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Court</TableHead>
                    <TableHead>Team A</TableHead>
                    <TableHead>Team B</TableHead>
                    <TableHead>Side odds (levels)</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Winner</TableHead>
                    {canAdmin && isDraft ? (
                      <TableHead className="text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((g) => {
                    const ta = (g.team_a_players as string[]) ?? [];
                    const tb = (g.team_b_players as string[]) ?? [];
                    const winEst =
                      ta.length >= 2 && tb.length >= 2
                        ? expectedWinForSides(ta, tb, skillsByPlayerId)
                        : null;
                    return (
                    <TableRow key={g.id}>
                      <TableCell>{g.court_number}</TableCell>
                      <TableCell className="max-w-[220px] text-sm">
                        {formatTeam(ta)}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm">
                        {formatTeam(tb)}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                        {winEst ? (
                          <>
                            A {formatPercent(winEst.teamA, 0)} · B {formatPercent(winEst.teamB, 0)}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {g.team_a_score} – {g.team_b_score}
                      </TableCell>
                      <TableCell className="capitalize">
                        {(g.winner as string)?.replace("_", " ")}
                      </TableCell>
                      {canAdmin && isDraft ? (
                        <TableCell className="text-right">
                          <DeleteGameButton
                            leagueId={leagueId}
                            sessionId={sessionId}
                            gameId={g.id as string}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
