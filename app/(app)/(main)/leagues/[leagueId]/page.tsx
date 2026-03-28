import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { sortLeaderboard, type LeaderboardRow, type LeagueFormat } from "@/lib/leaderboard";
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

type PageProps = { params: Promise<{ leagueId: string }> };

export default async function LeaguePage({ params }: PageProps) {
  const { leagueId } = await params;
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

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, date, status, created_at")
    .eq("league_id", leagueId)
    .order("date", { ascending: false });

  const { data: statsRows } = await supabase
    .from("player_stats")
    .select(
      `
      player_id,
      total_games,
      total_wins,
      court1_wins,
      total_points,
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
      };
    }) ?? [];

  const leaderboard = sortLeaderboard(league.format as LeagueFormat, leaderboardRaw);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={league.name}
        description={
          <>
            <Badge variant="secondary" className="mr-2 align-middle">
              {league.format}
            </Badge>
            Join code:{" "}
            <span className="font-mono font-medium text-foreground">{league.code}</span>
          </>
        }
        actions={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Dashboard
          </Link>
        }
      />

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
          <CardDescription>Players attached to this league for sessions and stats.</CardDescription>
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
            session completed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {canAdmin ? (
            <Link
              href={`/leagues/${leagueId}/sessions/new`}
              className={buttonVariants({ className: "w-fit" })}
            >
              Create session
            </Link>
          ) : null}
          {sessions?.length ? (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/leagues/${leagueId}/sessions/${s.id}`}
                    className={buttonVariants({
                      variant: "link",
                      className: "h-auto p-0 font-normal",
                    })}
                  >
                    {s.date} · {s.status}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>
            {league.format === "king_of_court"
              ? "King of Court: court 1 wins, then total wins, games played, points."
              : "Americano: total points, then wins, games, court 1 wins."}
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
                    <TableHead className="text-right">Court1 W</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Games</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((row, idx) => {
                    const rate =
                      row.total_games > 0
                        ? `${Math.round((row.total_wins / row.total_games) * 100)}%`
                        : "—";
                    return (
                      <TableRow key={row.player_id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.court1_wins}</TableCell>
                        <TableCell className="text-right">{row.total_wins}</TableCell>
                        <TableCell className="text-right">{row.total_games}</TableCell>
                        <TableCell className="text-right">{row.total_points}</TableCell>
                        <TableCell className="text-right">{rate}</TableCell>
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
