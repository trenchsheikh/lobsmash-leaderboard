"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeSession } from "@/app/actions/sessions";
import {
  replaceSessionCourt1PairWins,
  replaceSessionGames,
  updateSessionDraftMeta,
  upsertSessionTeams,
  type InputMode,
  type GameRowInput,
} from "@/app/actions/session-wizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  averageTeamSkill,
  expectedChampShares,
  expectedWinForSides,
  formatDisplayLevel,
  formatPercent,
  skillForPlayer,
} from "@/lib/rating";
import { Check, Plus, Shuffle, Trash2 } from "lucide-react";

export type RosterPlayer = {
  playerId: string;
  displayName: string;
  username: string | null;
  isGuest: boolean;
};

function clampCourts(n: number): number {
  return Math.min(12, Math.max(1, Math.round(n)));
}

function courtsFromString(s: string, fallback: number): number {
  const trimmed = s.trim();
  if (trimmed === "") return fallback;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return fallback;
  return clampCourts(n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function labelForPlayer(p: RosterPlayer): string {
  if (p.username) return `@${p.username}`;
  return `${p.displayName}${p.isGuest ? " (guest)" : ""}`;
}

export type GameRowState = {
  courtNumber: number;
  teamAIdx: number;
  teamBIdx: number;
  scoreAStr: string;
  scoreBStr: string;
  winner: "team_a" | "team_b";
};

export function SessionCreateWizard({
  leagueId,
  sessionId,
  defaultCourts,
  roster,
  leagueResultsMode,
  initialNumCourts,
  initialCourt1PairWins = [],
  skillsByPlayerId = {},
  initialDate,
  initialTeams,
  initialGameRows,
  initialAttendingIds,
  sessionCompletionStatus = "draft",
}: {
  leagueId: string;
  sessionId: string;
  defaultCourts: number;
  roster: RosterPlayer[];
  leagueResultsMode: InputMode;
  initialNumCourts?: number;
  initialCourt1PairWins?: { player_low: string; player_high: string; wins: number }[];
  /** Global `player_ratings.skill` by `player_id` (missing → default). */
  skillsByPlayerId?: Record<string, number>;
  /** When editing an existing draft, hydrate date/teams/games from the server. */
  initialDate?: string;
  initialTeams?: [string, string][];
  initialGameRows?: GameRowState[];
  /** Roster order; defaults to roster players that appear in `initialTeams`. */
  initialAttendingIds?: string[];
  /** Completed sessions hide “Complete session”; saves still update leaderboard and padel levels. */
  sessionCompletionStatus?: "draft" | "completed";
}) {
  const router = useRouter();
  const isCompletedSession = sessionCompletionStatus === "completed";
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(
    () => initialDate ?? new Date().toISOString().slice(0, 10),
  );
  const [courtsInput, setCourtsInput] = useState(() =>
    String(initialNumCourts ?? defaultCourts),
  );
  const inputMode = leagueResultsMode;

  const [attendingIds, setAttendingIds] = useState<string[]>(() => {
    if (initialAttendingIds?.length) return initialAttendingIds;
    if (initialTeams?.length) {
      const ids = new Set(initialTeams.flat());
      return roster.map((r) => r.playerId).filter((id) => ids.has(id));
    }
    return [];
  });
  const [teams, setTeams] = useState<[string, string][]>(() => initialTeams ?? []);
  const [teamMode, setTeamMode] = useState<"spin" | "manual">(() =>
    initialTeams && initialTeams.length > 0 ? "manual" : "spin",
  );
  const [manualPick, setManualPick] = useState<string | null>(null);
  const [playerSwapPick, setPlayerSwapPick] = useState<{
    teamIdx: number;
    slot: 0 | 1;
  } | null>(null);
  const playerSwapPickRef = useRef<{ teamIdx: number; slot: 0 | 1 } | null>(null);

  const [gameRows, setGameRows] = useState<GameRowState[]>(
    () => initialGameRows ?? [],
  );
  const [champCourt1WinsStr, setChampCourt1WinsStr] = useState<string[]>([]);

  const numCourts = useMemo(
    () => courtsFromString(courtsInput, defaultCourts),
    [courtsInput, defaultCourts],
  );

  const effectiveCourts = numCourts;

  const champExpectedShares = useMemo(() => {
    if (inputMode !== "champ_court_only" || teams.length === 0) return [] as number[];
    const pairSkills = teams.map(
      ([a, b]) =>
        (skillForPlayer(a, skillsByPlayerId) + skillForPlayer(b, skillsByPlayerId)) / 2,
    );
    return expectedChampShares(pairSkills);
  }, [inputMode, teams, skillsByPlayerId]);

  const maxSelectablePlayers = effectiveCourts * 4;
  const requiredPlayersForSession = maxSelectablePlayers;
  const teamsRequired = effectiveCourts * 2;

  useEffect(() => {
    setAttendingIds((prev) =>
      prev.length > maxSelectablePlayers ? prev.slice(0, maxSelectablePlayers) : prev,
    );
  }, [maxSelectablePlayers]);

  useEffect(() => {
    const allowed = new Set(attendingIds);
    setTeams((prev) => prev.filter(([a, b]) => allowed.has(a) && allowed.has(b)));
  }, [attendingIds]);

  useEffect(() => {
    setCourtsInput(String(initialNumCourts ?? defaultCourts));
  }, [initialNumCourts, defaultCourts]);

  useEffect(() => {
    if (initialCourt1PairWins.length === 0 || teams.length === 0) return;
    setChampCourt1WinsStr((prev) => {
      if (prev.length === teams.length) return prev;
      return teams.map(([a, b]) => {
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        const row = initialCourt1PairWins.find((x) => x.player_low === lo && x.player_high === hi);
        return String(row?.wins ?? 0);
      });
    });
  }, [initialCourt1PairWins, teams]);

  function toggleAttend(id: string) {
    setAttendingIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelectablePlayers) {
        toast.info("Maximum reached for this session size.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function buildSpinTeams() {
    if (attendingIds.length !== requiredPlayersForSession) {
      toast.error(
        `Select exactly ${requiredPlayersForSession} player${requiredPlayersForSession === 1 ? "" : "s"} (${effectiveCourts} court${effectiveCourts === 1 ? "" : "s"} × 4).`,
      );
      return;
    }
    const order = shuffle(attendingIds);
    const pairs: [string, string][] = [];
    for (let i = 0; i < order.length; i += 2) {
      pairs.push([order[i]!, order[i + 1]!]);
    }
    playerSwapPickRef.current = null;
    setPlayerSwapPick(null);
    setTeams(pairs);
  }

  function addManualTeam(a: string, b: string) {
    if (a === b) return;
    const used = new Set(teams.flat());
    if (used.has(a) || used.has(b)) return;
    playerSwapPickRef.current = null;
    setPlayerSwapPick(null);
    setTeams((t) => [...t, [a, b]]);
  }

  function removeTeam(idx: number) {
    playerSwapPickRef.current = null;
    setPlayerSwapPick(null);
    setTeams((t) => t.filter((_, i) => i !== idx));
  }

  function swapPlayers(tIdx: number, slot: 0 | 1, otherTIdx: number, otherSlot: 0 | 1) {
    setTeams((prev) => {
      const next = prev.map((pair) => [...pair] as [string, string]);
      const x = next[tIdx]![slot]!;
      next[tIdx]![slot] = next[otherTIdx]![otherSlot]!;
      next[otherTIdx]![otherSlot] = x;
      return next;
    });
  }

  function onSaveTeams() {
    if (teams.length === 0) {
      toast.error("Create at least one team.");
      return;
    }
    if (teams.length < numCourts * 2) {
      toast.error(
        `Need at least ${numCourts * 2} teams for ${numCourts} court${numCourts === 1 ? "" : "s"} (${numCourts * 2} pairs of players).`,
      );
      return;
    }
    const payload = teams.map(([playerA, playerB]) => ({ playerA, playerB }));
    startTransition(async () => {
      const res = await upsertSessionTeams(leagueId, sessionId, payload);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (inputMode === "full") {
        setGameRows(
          Array.from({ length: numCourts }, (_, i) => ({
            courtNumber: i + 1,
            teamAIdx: i * 2,
            teamBIdx: i * 2 + 1,
            scoreAStr: "6",
            scoreBStr: "4",
            winner: "team_a" as const,
          })),
        );
        setChampCourt1WinsStr([]);
      } else {
        setGameRows([]);
        setChampCourt1WinsStr(
          teams.map(([a, b]) => {
            const lo = a < b ? a : b;
            const hi = a < b ? b : a;
            const row = initialCourt1PairWins.find((x) => x.player_low === lo && x.player_high === hi);
            return String(row?.wins ?? 0);
          }),
        );
      }
      router.refresh();
    });
  }

  function parseScoreInt(s: string): number {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function normalizeScoreBlur(s: string): string {
    return String(parseScoreInt(s));
  }

  function parseCourt1Wins(s: string): number {
    const n = parseInt(s.trim(), 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(999, Math.floor(n));
  }

  const champSessionLeaders = useMemo(() => {
    if (inputMode !== "champ_court_only") return null;
    if (teams.length === 0 || champCourt1WinsStr.length !== teams.length) return null;
    const scores = teams.map((pair, i) => ({
      wins: parseCourt1Wins(champCourt1WinsStr[i] ?? "0"),
      label: pair
        .map((id) => roster.find((r) => r.playerId === id)?.displayName ?? "Player")
        .join(" · "),
    }));
    const maxW = Math.max(0, ...scores.map((s) => s.wins));
    if (maxW <= 0) return { maxW: 0, labels: [] as string[] };
    const labels = scores.filter((s) => s.wins === maxW).map((s) => s.label);
    return { maxW, labels };
  }, [inputMode, teams, champCourt1WinsStr, roster]);

  /** Persists current teams to `session_teams`, then court-1 wins. Server validates pairs against saved teams. */
  async function persistChampCourt1Results(): Promise<{ error?: string }> {
    if (teams.length < teamsRequired) {
      return { error: "Save teams first (need enough pairs for every court)." };
    }
    if (champCourt1WinsStr.length !== teams.length) {
      return { error: "Court 1 wins are out of sync with teams — save teams again." };
    }
    const rows = teams.map(([playerA, playerB], i) => ({
      playerA,
      playerB,
      wins: parseCourt1Wins(champCourt1WinsStr[i] ?? "0"),
    }));
    const teamPayload = teams.map(([playerA, playerB]) => ({ playerA, playerB }));
    const teamRes = await upsertSessionTeams(leagueId, sessionId, teamPayload);
    if ("error" in teamRes && teamRes.error) {
      return { error: teamRes.error };
    }
    const res = await replaceSessionCourt1PairWins(leagueId, sessionId, rows);
    if ("error" in res && res.error) {
      return { error: res.error };
    }
    return {};
  }

  function onSaveGames() {
    if (inputMode === "champ_court_only") {
      startTransition(async () => {
        const out = await persistChampCourt1Results();
        if (out.error) {
          toast.error(out.error);
          return;
        }
        toast.success("Court 1 results saved");
        router.refresh();
      });
      return;
    }

    const teamList = teams;
    const games: GameRowInput[] = [];

    for (let i = 0; i < gameRows.length; i++) {
      const row = gameRows[i]!;
      const ta = teamList[row.teamAIdx];
      const tb = teamList[row.teamBIdx];
      if (!ta || !tb) {
        toast.error("Invalid team selection.");
        return;
      }
      if (row.teamAIdx === row.teamBIdx) {
        toast.error("Team A and B must differ.");
        return;
      }
      const teamAScore = parseScoreInt(row.scoreAStr);
      const teamBScore = parseScoreInt(row.scoreBStr);
      games.push({
        courtNumber: row.courtNumber,
        teamAPlayers: [ta[0], ta[1]],
        teamBPlayers: [tb[0], tb[1]],
        teamAScore,
        teamBScore,
        winner: row.winner,
      });
    }

    startTransition(async () => {
      const res = await replaceSessionGames(leagueId, sessionId, games, {
        numCourts: effectiveCourts,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Results saved");
      router.refresh();
    });
  }

  function onComplete() {
    startTransition(async () => {
      if (inputMode === "champ_court_only") {
        const out = await persistChampCourt1Results();
        if (out.error) {
          toast.error(out.error);
          return;
        }
      }
      const res = await completeSession(leagueId, sessionId, {
        numCourts: effectiveCourts,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Session completed — leaderboard updated");
      router.push(`/leagues/${leagueId}/sessions/${sessionId}`);
      router.refresh();
    });
  }

  const unassigned = useMemo(() => {
    const used = new Set(teams.flat());
    return attendingIds.filter((id) => !used.has(id));
  }, [attendingIds, teams]);

  function handlePlayerChipClick(teamIdx: number, slot: 0 | 1) {
    const pending = playerSwapPickRef.current;
    if (!pending) {
      playerSwapPickRef.current = { teamIdx, slot };
      setPlayerSwapPick({ teamIdx, slot });
      return;
    }
    if (pending.teamIdx === teamIdx && pending.slot === slot) {
      playerSwapPickRef.current = null;
      setPlayerSwapPick(null);
      return;
    }
    swapPlayers(pending.teamIdx, pending.slot, teamIdx, slot);
    playerSwapPickRef.current = null;
    setPlayerSwapPick(null);
  }

  const atAttendanceCap = attendingIds.length >= maxSelectablePlayers;
  const teamsProgress = teams.length >= teamsRequired;

  const courtsCoveredInResults = useMemo(() => {
    const s = new Set<number>();
    for (const row of gameRows) s.add(row.courtNumber);
    return s;
  }, [gameRows]);

  const missingCourtsMessage =
    inputMode === "full" && gameRows.length > 0 && teams.length > 0
      ? Array.from({ length: effectiveCourts }, (_, i) => i + 1).filter(
          (c) => !courtsCoveredInResults.has(c),
        )
      : [];

  function addGameRow() {
    setGameRows((rows) => {
      const last = rows[rows.length - 1];
      const maxTeamIdx = Math.max(0, teams.length - 1);
      const defaultCourt = last
        ? Math.min(effectiveCourts, last.courtNumber)
        : 1;
      return [
        ...rows,
        {
          courtNumber: defaultCourt,
          teamAIdx: 0,
          teamBIdx: Math.min(1, maxTeamIdx),
          scoreAStr: "6",
          scoreBStr: "4",
          winner: "team_a" as const,
        },
      ];
    });
  }

  function removeGameRow(idx: number) {
    setGameRows((rows) => rows.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-8">
      {isCompletedSession ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This session is already <span className="font-medium text-foreground">complete</span>. Saving teams or
          results updates the league standings and global padel levels for everyone in this session.
        </div>
      ) : null}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight">Session details</h2>
        <div className="space-y-2">
          <Label htmlFor="sess-date">Session date</Label>
          <Input
            id="sess-date"
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              setDate(v);
              startTransition(async () => {
                const res = await updateSessionDraftMeta(leagueId, sessionId, {
                  date: v,
                  numCourts,
                });
                if ("error" in res && res.error) toast.error(res.error);
                else router.refresh();
              });
            }}
          />
        </div>
        <p className="text-muted-foreground text-sm">
          {inputMode === "full" ? (
            <>
              This league records <span className="font-medium text-foreground">full session</span> results
              (game scores per court). The mode was set when the league was created and cannot be changed here.
            </>
          ) : (
            <>
              This league records <span className="font-medium text-foreground">championship court only</span>{" "}
              results (court 1 win counts per team). The mode was set when the league was created and cannot be
              changed here.
            </>
          )}
        </p>
        <div className="space-y-2">
          <Label htmlFor="sess-courts">Courts in play (1–12)</Label>
          <Input
            id="sess-courts"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={courtsInput}
            onChange={(e) => setCourtsInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const next = courtsFromString(courtsInput, defaultCourts);
              setCourtsInput(String(next));
              startTransition(async () => {
                const res = await updateSessionDraftMeta(leagueId, sessionId, {
                  date,
                  numCourts: next,
                });
                if ("error" in res && res.error) toast.error(res.error);
                else router.refresh();
              });
            }}
          />
          {inputMode === "champ_court_only" ? (
            <p className="text-muted-foreground text-xs">
              Roster and teams use this many courts (×4 players, ×2 teams per court). Only court 1 wins
              you enter below affect stats.
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Who&apos;s playing?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap players to include them. Each court needs four people (two pairs), so you can pick up to{" "}
              <span className="font-medium text-foreground">{maxSelectablePlayers}</span> for{" "}
              {effectiveCourts} court{effectiveCourts === 1 ? "" : "s"}.
            </p>
          </div>
          <Badge variant={atAttendanceCap ? "default" : "secondary"} className="shrink-0 tabular-nums">
            {attendingIds.length} / {maxSelectablePlayers}
          </Badge>
        </div>

        {roster.length > 0 && roster.length < requiredPlayersForSession ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This roster has {roster.length} player{roster.length === 1 ? "" : "s"}; you need {requiredPlayersForSession} to
            fill {effectiveCourts} court{effectiveCourts === 1 ? "" : "s"}. Add roster players or reduce courts.
          </p>
        ) : null}

        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players on this league roster yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((p) => {
              const selected = attendingIds.includes(p.playerId);
              const disabledTile = !selected && atAttendanceCap;
              return (
                <li key={p.playerId}>
                  <button
                    type="button"
                    disabled={disabledTile}
                    aria-pressed={selected}
                    onClick={() => toggleAttend(p.playerId)}
                    className={cn(
                      "relative flex min-h-[4.25rem] w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      selected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/25"
                        : "border-border bg-background hover:border-primary/35 hover:bg-muted/40",
                      !selected && atAttendanceCap && "opacity-60",
                    )}
                  >
                    {selected ? (
                      <Check
                        className="text-primary absolute top-2 right-2 size-4 shrink-0"
                        aria-hidden
                        strokeWidth={2.5}
                      />
                    ) : null}
                    <span className="pr-6 font-medium leading-tight">{p.displayName}</span>
                    {p.username ? (
                      <span className="text-muted-foreground text-xs">@{p.username}</span>
                    ) : p.isGuest ? (
                      <span className="text-muted-foreground text-xs">Guest</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {atAttendanceCap ? (
          <p className="text-muted-foreground text-xs">Maximum reached for this session size. Deselect someone to add a different player.</p>
        ) : null}

        {attendingIds.length > 0 && attendingIds.length < requiredPlayersForSession ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Select {requiredPlayersForSession - attendingIds.length} more player
            {requiredPlayersForSession - attendingIds.length === 1 ? "" : "s"} to fill every court
            {effectiveCourts > 1 ? ` (${effectiveCourts} × 4)` : ""}.
          </p>
        ) : null}
        {attendingIds.length > 0 && attendingIds.length % 2 !== 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Use an even number of players so everyone can be paired.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Build your teams</h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Each team is two players. You need{" "}
              <span className="font-medium text-foreground">{teamsRequired}</span> team
              {teamsRequired === 1 ? "" : "s"} total ({effectiveCourts} court
              {effectiveCourts === 1 ? "" : "s"} × two sides) so every court has a match. Pairs here
              feed straight into results below.
            </p>
          </div>
          <Badge variant={teamsProgress ? "default" : "secondary"} className="shrink-0 tabular-nums">
            {teams.length} / {teamsRequired} teams
          </Badge>
        </div>

        {attendingIds.length < requiredPlayersForSession ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Select everyone who&apos;s playing in the section above ({requiredPlayersForSession} players) before
            building teams.
          </p>
        ) : null}

        <div>
          <Label className="text-base">How do you want to pair them?</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Random is quickest; manual gives you full control if you already know the pairs.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setTeamMode("spin");
                setManualPick(null);
                playerSwapPickRef.current = null;
                setPlayerSwapPick(null);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                "hover:border-primary/40 hover:shadow-md",
                teamMode === "spin"
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/35"
                  : "border-border bg-card ring-foreground/10 ring-1",
              )}
            >
              <span className="font-medium">Shuffle pairs</span>
              <span className="text-muted-foreground text-xs leading-snug">
                Randomly match everyone who&apos;s playing into teams of two.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTeamMode("manual");
                playerSwapPickRef.current = null;
                setPlayerSwapPick(null);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                "hover:border-primary/40 hover:shadow-md",
                teamMode === "manual"
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/35"
                  : "border-border bg-card ring-foreground/10 ring-1",
              )}
            >
              <span className="font-medium">Pick pairs yourself</span>
              <span className="text-muted-foreground text-xs leading-snug">
                Tap two players at a time to form each team—great for set partners or house rules.
              </span>
            </button>
          </div>
        </div>

        {teamMode === "spin" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We&apos;ll shuffle the full attendee list into pairs. Run it again if you want a different draw.
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={attendingIds.length < requiredPlayersForSession}
              onClick={buildSpinTeams}
              className="gap-2"
            >
              <Shuffle className="size-4" aria-hidden />
              Shuffle into teams
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {manualPick ? (
                  <>
                    <span className="font-medium text-foreground">
                      {roster.find((x) => x.playerId === manualPick)?.displayName ?? "Player"}
                    </span>{" "}
                    is selected — tap their partner, or tap them again to cancel.
                  </>
                ) : (
                  <>Tap one player, then tap a second to lock a pair.</>
                )}
              </p>
              {unassigned.length > 0 ? (
                <Badge variant="outline" className="tabular-nums">
                  {unassigned.length} unassigned
                </Badge>
              ) : teams.length > 0 ? (
                <Badge variant="secondary">All assigned</Badge>
              ) : null}
            </div>
            {unassigned.length > 0 ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unassigned.map((id) => {
                  const p = roster.find((x) => x.playerId === id);
                  if (!p) return null;
                  const picked = manualPick === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!manualPick) {
                            setManualPick(id);
                            return;
                          }
                          if (manualPick === id) {
                            setManualPick(null);
                            return;
                          }
                          addManualTeam(manualPick, id);
                          setManualPick(null);
                        }}
                        className={cn(
                          "relative flex min-h-[4rem] w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          picked
                            ? "border-primary bg-primary/10 ring-1 ring-primary/25"
                            : "border-border bg-background hover:border-primary/35 hover:bg-muted/40",
                        )}
                      >
                        {picked ? (
                          <span className="text-primary absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide">
                            First
                          </span>
                        ) : null}
                        <span className="pr-10 font-medium leading-tight">{p.displayName}</span>
                        {p.username ? (
                          <span className="text-muted-foreground text-xs">@{p.username}</span>
                        ) : p.isGuest ? (
                          <span className="text-muted-foreground text-xs">Guest</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : teams.length > 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Everyone who&apos;s playing is on a team. Remove a team below if you want to change a pair.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Select the full player list above, then tap players here to form pairs.
              </p>
            )}
          </div>
        )}

        {teams.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your teams</p>
            <p className="text-sm text-muted-foreground">
              Tap one player, then another to swap them between teams—or tap the same player again to cancel.
            </p>
            <ul className="flex flex-col gap-2">
              {teams.map((pair, idx) => {
                const pA = roster.find((r) => r.playerId === pair[0])!;
                const pB = roster.find((r) => r.playerId === pair[1])!;
                const chipSelected = (slot: 0 | 1) =>
                  playerSwapPick?.teamIdx === idx && playerSwapPick.slot === slot;
                return (
                  <li
                    key={`${pair[0]}-${pair[1]}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-muted-foreground text-xs font-medium">Team {idx + 1}</p>
                      <p className="text-muted-foreground text-[11px] leading-snug">
                        Model avg Lv{" "}
                        {formatDisplayLevel(
                          averageTeamSkill([pair[0], pair[1]], skillsByPlayerId),
                        )}
                        {inputMode === "champ_court_only" &&
                        champExpectedShares[idx] !== undefined ? (
                          <>
                            {" "}
                            · Exp Win (levels):{" "}
                            <span
                              className="font-medium text-foreground"
                              title="Expected share of court-1 wins for this pair vs all pairs here (softmax from padel levels)—not actual win %."
                            >
                              {formatPercent(champExpectedShares[idx]!, 1)}
                            </span>
                          </>
                        ) : null}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-pressed={chipSelected(0)}
                          aria-label={`Swap slot: ${pA.displayName}, team ${idx + 1}`}
                          onClick={() => handlePlayerChipClick(idx, 0)}
                          className={cn(
                            "min-w-0 max-w-full rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            "disabled:pointer-events-none disabled:opacity-50",
                            chipSelected(0)
                              ? "border-primary bg-primary/15 ring-1 ring-primary/30"
                              : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <span className="font-medium leading-snug">{pA.displayName}</span>
                          {pA.username ? (
                            <span className="text-muted-foreground block text-xs">@{pA.username}</span>
                          ) : pA.isGuest ? (
                            <span className="text-muted-foreground block text-xs">Guest</span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          aria-pressed={chipSelected(1)}
                          aria-label={`Swap slot: ${pB.displayName}, team ${idx + 1}`}
                          onClick={() => handlePlayerChipClick(idx, 1)}
                          className={cn(
                            "min-w-0 max-w-full rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            "disabled:pointer-events-none disabled:opacity-50",
                            chipSelected(1)
                              ? "border-primary bg-primary/15 ring-1 ring-primary/30"
                              : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <span className="font-medium leading-snug">{pB.displayName}</span>
                          {pB.username ? (
                            <span className="text-muted-foreground block text-xs">@{pB.username}</span>
                          ) : pB.isGuest ? (
                            <span className="text-muted-foreground block text-xs">Guest</span>
                          ) : null}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeTeam(idx)}
                      aria-label={`Remove team ${idx + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {teams.length > 0 && teams.length < teamsRequired ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Add {teamsRequired - teams.length} more team{teamsRequired - teams.length === 1 ? "" : "s"} (shuffle
            again or pair remaining players) before saving.
          </p>
        ) : null}

        <Button type="button" disabled={pending} onClick={onSaveTeams} className="w-fit">
          Save teams &amp; set up courts
        </Button>
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Match results</h2>
          {inputMode === "champ_court_only" ? (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              For each team, enter how many times they won on <span className="font-medium text-foreground">court 1</span>{" "}
              only. Wins on other courts are not stored. No scores needed. Each pair shows{" "}
              <span className="font-medium text-foreground">Exp Win (levels)</span>—how much of the session&apos;s
              court‑1 wins we&apos;d expect for that pair vs the others (softmax—not head‑to‑head).
            </p>
          ) : (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Log each game you want on the leaderboard. The same two teams can play again—add another row. Include
              at least one game per court ({effectiveCourts} court{effectiveCourts === 1 ? "" : "s"}); extras can be
              rematches or pickup games. Side odds use your global padel levels (team Elo-style model).
            </p>
          )}
        </div>

        {inputMode === "champ_court_only" ? (
          champCourt1WinsStr.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Save teams above to enter court 1 wins for each pair.
            </p>
          ) : (
            <>
              {champSessionLeaders && champSessionLeaders.maxW > 0 ? (
                <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    Session leader{champSessionLeaders.labels.length === 1 ? "" : "s"} (court 1 wins)
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {champSessionLeaders.labels.join(" · ")} — {champSessionLeaders.maxW} win
                    {champSessionLeaders.maxW === 1 ? "" : "s"}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Enter at least one win on court 1 for a team before completing the session.
                </p>
              )}

              <ul className="flex flex-col gap-3">
                {teams.map((pair, idx) => {
                  const pA = roster.find((r) => r.playerId === pair[0])!;
                  const pB = roster.find((r) => r.playerId === pair[1])!;
                  return (
                    <li
                      key={`${pair[0]}-${pair[1]}-${idx}`}
                      className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/80 bg-muted/15 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs font-medium">Team {idx + 1}</p>
                        <p className="mt-1 font-medium">
                          {pA.displayName} · {pB.displayName}
                        </p>
                        {champExpectedShares[idx] !== undefined ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Exp Win (levels):{" "}
                            <span className="font-medium text-foreground">
                              {formatPercent(champExpectedShares[idx]!, 1)}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="grid w-full gap-1 sm:w-40">
                        <Label className="text-xs" htmlFor={`c1w-${idx}`}>
                          Wins on court 1
                        </Label>
                        <Input
                          id={`c1w-${idx}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={champCourt1WinsStr[idx] ?? "0"}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            setChampCourt1WinsStr((prev) => {
                              const next = [...prev];
                              next[idx] = v;
                              return next;
                            });
                          }}
                          onBlur={() => {
                            setChampCourt1WinsStr((prev) => {
                              const next = [...prev];
                              next[idx] = String(parseCourt1Wins(next[idx] ?? "0"));
                              return next;
                            });
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" disabled={pending} onClick={onSaveGames}>
                  Save results
                </Button>
                {!isCompletedSession ? (
                  <Button type="button" disabled={pending} onClick={onComplete}>
                    Complete session
                  </Button>
                ) : null}
              </div>
            </>
          )
        ) : gameRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Save teams above to start entering scores. You can add more games anytime.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {gameRows.length} game{gameRows.length === 1 ? "" : "s"} recorded
                {missingCourtsMessage.length > 0
                  ? ` · Still need court${missingCourtsMessage.length === 1 ? "" : "s"}: ${missingCourtsMessage.join(", ")}`
                  : " · All courts have at least one game"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addGameRow}
              >
                <Plus className="size-4" aria-hidden />
                Add game
              </Button>
            </div>

            {missingCourtsMessage.length > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Before completing, add at least one result for court{missingCourtsMessage.length === 1 ? "" : "s"}{" "}
                {missingCourtsMessage.join(", ")} (or change a game&apos;s court below).
              </p>
            ) : null}

            <ul className="flex flex-col gap-4">
              {gameRows.map((row, idx) => {
                const pA = teams[row.teamAIdx]
                  ? teams[row.teamAIdx]!.map((id) => roster.find((r) => r.playerId === id)!)
                  : null;
                const pB = teams[row.teamBIdx]
                  ? teams[row.teamBIdx]!.map((id) => roster.find((r) => r.playerId === id)!)
                  : null;
                const labelA = pA?.map((p) => p.displayName).join(" · ") ?? `Team ${row.teamAIdx + 1}`;
                const labelB = pB?.map((p) => p.displayName).join(" · ") ?? `Team ${row.teamBIdx + 1}`;
                const winEst =
                  teams[row.teamAIdx] && teams[row.teamBIdx]
                    ? expectedWinForSides(
                        teams[row.teamAIdx]!,
                        teams[row.teamBIdx]!,
                        skillsByPlayerId,
                      )
                    : null;
                return (
                  <li
                    key={idx}
                    className="rounded-xl border border-border/80 bg-muted/15 p-4 shadow-sm ring-1 ring-foreground/5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Game {idx + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeGameRow(idx)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="mb-4 grid gap-2 sm:max-w-xs">
                      <Label className="text-xs">Court</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={row.courtNumber}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setGameRows((r) => {
                            const n = [...r];
                            n[idx] = { ...n[idx]!, courtNumber: v };
                            return n;
                          });
                        }}
                      >
                        {Array.from({ length: effectiveCourts }, (_, i) => i + 1).map((c) => (
                          <option key={c} value={c}>
                            Court {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {winEst ? (
                      <p className="mb-3 text-muted-foreground text-xs">
                        Side odds (padel levels): A {formatPercent(winEst.teamA, 0)} · B{" "}
                        {formatPercent(winEst.teamB, 0)}
                      </p>
                    ) : null}

                    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Side A</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={row.teamAIdx}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setGameRows((r) => {
                              const next = [...r];
                              next[idx] = { ...next[idx]!, teamAIdx: v };
                              return next;
                            });
                          }}
                        >
                          {teams.map((_, i) => (
                            <option key={i} value={i}>
                              Team {i + 1}
                              {teams[i]
                                ? ` (${teams[i]!.map((id) => roster.find((r) => r.playerId === id)?.displayName ?? "").filter(Boolean).join(" · ")})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-center pb-2 sm:pb-0">
                        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          vs
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Side B</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={row.teamBIdx}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setGameRows((r) => {
                              const next = [...r];
                              next[idx] = { ...next[idx]!, teamBIdx: v };
                              return next;
                            });
                          }}
                        >
                          {teams.map((_, i) => (
                            <option key={i} value={i}>
                              Team {i + 1}
                              {teams[i]
                                ? ` (${teams[i]!.map((id) => roster.find((r) => r.playerId === id)?.displayName ?? "").filter(Boolean).join(" · ")})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-3 text-center text-xs sm:hidden">
                      {labelA} vs {labelB}
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Score A</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={row.scoreAStr}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            setGameRows((r) => {
                              const n = [...r];
                              n[idx] = { ...n[idx]!, scoreAStr: v };
                              return n;
                            });
                          }}
                          onBlur={() => {
                            setGameRows((r) => {
                              const n = [...r];
                              const cur = n[idx]!;
                              n[idx] = {
                                ...cur,
                                scoreAStr: normalizeScoreBlur(cur.scoreAStr),
                              };
                              return n;
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Score B</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={row.scoreBStr}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            setGameRows((r) => {
                              const n = [...r];
                              n[idx] = { ...n[idx]!, scoreBStr: v };
                              return n;
                            });
                          }}
                          onBlur={() => {
                            setGameRows((r) => {
                              const n = [...r];
                              const cur = n[idx]!;
                              n[idx] = {
                                ...cur,
                                scoreBStr: normalizeScoreBlur(cur.scoreBStr),
                              };
                              return n;
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:max-w-md">
                      <Label className="text-xs">Winner</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={row.winner}
                        onChange={(e) => {
                          const v = e.target.value as "team_a" | "team_b";
                          setGameRows((r) => {
                            const n = [...r];
                            n[idx] = { ...n[idx]!, winner: v };
                            return n;
                          });
                        }}
                      >
                        <option value="team_a">Side A ({labelA})</option>
                        <option value="team_b">Side B ({labelB})</option>
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={pending} onClick={onSaveGames}>
                Save results
              </Button>
              {!isCompletedSession ? (
                <Button type="button" disabled={pending} onClick={onComplete}>
                  Complete session
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
