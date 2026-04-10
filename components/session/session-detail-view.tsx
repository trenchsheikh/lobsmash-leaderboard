import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Eye,
  LayoutGrid,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { formatSessionDate } from "@/components/league-sessions-list";
import { CompleteSessionButton } from "@/components/complete-session-button";
import { DeleteGameButton } from "@/components/delete-game-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
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
import { SessionCourt1WinsPanel } from "@/components/session/session-court1-wins-panel";
import type { PairChampionshipRow } from "@/lib/leaderboard";
import type { LeagueFormat } from "@/lib/league-format";
import { expectedWinForSides, formatPercent } from "@/lib/rating";
import { sessionStatusDisplayLabel } from "@/lib/session-status-label";
import { cn } from "@/lib/utils";

type PlayerDisplay = {
  name: string;
  username: string | null;
  avatar_url: string | null;
  isGuest: boolean;
};

export type SessionDetailGameRow = {
  id: string;
  court_number: number | null;
  team_a_players: string[] | null;
  team_b_players: string[] | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner: string | null;
};

export type SessionChampTableRow = {
  key: string;
  playerA: string;
  playerB: string;
  wins: number;
  share: number;
};

export type SessionDetailViewProps = {
  leagueId: string;
  sessionId: string;
  leagueFormat: LeagueFormat;
  sessionDate: string;
  sessionStatus: string;
  numCourts: number;
  inputMode: string | null;
  canAdmin: boolean;
  isParticipant: boolean;
  isDraft: boolean;
  isChampOnly: boolean;
  hasTeams: boolean;
  teamsReady: boolean;
  teamPairCount: number;
  sessionTeamRows: { player_a: string; player_b: string; sort_order: number }[];
  games: SessionDetailGameRow[];
  champTableRows: SessionChampTableRow[] | null;
  court1WinRows: { player_low: string; player_high: string; wins: number }[];
  court1LeaderPairs: { playerA: string; playerB: string }[];
  maxCourt1Wins: number;
  pairLeaderboard: PairChampionshipRow[];
  playersById: Record<string, PlayerDisplay>;
  skillsByPlayerId: Record<string, number>;
  myPlayerId: string | undefined;
};

function inputModeLabel(mode: string | null): string {
  if (mode === "champ_court_only") return "Court 1 only";
  return "Full scores";
}

function playerLine(id: string, playersById: Record<string, PlayerDisplay>): string {
  const p = playersById[id];
  if (!p) return id.slice(0, 8);
  const un = p.username?.trim();
  if (un) return `@${un}`;
  return p.name;
}

function formatTeam(ids: string[], playersById: Record<string, PlayerDisplay>): string {
  return ids.map((id) => playerLine(id, playersById)).join(" · ");
}

function SessionStatusBadge({ status }: { status: string }) {
  const draft = status === "draft";
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 px-2.5 py-0.5 text-xs font-semibold capitalize",
        draft
          ? "border-amber-500/45 bg-amber-500/[0.12] text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-50"
          : "border-emerald-500/40 bg-emerald-500/[0.1] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-50",
      )}
    >
      {sessionStatusDisplayLabel(status)}
    </Badge>
  );
}

export function SessionDetailView({
  leagueId,
  sessionId,
  leagueFormat,
  sessionDate,
  sessionStatus,
  numCourts,
  inputMode,
  canAdmin,
  isParticipant,
  isDraft,
  isChampOnly,
  hasTeams,
  teamsReady,
  teamPairCount,
  sessionTeamRows,
  games,
  champTableRows,
  court1WinRows,
  court1LeaderPairs,
  maxCourt1Wins,
  pairLeaderboard,
  playersById,
  skillsByPlayerId,
  myPlayerId,
}: SessionDetailViewProps) {
  const prettyDate = formatSessionDate(sessionDate);
  const modeLabel = inputModeLabel(inputMode);

  return (
    <div className="flex flex-col gap-8">
      {/* At a glance */}
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        <div className="flex items-start gap-4 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm ring-1 ring-foreground/[0.04] backdrop-blur-sm sm:p-6 dark:bg-card/60 dark:ring-white/[0.06]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Date</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{prettyDate}</p>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{sessionDate}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm ring-1 ring-foreground/[0.04] backdrop-blur-sm sm:p-6 dark:bg-card/60 dark:ring-white/[0.06]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <LayoutGrid className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Courts</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {numCourts} court{numCourts === 1 ? "" : "s"}
            </p>
            <div className="mt-2">
              <SessionStatusBadge status={sessionStatus} />
            </div>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm ring-1 ring-foreground/[0.04] backdrop-blur-sm sm:p-6 dark:bg-card/60 dark:ring-white/[0.06]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Format</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{modeLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isChampOnly ? "Championship court results only." : "Per-court games and scores."}
            </p>
          </div>
        </div>
      </div>

      {/* Role callouts */}
      {isParticipant ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
            "border-primary/25 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent",
            "shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
          )}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex gap-4">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                canAdmin ? "bg-primary/20 text-primary" : "bg-primary/15 text-primary",
              )}
            >
              {canAdmin ? <Shield className="size-5" aria-hidden /> : <UserRound className="size-5" aria-hidden />}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-heading text-base font-semibold tracking-tight text-foreground">
                You&apos;re in this session
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {canAdmin
                  ? "Edit teams and scores from Edit session, then mark complete when results are final."
                  : "League admins enter scores and mark the session complete. Review teams and results here anytime."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!isParticipant && !canAdmin ? (
        <div className="flex gap-4 rounded-2xl border border-border/80 bg-muted/25 p-5 ring-1 ring-foreground/[0.03] dark:bg-muted/15">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Eye className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">Spectator view</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You&apos;re viewing as a league member. Only admins can change teams or scores.
            </p>
          </div>
        </div>
      ) : null}

      {canAdmin && isDraft ? (
        <Card className="overflow-hidden border-amber-500/25 shadow-md ring-1 ring-amber-500/10 dark:border-amber-400/20 dark:ring-amber-400/10">
          <CardHeader className="space-y-3 border-b border-border/60 bg-gradient-to-r from-amber-500/[0.07] to-transparent pb-4 dark:from-amber-500/[0.09]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-900 dark:text-amber-100">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle className="font-heading text-lg">Ready to finalize?</CardTitle>
                <CardDescription className="text-pretty text-sm leading-relaxed">
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
                      When results look correct in the wizard, mark the session complete to update the leaderboard.
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {!hasTeams || !teamsReady ? (
              <Link
                href={`/leagues/${leagueId}/sessions/${sessionId}/edit`}
                className={buttonVariants({ variant: "default", size: "default", className: "w-full sm:w-auto" })}
              >
                Open session editor
              </Link>
            ) : (
              <CompleteSessionButton leagueId={leagueId} sessionId={sessionId} />
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isChampOnly && sessionTeamRows.length > 0 ? (
        <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-foreground/[0.04] dark:ring-white/[0.05]">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 dark:bg-muted/10">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" aria-hidden />
              <CardTitle className="font-heading text-xl tracking-tight">Teams</CardTitle>
            </div>
            <CardDescription className="text-pretty">
              Pairs saved for this session. Scores are added in the session editor.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessionTeamRows.map((t, i) => {
                const pa = t.player_a as string;
                const pb = t.player_b as string;
                const mine = Boolean(myPlayerId && (myPlayerId === pa || myPlayerId === pb));
                return (
                  <li
                    key={`${pa}-${pb}-${i}`}
                    className={cn(
                      "relative rounded-xl border px-4 py-3.5 transition-colors",
                      mine
                        ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/15"
                        : "border-border/80 bg-card/50 hover:border-border",
                    )}
                  >
                    {mine ? (
                      <Badge variant="secondary" className="absolute right-3 top-3 text-[10px]">
                        Your pair
                      </Badge>
                    ) : null}
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Pair {i + 1}
                    </p>
                    <p className="mt-2 break-words font-medium text-foreground">{playerLine(pa, playersById)}</p>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{playerLine(pb, playersById)}</p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isChampOnly ? (
        <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-foreground/[0.04] dark:ring-white/[0.05]">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-5 dark:bg-muted/10">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />
              <CardTitle className="font-heading text-xl tracking-tight">Court 1 wins</CardTitle>
            </div>
            <CardDescription className="max-w-3xl text-pretty text-sm leading-relaxed sm:text-[15px]">
              Championship court only — other courts are not recorded. Exp Win (levels) uses global padel ratings
              (softmax over pairs in this session).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <SessionCourt1WinsPanel
              leagueId={leagueId}
              leagueFormat={leagueFormat}
              court1LeaderPairs={court1LeaderPairs}
              maxCourt1Wins={maxCourt1Wins}
              champTableRows={champTableRows}
              court1WinRows={court1WinRows}
              pairLeaderboard={pairLeaderboard}
              playersById={playersById}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-foreground/[0.04] dark:ring-white/[0.05]">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4 dark:bg-muted/10">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-5 text-primary" aria-hidden />
            <CardTitle className="font-heading text-xl tracking-tight">Games</CardTitle>
          </div>
          <CardDescription className="text-pretty leading-relaxed">
            {isChampOnly
              ? "Per-game scores are not used in court 1 only mode. Legacy rows may appear if this session was recorded before that change."
              : "Courts, teams, and results. Side odds use global padel levels."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {!games.length ? (
            <p className="text-sm text-muted-foreground">
              {isChampOnly ? "No game rows stored for this session." : "No games logged yet."}
            </p>
          ) : (
            <>
              {/* Mobile-friendly cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {games.map((g) => {
                  const ta = (g.team_a_players as string[]) ?? [];
                  const tb = (g.team_b_players as string[]) ?? [];
                  const winEst =
                    ta.length >= 2 && tb.length >= 2 ? expectedWinForSides(ta, tb, skillsByPlayerId) : null;
                  const winner = (g.winner as string) ?? "";
                  return (
                    <li
                      key={g.id}
                      className="rounded-xl border border-border/80 bg-card/40 p-4 ring-1 ring-foreground/[0.03]"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Court {g.court_number ?? "—"}
                        </span>
                        {winner ? (
                          <Badge variant="secondary" className="capitalize">
                            {winner.replace("_", " ")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      <p className="mt-3 break-words text-sm font-medium text-foreground">
                        {formatTeam(ta, playersById)}
                      </p>
                      <p className="mt-2 text-center text-lg font-semibold tabular-nums tracking-tight">
                        {g.team_a_score} – {g.team_b_score}
                      </p>
                      <p className="mt-2 break-words text-sm font-medium text-foreground">
                        {formatTeam(tb, playersById)}
                      </p>
                      {winEst ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Odds (levels): A {formatPercent(winEst.teamA, 0)} · B {formatPercent(winEst.teamB, 0)}
                        </p>
                      ) : null}
                      {canAdmin && isDraft ? (
                        <div className="mt-4 flex justify-end border-t border-border/50 pt-3">
                          <DeleteGameButton leagueId={leagueId} sessionId={sessionId} gameId={g.id} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/80 bg-muted/40 hover:bg-muted/40 dark:bg-muted/25">
                      <TableHead className="w-14 font-semibold">Court</TableHead>
                      <TableHead className="font-semibold">Team A</TableHead>
                      <TableHead className="font-semibold">Team B</TableHead>
                      <TableHead className="font-semibold">Side odds</TableHead>
                      <TableHead className="font-semibold">Score</TableHead>
                      <TableHead className="font-semibold">Winner</TableHead>
                      {canAdmin && isDraft ? (
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map((g) => {
                      const ta = (g.team_a_players as string[]) ?? [];
                      const tb = (g.team_b_players as string[]) ?? [];
                      const winEst =
                        ta.length >= 2 && tb.length >= 2 ? expectedWinForSides(ta, tb, skillsByPlayerId) : null;
                      return (
                        <TableRow key={g.id} className="border-border/60">
                          <TableCell className="align-middle tabular-nums text-muted-foreground">
                            {g.court_number}
                          </TableCell>
                          <TableCell className="max-w-[220px] break-words text-sm">{formatTeam(ta, playersById)}</TableCell>
                          <TableCell className="max-w-[220px] break-words text-sm">{formatTeam(tb, playersById)}</TableCell>
                          <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                            {winEst ? (
                              <>
                                A {formatPercent(winEst.teamA, 0)} · B {formatPercent(winEst.teamB, 0)}
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium tabular-nums">
                            {g.team_a_score} – {g.team_b_score}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {(g.winner as string)?.replace("_", " ") ?? "—"}
                            </Badge>
                          </TableCell>
                          {canAdmin && isDraft ? (
                            <TableCell className="text-right">
                              <DeleteGameButton leagueId={leagueId} sessionId={sessionId} gameId={g.id} />
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
