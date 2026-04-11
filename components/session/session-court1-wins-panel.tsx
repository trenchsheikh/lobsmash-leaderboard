"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import type { PairChampionshipRow } from "@/lib/leaderboard";
import type { LeagueFormat } from "@/lib/league-format";
import {
  PairTeamStatsModal,
  type PairTeamModalSection,
} from "@/components/pair-team-stats-modal";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayFirstName } from "@/lib/display-name";
import { formatPercent } from "@/lib/rating";
import { cn } from "@/lib/utils";

export type Court1PlayerMeta = {
  name: string;
  username: string | null;
  avatar_url: string | null;
  isGuest: boolean;
};

type ChampRow = {
  key: string;
  playerA: string;
  playerB: string;
  wins: number;
  share: number;
};

type WinRow = { player_low: string; player_high: string; wins: number };

type LeaderPair = { playerA: string; playerB: string };

const rowInteractive =
  "cursor-pointer transition-[background-color,box-shadow,transform,border-color] duration-300 ease-out hover:bg-muted/45 hover:shadow-sm active:scale-[0.995]";

function displayName(meta: Court1PlayerMeta | undefined, id: string): string {
  if (!meta) return id.slice(0, 8);
  const un = meta.username?.trim();
  if (un) return `@${un}`;
  return meta.name;
}

function PairAvatarsAndNames({
  playerAId,
  playerBId,
  playersById,
  onPlayerClickInPair,
}: {
  playerAId: string;
  playerBId: string;
  playersById: Record<string, Court1PlayerMeta>;
  onPlayerClickInPair: (playerId: string, e: MouseEvent) => void;
}) {
  const ma = playersById[playerAId];
  const mb = playersById[playerBId];
  const guestA = ma?.isGuest ?? true;
  const guestB = mb?.isGuest ?? true;

  const avatarBtn =
    "rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex shrink-0 gap-0.5 pt-0.5">
        <button
          type="button"
          className={avatarBtn}
          onClick={(e) => onPlayerClickInPair(playerAId, e)}
          aria-label={`Open team profile: ${displayName(ma, playerAId)}`}
        >
          {guestA ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              G
            </div>
          ) : (
            <UserAvatarDisplay
              name={ma!.name}
              username={ma!.username}
              avatarUrl={ma!.avatar_url}
              size="sm"
            />
          )}
        </button>
        <button
          type="button"
          className={avatarBtn}
          onClick={(e) => onPlayerClickInPair(playerBId, e)}
          aria-label={`Open team profile: ${displayName(mb, playerBId)}`}
        >
          {guestB ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              G
            </div>
          ) : (
            <UserAvatarDisplay
              name={mb!.name}
              username={mb!.username}
              avatarUrl={mb!.avatar_url}
              size="sm"
            />
          )}
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          className="w-full min-w-0 rounded-md text-left text-sm font-medium break-words text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={(e) => onPlayerClickInPair(playerAId, e)}
        >
          {displayName(ma, playerAId)}
        </button>
        <button
          type="button"
          className="w-full min-w-0 rounded-md text-left text-sm break-words text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={(e) => onPlayerClickInPair(playerBId, e)}
        >
          {displayName(mb, playerBId)}
        </button>
      </div>
    </div>
  );
}

export function SessionCourt1WinsPanel({
  leagueId,
  leagueFormat,
  court1LeaderPairs,
  maxCourt1Wins,
  champTableRows,
  court1WinRows,
  pairLeaderboard,
  playersById,
}: {
  leagueId: string;
  leagueFormat: LeagueFormat;
  court1LeaderPairs: LeaderPair[];
  maxCourt1Wins: number;
  champTableRows: ChampRow[] | null;
  court1WinRows: WinRow[];
  pairLeaderboard: PairChampionshipRow[];
  playersById: Record<string, Court1PlayerMeta>;
}) {
  const [selectedPair, setSelectedPair] = useState<PairChampionshipRow | null>(null);
  const [pairModalSection, setPairModalSection] = useState<PairTeamModalSection>("team");

  const pairPlayerMetaById = useMemo(() => {
    const o: Record<string, { name: string; username: string | null; avatar_url: string | null }> = {};
    for (const [id, p] of Object.entries(playersById)) {
      o[id] = { name: p.name, username: p.username, avatar_url: p.avatar_url };
    }
    return o;
  }, [playersById]);

  const resolvePairRow = useCallback(
    (a: string, b: string): PairChampionshipRow => {
      const low = a < b ? a : b;
      const high = a < b ? b : a;
      const found = pairLeaderboard.find((r) => r.player_low === low && r.player_high === high);
      if (found) return found;
      const n1 = playersById[low]?.name ?? "Player";
      const n2 = playersById[high]?.name ?? "Player";
      const sorted = [n1, n2].sort((x, y) => x.localeCompare(y));
      const label = `${displayFirstName(sorted[0])} & ${displayFirstName(sorted[1])}`;
      return {
        player_low: low,
        player_high: high,
        label,
        championship_wins: 0,
        sessions_played: 0,
      };
    },
    [pairLeaderboard, playersById],
  );

  const openPairTeam = useCallback(
    (a: string, b: string) => {
      setPairModalSection("team");
      setSelectedPair(resolvePairRow(a, b));
    },
    [resolvePairRow],
  );

  const openPairPlayerTab = useCallback(
    (playerId: string, pairA: string, pairB: string) => {
      const row = resolvePairRow(pairA, pairB);
      const section: PairTeamModalSection = playerId === row.player_low ? "low" : "high";
      setPairModalSection(section);
      setSelectedPair(row);
    },
    [resolvePairRow],
  );

  const hasFullChampTable = Boolean(champTableRows && champTableRows.length > 0);
  const hasSimpleWins = court1WinRows.length > 0;

  return (
    <>
      {court1LeaderPairs.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-4 dark:bg-amber-500/[0.08] sm:px-5">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Session leader{court1LeaderPairs.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
            {court1LeaderPairs.map((pair, i) => (
              <div
                key={`${pair.playerA}-${pair.playerB}-${i}`}
                className={cn(
                  rowInteractive,
                  "rounded-xl border border-transparent px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                role="button"
                tabIndex={0}
                onClick={() => openPairTeam(pair.playerA, pair.playerB)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPairTeam(pair.playerA, pair.playerB);
                  }
                }}
              >
                <PairAvatarsAndNames
                  playerAId={pair.playerA}
                  playerBId={pair.playerB}
                  playersById={playersById}
                  onPlayerClickInPair={(playerId, ev) => {
                    ev.stopPropagation();
                    openPairPlayerTab(playerId, pair.playerA, pair.playerB);
                  }}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{maxCourt1Wins}</span> win
            {maxCourt1Wins === 1 ? "" : "s"} on court 1
          </p>
        </div>
      ) : null}

      {!hasSimpleWins && !hasFullChampTable ? (
        <p className="text-sm text-muted-foreground">No court 1 wins logged yet.</p>
      ) : hasFullChampTable ? (
        <div className="overflow-hidden rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="border-border/80 bg-muted/40 hover:bg-muted/40 dark:bg-muted/25">
                <TableHead className="min-w-0 pl-3 font-semibold sm:min-w-[16rem] sm:pl-5">
                  Team
                </TableHead>
                <TableHead className="min-w-0 text-right font-semibold sm:pr-5">
                  <span className="sm:hidden">Exp Win</span>
                  <span className="hidden sm:inline">Exp Win (levels)</span>
                </TableHead>
                <TableHead className="min-w-0 text-right font-semibold sm:pr-5">
                  <span className="sm:hidden">C1 wins</span>
                  <span className="hidden sm:inline">Wins on court 1</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {champTableRows!.map((row) => (
                <TableRow
                  key={row.key}
                  className={cn("border-border/60", rowInteractive)}
                  onClick={() => openPairTeam(row.playerA, row.playerB)}
                >
                  <TableCell className="max-w-[min(100%,28rem)] py-4 pl-4 align-middle sm:pl-5">
                    <PairAvatarsAndNames
                      playerAId={row.playerA}
                      playerBId={row.playerB}
                      playersById={playersById}
                      onPlayerClickInPair={(playerId, ev) => {
                        ev.stopPropagation();
                        openPairPlayerTab(playerId, row.playerA, row.playerB);
                      }}
                    />
                  </TableCell>
                  <TableCell className="py-4 text-right align-middle tabular-nums text-muted-foreground sm:pr-5">
                    {formatPercent(row.share, 1)}
                  </TableCell>
                  <TableCell className="py-4 pr-4 text-right align-middle text-base font-medium tabular-nums sm:pr-5">
                    {row.wins}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow className="border-border/80 bg-muted/40 hover:bg-muted/40 dark:bg-muted/25">
                <TableHead className="min-w-0 pl-3 font-semibold sm:min-w-[12rem] sm:pl-5">
                  Team
                </TableHead>
                <TableHead className="min-w-0 text-right font-semibold sm:pr-5">
                  <span className="sm:hidden">C1 wins</span>
                  <span className="hidden sm:inline">Wins on court 1</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {court1WinRows.map((r) => (
                <TableRow
                  key={`${r.player_low}-${r.player_high}`}
                  className={cn("border-border/60", rowInteractive)}
                  onClick={() => openPairTeam(r.player_low, r.player_high)}
                >
                  <TableCell className="max-w-[min(100%,28rem)] py-4 pl-4 align-middle sm:pl-5">
                    <PairAvatarsAndNames
                      playerAId={r.player_low}
                      playerBId={r.player_high}
                      playersById={playersById}
                      onPlayerClickInPair={(playerId, ev) => {
                        ev.stopPropagation();
                        openPairPlayerTab(playerId, r.player_low, r.player_high);
                      }}
                    />
                  </TableCell>
                  <TableCell className="py-4 pr-4 text-right align-middle text-base font-medium tabular-nums sm:pr-5">
                    {r.wins}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
    </>
  );
}
