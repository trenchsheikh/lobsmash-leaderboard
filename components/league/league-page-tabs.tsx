"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { LeagueFormat, SessionInputMode } from "@/lib/league-format";
import { cn } from "@/lib/utils";
import type { LeaderboardRow, PairChampionshipRow } from "@/lib/leaderboard";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { useSupabaseBrowser } from "@/lib/supabase/client";
import { useLeagueDraftLive } from "@/components/league/use-league-draft-live";
import { PairTeamStatsModal } from "@/components/pair-team-stats-modal";
import { PlayerProfileAnalyticsModal } from "@/components/player-profile-analytics-modal";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import {
  LeaguePairStandingsBoard,
  LeaguePlayerStandingsBoard,
} from "@/components/league/league-standings-board";
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
import { LeagueOverviewSummary } from "@/components/league/league-overview-summary";
import {
  LeagueOverviewNextSession,
  type LeagueOverviewNextSessionPayload,
} from "@/components/league/league-overview-next-session";
import { LeagueSpotlightPodium } from "@/components/league/league-spotlight-podium";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SessionCreateWizard,
  type RosterPlayer,
} from "@/components/session-create-wizard";
import { LeagueSessionShareButton } from "@/components/league-session-share-button";
import { ListPagination } from "@/components/list-pagination";
import { PAGE_SIZE, slicePage } from "@/lib/paginate";

const tableScroll =
  "max-h-[min(70vh,44rem)] overflow-auto rounded-md border border-border/50";
const tableBorderOnly = "rounded-md border border-border/50";

type PairModalSection = "team" | "low" | "high";

export type LeaguePageTabsProps = {
  leagueId: string;
  leagueFormat: LeagueFormat;
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
    player_id?: string;
  }>;
  rosterDisplay: Array<{
    id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
    isGuest: boolean;
    playstyle?: string | null;
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
  /** When set (admins), "Create session" opens the wizard in a sheet on this page. */
  newSessionWizard?: {
    roster: RosterPlayer[];
    defaultCourts: number;
  };
  /** Next non-completed session and partner for the signed-in member (server-derived). */
  overviewNextSession?: LeagueOverviewNextSessionPayload | null;
};

export function LeaguePageTabs(props: LeaguePageTabsProps) {
  const {
    leagueId,
    leagueFormat,
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
    leaderboard: officialLeaderboard,
    pairLeaderboard: officialPairLeaderboard,
    newSessionWizard,
    overviewNextSession = null,
  } = props;

  const supabase = useSupabaseBrowser();
  const {
    leaderboard,
    pairLeaderboard,
    spotlightPlayers,
    spotlightPairs,
    hasDraftProjection,
    hasDraftSessions,
    skillPreviewDelta,
  } = useLeagueDraftLive({
    supabase,
    leagueId,
    leagueFormat,
    leagueResultsMode,
    officialLeaderboard,
    officialPairLeaderboard,
    rosterDisplay,
    pairPlayerMetaById,
    rosterSkillByPlayerId,
  });

  const [tab, setTab] = useState("overview");
  const [membersPage, setMembersPage] = useState(1);
  const [rosterPage, setRosterPage] = useState(1);

  const {
    slice: memberRowsPage,
    totalPages: membersTotalPages,
    safePage: membersSafePage,
  } = slicePage(memberRows, membersPage, PAGE_SIZE);
  const paginateMembers = memberRows.length > PAGE_SIZE;

  const {
    slice: rosterDisplayPage,
    totalPages: rosterTotalPages,
    safePage: rosterSafePage,
  } = slicePage(rosterDisplay, rosterPage, PAGE_SIZE);
  const paginateRoster = rosterDisplay.length > PAGE_SIZE;

  useEffect(() => {
    setMembersPage(1);
  }, [memberRows.length, leagueId]);

  useEffect(() => {
    if (membersSafePage !== membersPage) setMembersPage(membersSafePage);
  }, [membersSafePage, membersPage]);

  useEffect(() => {
    setRosterPage(1);
  }, [rosterDisplay.length, leagueId]);

  useEffect(() => {
    if (rosterSafePage !== rosterPage) setRosterPage(rosterSafePage);
  }, [rosterSafePage, rosterPage]);

  const router = useRouter();
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [wizardMountKey, setWizardMountKey] = useState(0);
  const [createFlowPhase, setCreateFlowPhase] = useState<"wizard" | "saved">("wizard");
  const [lastCreatedSession, setLastCreatedSession] = useState<{
    id: string;
    date: string;
  } | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setCreateSessionOpen(true);
        return;
      }
      if (createFlowPhase === "wizard" && draftDirty) {
        setDiscardConfirmOpen(true);
        return;
      }
      setCreateSessionOpen(false);
      setCreateFlowPhase("wizard");
      setLastCreatedSession(null);
      setDraftDirty(false);
    },
    [createFlowPhase, draftDirty],
  );

  const confirmDiscardCreateSession = useCallback(() => {
    setDiscardConfirmOpen(false);
    setCreateSessionOpen(false);
    setCreateFlowPhase("wizard");
    setLastCreatedSession(null);
    setDraftDirty(false);
  }, []);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<PairChampionshipRow | null>(null);
  const [pairModalSection, setPairModalSection] = useState<PairModalSection>("team");

  const currentUserPlayerId =
    memberRows.find((m) => m.user_id === currentUserId)?.player_id ?? null;

  const openPlayerProfile = useCallback((playerId: string, isGuest?: boolean) => {
    if (isGuest) {
      toast.message("Guest players don’t have a profile to view.");
      return;
    }
    setProfilePlayerId(playerId);
  }, []);

  function formatSkillDelta(d: number) {
    if (!Number.isFinite(d) || Math.abs(d) < 0.05) return null;
    const r = Math.round(d);
    return r > 0 ? `+${r}` : `${r}`;
  }

  const goStandings = useCallback(() => {
    setTab("standings");
    window.setTimeout(() => {
      document.getElementById("full-standings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const openPairByPlayerIds = useCallback(
    (low: string, high: string) => {
      const pl = low < high ? low : high;
      const ph = low < high ? high : low;
      const row = pairLeaderboard.find((r) => r.player_low === pl && r.player_high === ph);
      if (row) {
        setPairModalSection("team");
        setSelectedPair(row);
      } else toast.message("Team stats aren’t available for this pair yet.");
    },
    [pairLeaderboard],
  );

  const openPairAsTeam = useCallback((row: PairChampionshipRow) => {
    setPairModalSection("team");
    setSelectedPair(row);
  }, []);

  const openPairWithPlayer = useCallback((row: PairChampionshipRow, which: "low" | "high") => {
    setPairModalSection(which);
    setSelectedPair(row);
  }, []);

  const podiumSpotlight =
    leagueResultsMode === "champ_court_only"
      ? ({
          variant: "pairs" as const,
          pairs: spotlightPairs,
          onFullTableClick: goStandings,
          onPlayerClick: (pid: string) => openPlayerProfile(pid, false),
          onPairClick: openPairByPlayerIds,
        } as const)
      : ({
          variant: "players" as const,
          players: spotlightPlayers,
          onFullTableClick: goStandings,
          onPlayerClick: (pid: string) => openPlayerProfile(pid, false),
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
        {hasDraftSessions && hasDraftProjection ? (
          <p className="text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-2 align-middle">
              Live
            </Badge>
            Standings include in-progress live sessions. Skill preview updates as results are entered;
            official ratings apply when a session is completed.
          </p>
        ) : null}
        <LeagueOverviewNextSession
          leagueId={leagueId}
          payload={overviewNextSession}
          onPartnerClick={openPlayerProfile}
          onGoToPeople={() => setTab("people")}
        />
        <LeagueOverviewSummary
          rosterDisplay={rosterDisplay}
          rosterSkillByPlayerId={rosterSkillByPlayerId}
          leaderboard={leaderboard}
          leagueResultsMode={leagueResultsMode}
          skillPreviewDelta={skillPreviewDelta}
          hasDraftSessions={hasDraftSessions}
          memberRows={memberRows}
        />
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
                  {hasDraftSessions ? (
                    <span className="mt-2 block text-amber-800/95 dark:text-amber-400/90">
                      Includes in-progress live sessions until they are completed.
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaguePairStandingsBoard
                  leagueId={leagueId}
                  title="Championship pairs"
                  subtitle="Fixed pairs ranked by court 1 wins from completed sessions. Tap a row for team stats, or an avatar to jump to that player’s tab."
                  variant="embedded"
                  pairLeaderboard={pairLeaderboard}
                  pairPlayerMetaById={pairPlayerMetaById}
                  rosterDisplay={rosterDisplay}
                  currentPlayerId={currentUserPlayerId}
                  onPairRowClick={openPairAsTeam}
                  onPairFocusPlayer={openPairWithPlayer}
                />
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle>Player leaderboard</CardTitle>
                <CardDescription>
                  Secondary view: individual totals across completed sessions (partners can change week to week).
                  Sorted by total wins, then sessions played, then name.
                  {hasDraftSessions ? (
                    <span className="mt-2 block text-amber-800/95 dark:text-amber-400/90">
                      Includes in-progress live sessions until they are completed.
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaguePlayerStandingsBoard
                  leagueId={leagueId}
                  title="Player leaderboard"
                  subtitle="Individual totals across completed sessions. Score is wins; win rate uses wins per session."
                  variant="embedded"
                  leaderboard={leaderboard}
                  mode="champ_secondary"
                  currentPlayerId={currentUserPlayerId}
                  rosterDisplay={rosterDisplay}
                  rosterSkillByPlayerId={rosterSkillByPlayerId}
                  skillPreviewDelta={skillPreviewDelta}
                  onPlayerClick={openPlayerProfile}
                />
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
                  {hasDraftSessions ? (
                    <span className="mt-2 block text-amber-800/95 dark:text-amber-400/90">
                      Includes in-progress live sessions until they are completed.
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeaguePlayerStandingsBoard
                  leagueId={leagueId}
                  title="Player leaderboard"
                  subtitle={
                    playerLeaderboardSummitStyle
                      ? "Individual totals across completed sessions. Score is wins; games and win rate use recorded games."
                      : "Americano: score is total points; games and win rate use every recorded game."
                  }
                  variant="embedded"
                  leaderboard={leaderboard}
                  mode={playerLeaderboardSummitStyle ? "summit" : "americano"}
                  currentPlayerId={currentUserPlayerId}
                  rosterDisplay={rosterDisplay}
                  rosterSkillByPlayerId={rosterSkillByPlayerId}
                  skillPreviewDelta={skillPreviewDelta}
                  onPlayerClick={openPlayerProfile}
                />
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
            <div className={paginateMembers ? tableBorderOnly : tableScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberRowsPage.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex w-full min-w-0 items-center gap-3 rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-100"
                          disabled={!m.player_id}
                          onClick={() => m.player_id && openPlayerProfile(m.player_id, false)}
                        >
                          <UserAvatarDisplay
                            name={m.name}
                            username={m.username}
                            avatarUrl={m.avatar_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-mono font-medium">
                              {m.username ? `@${m.username}` : "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">{m.name}</div>
                          </div>
                        </button>
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
            {paginateMembers ? (
              <ListPagination
                currentPage={membersSafePage}
                totalPages={membersTotalPages}
                onPageChange={setMembersPage}
              />
            ) : null}
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
              <>
              <ul
                className={cn(
                  "grid gap-2 sm:grid-cols-2",
                  !paginateRoster && "max-h-[min(60vh,36rem)] overflow-y-auto",
                )}
              >
                {rosterDisplayPage.map((p) => {
                  const preview = formatSkillDelta(skillPreviewDelta.get(p.id) ?? 0);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-md border border-border/80 px-3 py-2 text-sm"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openPlayerProfile(p.id, p.isGuest)}
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
                      </button>
                      <span
                        className="shrink-0 text-right text-xs text-muted-foreground tabular-nums"
                        title="Global skill level; amber Δ is a preview from live in-progress sessions"
                      >
                        {p.isGuest ? (
                          "—"
                        ) : (
                          <>
                            Lv {formatDisplayLevel(rosterSkillByPlayerId[p.id] ?? DEFAULT_SKILL)}
                            {preview ? (
                              <span className="ml-1 text-amber-800 dark:text-amber-400">Δ{preview}</span>
                            ) : null}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {paginateRoster ? (
                <ListPagination
                  currentPage={rosterSafePage}
                  totalPages={rosterTotalPages}
                  onPageChange={setRosterPage}
                />
              ) : null}
              </>
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
                    setCreateFlowPhase("wizard");
                    setLastCreatedSession(null);
                    setDraftDirty(false);
                    setCreateSessionOpen(true);
                  }}
                >
                  Create session
                </button>
                <Sheet open={createSessionOpen} onOpenChange={handleSheetOpenChange}>
                  <SheetContent
                    side="right"
                    showCloseButton
                    className="flex h-full max-h-[100dvh] w-full flex-col gap-0 border-l border-border/80 bg-background p-0 shadow-xl sm:max-w-3xl"
                  >
                    <SheetHeader className="shrink-0 border-b border-border/80 px-4 py-4 sm:px-6">
                      <SheetTitle className="font-heading text-lg">
                        {createFlowPhase === "saved" ? "Session saved" : "New session"}
                      </SheetTitle>
                      <SheetDescription className="text-pretty text-foreground/85">
                        {createFlowPhase === "saved" ? (
                          <>
                            Your session is live on this league. Open the editor anytime to finish teams,
                            results, or mark it complete.
                          </>
                        ) : (
                          <>
                            Add teams, courts, and results—then use Save session at the bottom to add it to the
                            league.
                          </>
                        )}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:pb-6">
                      {createFlowPhase === "wizard" ? (
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
                          onDraftDirtyChange={setDraftDirty}
                          onFirstDraftSaved={({ sessionId, date: savedDate }) => {
                            setLastCreatedSession({ id: sessionId, date: savedDate });
                            setCreateFlowPhase("saved");
                            setDraftDirty(false);
                            router.refresh();
                          }}
                        />
                      ) : lastCreatedSession ? (
                        <div className="flex flex-col gap-4">
                          <p className="text-sm text-muted-foreground">
                            Session date:{" "}
                            <span className="font-medium text-foreground">{lastCreatedSession.date}</span>
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Link
                              href={`/leagues/${leagueId}/sessions/${lastCreatedSession.id}/edit`}
                              className={buttonVariants({ className: "w-fit" })}
                            >
                              Open session editor
                            </Link>
                            <LeagueSessionShareButton
                              leagueId={leagueId}
                              sessionId={lastCreatedSession.id}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {createFlowPhase === "saved" ? (
                      <SheetFooter className="shrink-0 border-t border-border/80">
                        <SheetClose render={<Button variant="outline" className="w-full sm:w-auto" />}>
                          Close
                        </SheetClose>
                      </SheetFooter>
                    ) : null}
                  </SheetContent>
                </Sheet>
                <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard unsaved session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You have changes that are not saved to the database yet. If you leave now, those
                        changes will be lost.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep editing</AlertDialogCancel>
                      <Button variant="destructive" onClick={confirmDiscardCreateSession}>
                        Discard
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                  showDraftSetupHints={canAdmin}
                  canDeleteDrafts={canAdmin}
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

      <PlayerProfileAnalyticsModal
        open={profilePlayerId !== null}
        onOpenChange={(o) => {
          if (!o) setProfilePlayerId(null);
        }}
        playerId={profilePlayerId}
        leagueId={leagueId}
        leagueFormat={leagueFormat}
        leagueResultsMode={leagueResultsMode}
        currentUserId={currentUserId}
      />

      <PairTeamStatsModal
        open={selectedPair !== null}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedPair(null);
            setPairModalSection("team");
          }
        }}
        pair={selectedPair}
        pairPlayerMetaById={pairPlayerMetaById}
        leagueId={leagueId}
        leagueFormat={leagueFormat}
        initialSection={pairModalSection}
      />
    </Tabs>
  );
}
