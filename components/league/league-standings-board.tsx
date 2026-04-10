"use client";

import { useEffect, useMemo, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import type { LeaderboardRow, PairChampionshipRow } from "@/lib/leaderboard";
import { useStandingsRankDelta } from "@/lib/use-standings-rank-delta";
import { Badge } from "@/components/ui/badge";
import { StandingsRankDelta } from "@/components/league/standings-rank-delta";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { ListPagination } from "@/components/list-pagination";
import { PAGE_SIZE, slicePage } from "@/lib/paginate";

function formatScore(n: number) {
  return n.toLocaleString();
}

function formatSkillDeltaPreview(d: number) {
  if (!Number.isFinite(d) || Math.abs(d) < 0.05) return null;
  const r = Math.round(d);
  return r > 0 ? `+${r}` : `${r}`;
}

export function StandingsRankCell({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="size-5 shrink-0 text-amber-500" aria-hidden />;
  }
  if (rank === 2) {
    return <Medal className="size-5 shrink-0 text-slate-400" aria-hidden />;
  }
  if (rank === 3) {
    return (
      <Medal
        className="size-5 shrink-0 text-amber-900/75 dark:text-amber-700/90"
        aria-hidden
      />
    );
  }
  return (
    <span className="inline-flex min-w-[1.75rem] justify-center font-heading text-sm font-semibold tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

const rowInteractive =
  "cursor-pointer transition-[background-color,box-shadow,transform,border-color] duration-300 ease-out hover:bg-muted/45 hover:shadow-sm active:scale-[0.995]";

type RosterEntry = {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  isGuest: boolean;
};

export type LeaguePlayerStandingsBoardProps = {
  leagueId: string;
  title: string;
  subtitle: string;
  /** When embedded in a Card, omit duplicate page heading (CardTitle/Description handle copy). */
  variant?: "standalone" | "embedded";
  leaderboard: LeaderboardRow[];
  mode: "americano" | "summit" | "champ_secondary";
  currentPlayerId: string | null;
  rosterDisplay: RosterEntry[];
  /** Global `player_ratings.skill` by roster player id (missing → default). */
  rosterSkillByPlayerId: Record<string, number>;
  /** Optional draft-session skill preview deltas (same as roster). */
  skillPreviewDelta?: ReadonlyMap<string, number>;
  onPlayerClick: (playerId: string, isGuest: boolean) => void;
  scrollClassName?: string;
};

export function LeaguePlayerStandingsBoard({
  leagueId,
  title,
  subtitle,
  variant = "standalone",
  leaderboard,
  mode,
  currentPlayerId,
  rosterDisplay,
  rosterSkillByPlayerId,
  skillPreviewDelta,
  onPlayerClick,
  scrollClassName,
}: LeaguePlayerStandingsBoardProps) {
  const leader = leaderboard[0];
  const embedded = variant === "embedded";
  const playerKeys = useMemo(() => leaderboard.map((r) => r.player_id), [leaderboard]);
  const rankDeltas = useStandingsRankDelta(leagueId, "players", playerKeys);

  const [playerPage, setPlayerPage] = useState(1);
  const {
    slice: leaderboardPage,
    totalPages: playerTotalPages,
    startIndex: playerStartIndex,
    safePage: playerSafePage,
  } = slicePage(leaderboard, playerPage, PAGE_SIZE);
  const paginatePlayers = leaderboard.length > PAGE_SIZE;

  useEffect(() => {
    setPlayerPage(1);
  }, [leagueId, leaderboard.length]);

  useEffect(() => {
    if (playerSafePage !== playerPage) setPlayerPage(playerSafePage);
  }, [playerSafePage, playerPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {!embedded ? (
          <div className="min-w-0">
            <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {leader ? (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm dark:bg-amber-500/15">
            <Trophy className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span className="text-muted-foreground">Leader</span>
            <span className="font-semibold text-foreground">{leader.name}</span>
          </div>
        ) : null}
      </div>

      {leaderboard.length === 0 ? (
        <p className="text-sm text-muted-foreground">Play some games to populate stats.</p>
      ) : (
        <div
          className={cn(
            "rounded-xl border border-border/60",
            !paginatePlayers && "max-h-[min(70vh,44rem)] overflow-auto",
            scrollClassName,
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-14 text-center">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                {mode === "americano" ? (
                  <>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Games</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                  </>
                ) : mode === "summit" ? (
                  <>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Games</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardPage.map((row, idx) => {
                const rank = playerStartIndex + idx + 1;
                const roster = rosterDisplay.find((r) => r.id === row.player_id);
                const avatarUrl = row.avatar_url ?? roster?.avatar_url ?? null;
                const username = row.username ?? roster?.username ?? null;
                const isGuest = roster?.isGuest ?? false;
                const isYou = currentPlayerId !== null && row.player_id === currentPlayerId;
                const skillRaw = rosterSkillByPlayerId[row.player_id];
                const skill =
                  typeof skillRaw === "number" && Number.isFinite(skillRaw)
                    ? skillRaw
                    : DEFAULT_SKILL;
                const skillPreviewStr = !isGuest
                  ? formatSkillDeltaPreview(skillPreviewDelta?.get(row.player_id) ?? 0)
                  : null;
                const winRate =
                  row.total_games > 0
                    ? `${Math.round((row.total_wins / row.total_games) * 100)}%`
                    : "—";
                const winRateSummit =
                  row.sessions_played > 0
                    ? `${Math.round((row.total_wins / row.sessions_played) * 100)}%`
                    : "—";

                let scoreLabel: string;
                let gamesLabel: string;
                let rateLabel: string;
                if (mode === "americano") {
                  scoreLabel = formatScore(row.total_points);
                  gamesLabel = formatScore(row.total_games);
                  rateLabel = winRate;
                } else if (mode === "summit") {
                  scoreLabel = formatScore(row.total_wins);
                  gamesLabel = formatScore(row.total_games);
                  rateLabel = winRate;
                } else {
                  scoreLabel = formatScore(row.total_wins);
                  gamesLabel = formatScore(row.sessions_played);
                  rateLabel = winRateSummit;
                }

                return (
                  <TableRow
                    key={row.player_id}
                    className={cn(
                      rowInteractive,
                      "border-border/50",
                      isYou && "bg-muted/50 hover:bg-muted/55",
                    )}
                    onClick={() => onPlayerClick(row.player_id, isGuest)}
                  >
                    <TableCell className="align-middle text-center">
                      <div className="flex justify-center">
                        <StandingsRankCell rank={rank} />
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="flex min-w-0 items-start gap-3">
                        <UserAvatarDisplay
                          name={row.name}
                          username={username}
                          avatarUrl={avatarUrl}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-foreground">{row.name}</span>
                            <StandingsRankDelta
                              delta={rankDeltas[row.player_id] ?? null}
                              className="shrink-0"
                            />
                            {isYou ? <Badge variant="secondary">You</Badge> : null}
                          </div>
                          {username ? (
                            <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                              @{username}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-middle tabular-nums">
                      {isGuest ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-foreground" title={`Global skill: ${Math.round(skill)} pts`}>
                          Lv {formatDisplayLevel(skill)}
                          {skillPreviewStr ? (
                            <span className="ml-1 text-amber-800 dark:text-amber-400">
                              Δ{skillPreviewStr}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-middle">
                      <span className="font-semibold tabular-nums text-foreground">{scoreLabel}</span>
                    </TableCell>
                    <TableCell className="text-right align-middle tabular-nums text-foreground">
                      {gamesLabel}
                    </TableCell>
                    <TableCell className="text-right align-middle">
                      <span
                        className={cn(
                          "tabular-nums",
                          (mode === "americano" || mode === "summit") &&
                            row.total_games > 0 &&
                            row.total_wins / row.total_games >= 0.55
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : mode === "champ_secondary" &&
                                row.sessions_played > 0 &&
                                row.total_wins / row.sessions_played >= 0.55
                              ? "font-medium text-emerald-700 dark:text-emerald-400"
                              : "text-foreground",
                        )}
                      >
                        {rateLabel}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {paginatePlayers ? (
        <ListPagination
          currentPage={playerSafePage}
          totalPages={playerTotalPages}
          onPageChange={setPlayerPage}
        />
      ) : null}
    </div>
  );
}

export type LeaguePairStandingsBoardProps = {
  leagueId: string;
  title: string;
  subtitle: string;
  variant?: "standalone" | "embedded";
  pairLeaderboard: PairChampionshipRow[];
  pairPlayerMetaById: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
  rosterDisplay: RosterEntry[];
  currentPlayerId: string | null;
  onPairRowClick: (row: PairChampionshipRow) => void;
  onPairFocusPlayer: (row: PairChampionshipRow, which: "low" | "high") => void;
  scrollClassName?: string;
};

export function LeaguePairStandingsBoard({
  leagueId,
  title,
  subtitle,
  variant = "standalone",
  pairLeaderboard,
  pairPlayerMetaById,
  rosterDisplay,
  currentPlayerId,
  onPairRowClick,
  onPairFocusPlayer,
  scrollClassName,
}: LeaguePairStandingsBoardProps) {
  const leader = pairLeaderboard[0];
  const embedded = variant === "embedded";
  const pairKeys = useMemo(
    () => pairLeaderboard.map((r) => `${r.player_low}\u0000${r.player_high}`),
    [pairLeaderboard],
  );
  const rankDeltas = useStandingsRankDelta(leagueId, "pairs", pairKeys);

  const [pairPage, setPairPage] = useState(1);
  const {
    slice: pairLeaderboardPage,
    totalPages: pairTotalPages,
    startIndex: pairStartIndex,
    safePage: pairSafePage,
  } = slicePage(pairLeaderboard, pairPage, PAGE_SIZE);
  const paginatePairs = pairLeaderboard.length > PAGE_SIZE;

  useEffect(() => {
    setPairPage(1);
  }, [leagueId, pairLeaderboard.length]);

  useEffect(() => {
    if (pairSafePage !== pairPage) setPairPage(pairSafePage);
  }, [pairSafePage, pairPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {!embedded ? (
          <div className="min-w-0">
            <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {leader ? (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm dark:bg-amber-500/15">
            <Trophy className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span className="text-muted-foreground">Leader</span>
            <span className="font-semibold text-foreground">{leader.label}</span>
          </div>
        ) : null}
      </div>

      {pairLeaderboard.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pair stats yet — complete a session with court 1 win counts for each team.
        </p>
      ) : (
        <div
          className={cn(
            "rounded-xl border border-border/60",
            !paginatePairs && "max-h-[min(70vh,44rem)] overflow-auto",
            scrollClassName,
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-14 text-center">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Avg / session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairLeaderboardPage.map((row, idx) => {
                const rank = pairStartIndex + idx + 1;
                const pLow = pairPlayerMetaById[row.player_low];
                const pHigh = pairPlayerMetaById[row.player_high];
                const gLow = rosterDisplay.find((r) => r.id === row.player_low)?.isGuest;
                const gHigh = rosterDisplay.find((r) => r.id === row.player_high)?.isGuest;
                const avgWinsPerSession =
                  row.sessions_played > 0
                    ? (row.championship_wins / row.sessions_played).toFixed(1)
                    : "—";
                const isYou =
                  currentPlayerId !== null &&
                  (row.player_low === currentPlayerId || row.player_high === currentPlayerId);
                const pairKey = `${row.player_low}\u0000${row.player_high}`;

                return (
                  <TableRow
                    key={`${row.player_low}-${row.player_high}`}
                    className={cn(
                      rowInteractive,
                      "border-border/50",
                      isYou && "bg-muted/50 hover:bg-muted/55",
                    )}
                    onClick={() => onPairRowClick(row)}
                  >
                    <TableCell className="align-middle text-center">
                      <div className="flex justify-center">
                        <StandingsRankCell rank={rank} />
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPairFocusPlayer(row, "low");
                            }}
                          >
                            <UserAvatarDisplay
                              name={pLow?.name ?? "—"}
                              username={pLow?.username}
                              avatarUrl={pLow?.avatar_url}
                              size="sm"
                            />
                          </button>
                          <button
                            type="button"
                            className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPairFocusPlayer(row, "high");
                            }}
                          >
                            <UserAvatarDisplay
                              name={pHigh?.name ?? "—"}
                              username={pHigh?.username}
                              avatarUrl={pHigh?.avatar_url}
                              size="sm"
                            />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-foreground">{row.label}</span>
                            <StandingsRankDelta
                              delta={rankDeltas[pairKey] ?? null}
                              className="shrink-0"
                            />
                            {isYou ? <Badge variant="secondary">You</Badge> : null}
                          </div>
                          {(gLow || gHigh) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {gLow ? "Includes guest on this pair. " : null}
                              {gHigh ? "Includes guest on this pair." : null}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-middle">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatScore(row.championship_wins)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right align-middle tabular-nums text-foreground">
                      {formatScore(row.sessions_played)}
                    </TableCell>
                    <TableCell className="text-right align-middle tabular-nums text-foreground">
                      {avgWinsPerSession}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {paginatePairs ? (
        <ListPagination
          currentPage={pairSafePage}
          totalPages={pairTotalPages}
          onPageChange={setPairPage}
        />
      ) : null}
    </div>
  );
}
