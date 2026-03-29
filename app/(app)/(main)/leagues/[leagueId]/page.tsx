import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  sortLeaderboard,
  sortLeaderboardChampionshipPlayers,
  sortPairChampionship,
  type LeaderboardRow,
  type LeagueFormat,
  type PairChampionshipRow,
} from "@/lib/leaderboard";
import {
  formatDisplayName,
  isLeagueFormat,
  sessionInputModeForFormat,
} from "@/lib/league-format";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
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
import { GuestPlayerForm } from "@/components/guest-player-form";
import { AddMemberForm } from "@/components/add-member-form";
import { MemberRoleForm } from "@/components/member-role-form";
import { LinkPlayerButton } from "@/components/link-player-button";
import { CopyTextButton } from "@/components/copy-text-button";
import { PendingJoinRequestsList } from "@/components/pending-join-requests-list";
import { DeleteLeagueButton } from "@/components/delete-league-button";
import { UpdateLeagueCodeForm } from "@/components/update-league-code-form";
import { LeagueSessionsList } from "@/components/league-sessions-list";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ leagueId: string }> };

export default async function LeaguePage({ params }: PageProps) {
  noStore();
  const { leagueId: leagueIdRaw } = await params;
  const leagueId = leagueIdRaw.trim().toLowerCase();
  const { supabase, user } = await requireOnboarded();

  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (leagueErr || !league) notFound();

  const { data: members } = await supabase
    .from("league_members")
    .select(
      `
      id,
      role,
      user_id,
      users ( name, username, avatar_url )
    `,
    )
    .eq("league_id", leagueId);

  const memberRows =
    members?.map((m) => {
      const u = m.users as unknown as {
        name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
      return {
        id: m.id as string,
        role: m.role as string,
        user_id: m.user_id as string,
        name: u?.name ?? "—",
        username: u?.username?.trim() ?? null,
        avatar_url: u?.avatar_url?.trim() ?? null,
      };
    }) ?? [];

  const myMembership = memberRows.find((m) => m.user_id === user.id);
  if (!myMembership) notFound();

  const canAdmin = myMembership.role === "owner" || myMembership.role === "admin";
  const isOwner = myMembership.role === "owner";

  const memberUserIds = memberRows.map((m) => m.user_id);
  const { data: memberPlayers } = await supabase
    .from("players")
    .select("id, user_id, name")
    .in("user_id", memberUserIds);

  const playerByUserId = new Map(
    (memberPlayers ?? []).map((p) => [p.user_id as string, p]),
  );

  const { data: rosterRows } = await supabase
    .from("league_players")
    .select(
      `
      player_id,
      players (
        id,
        name,
        user_id,
        users ( username, avatar_url )
      )
    `,
    )
    .eq("league_id", leagueId);

  const rosterPlayerIds = new Set(
    (rosterRows ?? []).map((r) => r.player_id as string),
  );

  const { data: rosterRatingRows } =
    rosterPlayerIds.size > 0
      ? await supabase
          .from("player_ratings")
          .select("player_id, skill")
          .in("player_id", [...rosterPlayerIds])
      : { data: [] as { player_id: string; skill: number }[] | null };

  const rosterSkillByPlayerId = new Map<string, number>();
  for (const row of rosterRatingRows ?? []) {
    rosterSkillByPlayerId.set(row.player_id as string, row.skill as number);
  }

  const rosterDisplay =
    rosterRows?.map((r) => {
      const p = r.players as unknown as {
        id: string;
        name: string;
        user_id: string | null;
        users: { username: string | null; avatar_url: string | null } | null;
      } | null;
      const un = p?.users?.username?.trim() ?? null;
      const av = p?.users?.avatar_url?.trim() ?? null;
      return {
        id: p?.id ?? "",
        name: p?.name ?? "",
        username: un,
        avatar_url: av,
        isGuest: !p?.user_id,
      };
    }) ?? [];

  const membersNeedingLink = memberRows.filter((m) => {
    const p = playerByUserId.get(m.user_id);
    if (!p) return false;
    return !rosterPlayerIds.has(p.id);
  });

  const { data: sessionRows, error: sessionsErr } = await supabase
    .from("sessions")
    .select("id, date, status, num_courts, created_at")
    .eq("league_id", leagueId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (sessionsErr) {
    console.error("league page sessions list", sessionsErr.message, sessionsErr);
  }

  const sessionIds = (sessionRows ?? []).map((s) => s.id as string);
  const teamCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: teamRows, error: teamsErr } = await supabase
      .from("session_teams")
      .select("session_id")
      .in("session_id", sessionIds);
    if (teamsErr) {
      console.error("league page session_teams counts", teamsErr.message, teamsErr);
    }
    for (const t of teamRows ?? []) {
      const sid = t.session_id as string;
      teamCountBySession.set(sid, (teamCountBySession.get(sid) ?? 0) + 1);
    }
  }

  const sessions = (sessionRows ?? []).map((s) => {
    const id = s.id as string;
    const n = teamCountBySession.get(id) ?? 0;
    return {
      ...s,
      session_teams: [{ count: n }] as { count: number }[],
    };
  });

  const { data: statsRows } = await supabase
    .from("player_stats")
    .select(
      `
      player_id,
      total_games,
      total_wins,
      court1_wins,
      total_points,
      sessions_played,
      players ( name )
    `,
    )
    .eq("league_id", leagueId);

  const leaderboardRaw: LeaderboardRow[] =
    statsRows?.map((s) => {
      const p = s.players as unknown as { name: string } | null;
      return {
        player_id: s.player_id as string,
        name: p?.name ?? "Player",
        total_games: s.total_games as number,
        total_wins: s.total_wins as number,
        court1_wins: s.court1_wins as number,
        total_points: s.total_points as number,
        sessions_played: (s.sessions_played as number) ?? 0,
      };
    }) ?? [];

  const leagueFormat: LeagueFormat = isLeagueFormat(String(league.format))
    ? (league.format as LeagueFormat)
    : "americano";

  const leagueResultsMode = sessionInputModeForFormat(leagueFormat);

  const playerLeaderboardSummitStyle = leagueResultsMode === "champ_court_only";

  const leaderboard =
    leagueResultsMode === "champ_court_only"
      ? sortLeaderboardChampionshipPlayers(leaderboardRaw)
      : sortLeaderboard(leagueFormat, leaderboardRaw);

  const { data: pairStatsRows } =
    leagueResultsMode === "champ_court_only"
      ? await supabase
          .from("pair_championship_stats")
          .select("player_low, player_high, championship_wins, sessions_played")
          .eq("league_id", leagueId)
      : { data: null };

  const pairPlayerIds = new Set<string>();
  for (const r of pairStatsRows ?? []) {
    pairPlayerIds.add(r.player_low as string);
    pairPlayerIds.add(r.player_high as string);
  }

  const { data: pairNameRows } =
    pairPlayerIds.size > 0
      ? await supabase.from("players").select("id, name").in("id", [...pairPlayerIds])
      : { data: [] as { id: string; name: string }[] | null };

  const nameByPlayerId = new Map(
    (pairNameRows ?? []).map((p) => [p.id as string, (p.name as string)?.trim() || "Player"]),
  );

  const pairLeaderboardRaw: PairChampionshipRow[] =
    pairStatsRows?.map((row) => {
      const pl = row.player_low as string;
      const ph = row.player_high as string;
      const n1 = nameByPlayerId.get(pl) ?? "Player";
      const n2 = nameByPlayerId.get(ph) ?? "Player";
      const names = [n1, n2].sort((a, b) => a.localeCompare(b));
      return {
        player_low: pl,
        player_high: ph,
        label: `${names[0]} & ${names[1]}`,
        championship_wins: row.championship_wins as number,
        sessions_played: (row.sessions_played as number) ?? 0,
      };
    }) ?? [];

  const pairLeaderboard = sortPairChampionship(pairLeaderboardRaw);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";
  const refCode = String(league.code ?? "").trim();
  const inviteUrl = refCode && origin ? `${origin}/join/${refCode}` : "";

  const { data: pendingJoinRows } = canAdmin
    ? await supabase
        .from("league_join_requests")
        .select(
          `
          id,
          users!league_join_requests_user_id_fkey ( name, username, avatar_url )
        `,
        )
        .eq("league_id", leagueId)
        .eq("status", "pending")
    : { data: null };

  const pendingJoinRequests =
    pendingJoinRows?.map((r) => {
      const u = r.users as unknown as {
        name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
      return {
        id: r.id as string,
        name: u?.name ?? null,
        username: u?.username ?? null,
        avatar_url: u?.avatar_url ?? null,
      };
    }) ?? [];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={league.name}
        description={
          <>
            <Badge variant="secondary" className="mr-2 align-middle">
              {formatDisplayName(String(league.format))}
            </Badge>
            <span className="text-muted-foreground">Reference code: </span>
            <span className="font-mono font-medium text-foreground">{league.code}</span>
          </>
        }
        actions={
          isOwner ? (
            <DeleteLeagueButton leagueId={leagueId} leagueName={league.name} />
          ) : null
        }
      />

      {canAdmin && inviteUrl ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Invite link</CardTitle>
            <CardDescription>
              Uses your league reference code in the URL (short and easy to share). People request to
              join; you approve or decline below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-sm leading-relaxed">
                {inviteUrl}
              </code>
              <CopyTextButton text={inviteUrl} label="Copy link" />
            </div>
            {isOwner ? (
              <UpdateLeagueCodeForm leagueId={leagueId} currentCode={refCode} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canAdmin && pendingJoinRequests.length > 0 ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Join requests</CardTitle>
            <CardDescription>Approve or decline people who asked to join this league.</CardDescription>
          </CardHeader>
          <CardContent>
            <PendingJoinRequestsList requests={pendingJoinRequests} />
          </CardContent>
        </Card>
      ) : null}

      {canAdmin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Add members</CardTitle>
              <CardDescription>
                Invite by exact username, search players you share a league with, or pick someone from your other leagues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddMemberForm leagueId={leagueId} />
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Add guest player</CardTitle>
              <CardDescription>Guests are not linked to a login; ideal for one-off fill-ins.</CardDescription>
            </CardHeader>
            <CardContent>
              <GuestPlayerForm leagueId={leagueId} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {canAdmin && membersNeedingLink.length > 0 ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Link members to roster</CardTitle>
            <CardDescription>
              These members have a player profile but are not on the league roster yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {membersNeedingLink.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatarDisplay
                    name={m.name}
                    username={m.username}
                    avatarUrl={m.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-mono font-medium">
                      {m.username ? `@${m.username}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.name}</p>
                  </div>
                </div>
                <LinkPlayerButton leagueId={leagueId} targetUserId={m.user_id} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Roles control who can edit sessions and scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberRows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatarDisplay
                          name={m.name}
                          username={m.username}
                          avatarUrl={m.avatar_url}
                          size="sm"
                        />
                        <div>
                          <div className="font-mono font-medium">
                            {m.username ? `@${m.username}` : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{m.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isOwner && m.user_id !== user.id ? (
                        <MemberRoleForm
                          leagueId={leagueId}
                          memberId={m.id}
                          currentRole={m.role as "owner" | "admin" | "player"}
                        />
                      ) : (
                        <span className="capitalize">{m.role}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            Players attached to this league for sessions and stats. Skill is a global model level (0–7)
            from all rated sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rosterDisplay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players linked yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {rosterDisplay.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-md border border-border/80 px-3 py-2 text-sm"
                >
                  {!p.isGuest ? (
                    <UserAvatarDisplay
                      name={p.name}
                      username={p.username}
                      avatarUrl={p.avatar_url}
                      size="sm"
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      G
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{p.name}</span>
                    {!p.isGuest && p.username ? (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        @{p.username}
                      </span>
                    ) : null}
                    {p.isGuest ? (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Guest
                      </Badge>
                    ) : null}
                  </div>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground" title="Global skill level">
                    {p.isGuest
                      ? "—"
                      : `Lv ${formatDisplayLevel(rosterSkillByPlayerId.get(p.id) ?? DEFAULT_SKILL)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Create a session with the wizard (teams, courts, results). Stats update when you mark a
            session completed. Open any session below to see games, scores, and court 1 results again—
            <span className="font-medium text-foreground"> Session 1</span> is the most recent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {canAdmin ? (
            <Link
              href={`/leagues/${leagueId}/sessions/new`}
              prefetch={false}
              className={buttonVariants({ className: "w-fit" })}
            >
              Create session
            </Link>
          ) : null}
          {sessionsErr ? (
            <p className="text-sm text-destructive">
              Could not load sessions: {sessionsErr.message}. Apply pending SQL migrations from{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/migrations</code> (see{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">HOSTED_SETUP.md</code>).
            </p>
          ) : sessions?.length ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {canAdmin ? "Past sessions" : "Sessions"}
              </p>
              <LeagueSessionsList leagueId={leagueId} sessions={sessions} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          )}
        </CardContent>
      </Card>

      {leagueResultsMode === "champ_court_only" ? (
        <>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Championship pairs</CardTitle>
              <CardDescription>
                Primary ranking for this league: how each{" "}
                <span className="font-medium text-foreground">fixed pair</span> (same two players) has done
                together — court 1 wins from completed sessions. Sessions counts completed champ sessions
                where that pair had a team row. Different partners in different weeks are separate rows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pairLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pair stats yet — complete a session with court 1 win counts for each team.
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Pair</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Champ wins</TableHead>
                        <TableHead className="text-right">Avg wins/session</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pairLeaderboard.map((row, idx) => {
                        const avgWinsPerSession =
                          row.sessions_played > 0
                            ? (row.championship_wins / row.sessions_played).toFixed(1)
                            : "—";
                        return (
                          <TableRow key={`${row.player_low}-${row.player_high}`}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.sessions_played}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.championship_wins}</TableCell>
                            <TableCell className="text-right tabular-nums">{avgWinsPerSession}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Player leaderboard</CardTitle>
              <CardDescription>
                Secondary view: individual totals across completed sessions (partners can change week to week).
                Sorted by total wins, then sessions played, then name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Play some games to populate stats.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Wins</TableHead>
                        <TableHead className="text-right">Avg wins/session</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((row, idx) => {
                        const avgWinsPerSession =
                          row.sessions_played > 0
                            ? (row.total_wins / row.sessions_played).toFixed(1)
                            : "—";
                        return (
                          <TableRow key={row.player_id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.sessions_played}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.total_wins}</TableCell>
                            <TableCell className="text-right tabular-nums">{avgWinsPerSession}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Player leaderboard</CardTitle>
              <CardDescription>
                {playerLeaderboardSummitStyle ? (
                  <>
                    Individual totals across completed sessions (partners can change week to week). Sorted by
                    total wins, then sessions played, then name.
                  </>
                ) : (
                  <>
                    Individual totals across completed sessions (partners can change week to week). Americano:
                    total points, then wins, games, court 1 wins.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Play some games to populate stats.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Player</TableHead>
                        {playerLeaderboardSummitStyle ? (
                          <>
                            <TableHead className="text-right">Sessions</TableHead>
                            <TableHead className="text-right">Wins</TableHead>
                            <TableHead className="text-right">Avg wins/session</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="text-right">Court1 W</TableHead>
                            <TableHead className="text-right">Wins</TableHead>
                            <TableHead className="text-right">Games</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                            <TableHead className="text-right">Win rate</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((row, idx) => {
                        const avgWinsPerSession =
                          row.sessions_played > 0
                            ? (row.total_wins / row.sessions_played).toFixed(1)
                            : "—";
                        const winRate =
                          row.total_games > 0
                            ? `${Math.round((row.total_wins / row.total_games) * 100)}%`
                            : "—";
                        return (
                          <TableRow key={row.player_id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            {playerLeaderboardSummitStyle ? (
                              <>
                                <TableCell className="text-right tabular-nums">
                                  {row.sessions_played}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{row.total_wins}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {avgWinsPerSession}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-right tabular-nums">{row.court1_wins}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.total_wins}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.total_games}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.total_points}</TableCell>
                                <TableCell className="text-right tabular-nums">{winRate}</TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Championship pairs</CardTitle>
              <CardDescription>
                Not used for this league — sessions record full game scores on every court. Pair rankings apply
                only to leagues created in &quot;Championship court only&quot; results mode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The player leaderboard above reflects how this league is set up.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
