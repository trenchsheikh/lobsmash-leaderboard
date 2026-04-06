"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { SessionInputMode } from "@/lib/league-format";
import type { LeaderboardRow, PairChampionshipRow } from "@/lib/leaderboard";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { WinnerAvatarFrame } from "@/components/winner-avatar-frame";
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
import { LeagueAddRosterDropdown } from "@/components/league-add-roster-dropdown";
import { MemberRoleForm } from "@/components/member-role-form";
import { LinkPlayerButton } from "@/components/link-player-button";
import { CopyTextButton } from "@/components/copy-text-button";
import { PendingJoinRequestsList } from "@/components/pending-join-requests-list";
import { UpdateLeagueCodeForm } from "@/components/update-league-code-form";
import { LeagueSessionsList, type LeagueSessionRow } from "@/components/league-sessions-list";
import { LeagueSpotlightPodium } from "@/components/league/league-spotlight-podium";
import type { SpotlightPair, SpotlightPlayer } from "@/components/league/league-spotlight-podium";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SessionCreateWizard,
  type RosterPlayer,
} from "@/components/session-create-wizard";
const tableScroll = "max-h-[min(70vh,44rem)] overflow-auto rounded-md border border-border/50";

export type LeaguePageTabsProps = {
  leagueId: string;
  currentUserId: string;
  leagueResultsMode: SessionInputMode;
  playerLeaderboardSummitStyle: boolean;
  canAdmin: boolean;
  isOwner: boolean;
  inviteUrl: string;
  refCode: string;
  pendingJoinRequests: Array<{
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  }>;
  membersNeedingLink: Array<{
    id: string;
    user_id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
  }>;
  memberRows: Array<{
    id: string;
    role: string;
    user_id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
  }>;
  rosterDisplay: Array<{
    id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
    isGuest: boolean;
  }>;
  rosterSkillByPlayerId: Record<string, number>;
  /** Avatars/usernames for pair leaderboard rows (championship mode). */
  pairPlayerMetaById?: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
  sessions: LeagueSessionRow[];
  sessionsErr: { message: string } | null;
  leaderboard: LeaderboardRow[];
  pairLeaderboard: PairChampionshipRow[];
  spotlightPairs: SpotlightPair[];
  spotlightPlayers: SpotlightPlayer[];
  /** When set (admins), "Create session" opens the wizard in a dialog on this page. */
  newSessionWizard?: {
    roster: RosterPlayer[];
    defaultCourts: number;
  };
};

export function LeaguePageTabs(props: LeaguePageTabsProps) {
  const {
    leagueId,
    currentUserId,
    leagueResultsMode,
    playerLeaderboardSummitStyle,
    canAdmin,
    isOwner,
    inviteUrl,
    refCode,
    pendingJoinRequests,
    membersNeedingLink,
    memberRows,
    rosterDisplay,
    rosterSkillByPlayerId,
    pairPlayerMetaById = {},
    sessions,
    sessionsErr,
    leaderboard,
    pairLeaderboard,
    spotlightPairs,
    spotlightPlayers,
    newSessionWizard,
  } = props;

  const [tab, setTab] = useState("overview");
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [wizardMountKey, setWizardMountKey] = useState(0);

  const goStandings = useCallback(() => {
    setTab("standings");
    window.setTimeout(() => {
      document.getElementById("full-standings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  function playerLeaderNameCell(row: LeaderboardRow, idx: number) {
    const roster = rosterDisplay.find((r) => r.id === row.player_id);
    const avatarUrl = row.avatar_url ?? roster?.avatar_url ?? null;
    const username = row.username ?? roster?.username ?? null;
    const av = (
      <UserAvatarDisplay
        name={row.name}
        username={username}
        avatarUrl={avatarUrl}
        size="sm"
      />
    );
    return (
      <div className="flex min-w-0 items-center gap-2">
        {idx === 0 ? <WinnerAvatarFrame>{av}</WinnerAvatarFrame> : av}
        <span className="min-w-0 font-medium">{row.name}</span>
      </div>
    );
  }

  const podiumSpotlight =
    leagueResultsMode === "champ_court_only"
      ? ({
          variant: "pairs" as const,
          pairs: spotlightPairs,
          onFullTableClick: goStandings,
        } as const)
      : ({
          variant: "players" as const,
          players: spotlightPlayers,
          onFullTableClick: goStandings,
        } as const);

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList
        className="mb-1 flex h-auto min-h-10 w-full flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/40 p-1.5"
        aria-label="League sections"
      >
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="standings">Standings</TabsTrigger>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        {canAdmin ? <TabsTrigger value="manage">Manage</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <LeagueSpotlightPodium {...podiumSpotlight} />
      </TabsContent>

      <TabsContent value="standings" className="space-y-6">
        {leagueResultsMode === "champ_court_only" ? (
          <>
            <Card id="full-standings" className="scroll-mt-24 border-border/80 shadow-sm">
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
                  <div className={tableScroll}>
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
                          const pLow = pairPlayerMetaById[row.player_low];
                          const pHigh = pairPlayerMetaById[row.player_high];
                          const avatars = (
                            <div className="flex shrink-0 gap-0.5">
                              <UserAvatarDisplay
                                name={pLow?.name ?? "—"}
                                username={pLow?.username}
                                avatarUrl={pLow?.avatar_url}
                                size="sm"
                              />
                              <UserAvatarDisplay
                                name={pHigh?.name ?? "—"}
                                username={pHigh?.username}
                                avatarUrl={pHigh?.avatar_url}
                                size="sm"
                              />
                            </div>
                          );
                          return (
                            <TableRow key={`${row.player_low}-${row.player_high}`}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>
                                <div className="flex min-w-0 items-center gap-2">
                                  {idx === 0 ? (
                                    <WinnerAvatarFrame variant="pair">{avatars}</WinnerAvatarFrame>
                                  ) : (
                                    avatars
                                  )}
                                  <span className="min-w-0 font-medium">{row.label}</span>
                                </div>
                              </TableCell>
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
                  <div className={tableScroll}>
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
                              <TableCell>{playerLeaderNameCell(row, idx)}</TableCell>
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
            <Card id="full-standings" className="scroll-mt-24 border-border/80 shadow-sm">
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
                  <div className={tableScroll}>
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
                              <TableCell>{playerLeaderNameCell(row, idx)}</TableCell>
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
      </TabsContent>

      <TabsContent value="people" className="space-y-6">
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
            <div className={tableScroll}>
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
                        {isOwner && m.user_id !== currentUserId ? (
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
              <ul className="grid max-h-[min(60vh,36rem)] gap-2 overflow-y-auto sm:grid-cols-2">
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
                        : `Lv ${formatDisplayLevel(rosterSkillByPlayerId[p.id] ?? DEFAULT_SKILL)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sessions" className="space-y-6">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              Create a session with the wizard (teams, courts, results). Stats update when you mark a
              session completed. Open any session below to see games, scores, and court 1 results again—
              <span className="font-medium text-foreground"> Session 1</span> is the most recent.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canAdmin && newSessionWizard ? (
              <>
                <button
                  type="button"
                  className={buttonVariants({ className: "w-fit" })}
                  onClick={() => {
                    setWizardMountKey((k) => k + 1);
                    setCreateSessionOpen(true);
                  }}
                >
                  Create session
                </button>
                <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
                  <DialogContent
                    showCloseButton
                    className="max-h-[min(90vh,52rem)] w-full max-w-2xl gap-0 overflow-y-auto p-0 sm:max-w-2xl"
                  >
                    <DialogHeader className="border-b border-border/80 px-4 py-4 sm:px-6">
                      <DialogTitle className="font-heading text-lg">New session</DialogTitle>
                      <DialogDescription>
                        Set up teams, courts, and results. Nothing is stored until you click{" "}
                        <span className="font-medium text-foreground">Save draft</span>
                        —then you&apos;ll open the session editor to continue.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="px-4 py-4 sm:px-6">
                      <SessionCreateWizard
                        key={wizardMountKey}
                        leagueId={leagueId}
                        sessionId={null}
                        defaultCourts={newSessionWizard.defaultCourts}
                        roster={newSessionWizard.roster}
                        leagueResultsMode={leagueResultsMode}
                        initialNumCourts={newSessionWizard.defaultCourts}
                        skillsByPlayerId={rosterSkillByPlayerId}
                        sessionCompletionStatus="draft"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
            {sessionsErr ? (
              <p className="text-sm text-destructive">
                Could not load sessions: {sessionsErr.message}. Apply pending SQL migrations from{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/migrations</code> (see{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">HOSTED_SETUP.md</code>).
              </p>
            ) : sessions?.length ? (
              <div className="max-h-[min(70vh,40rem)] overflow-y-auto pr-1">
                <LeagueSessionsList
                  leagueId={leagueId}
                  sessions={sessions}
                  sectionLabel={canAdmin ? "Past sessions" : "Recent sessions"}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {canAdmin ? (
        <TabsContent value="manage" className="space-y-6">
          {inviteUrl ? (
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

          {pendingJoinRequests.length > 0 ? (
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

          <LeagueAddRosterDropdown
            leagueId={leagueId}
            onNavigateToPeopleTab={() => setTab("people")}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
