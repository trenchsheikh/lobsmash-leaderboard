"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeSession } from "@/app/actions/sessions";
import {
  replaceSessionCourt1PairWins,
  replaceSessionGames,
  saveNewSessionDraft,
  updateSessionDraftMeta,
  upsertSessionTeams,
  type Court1PairWinInput,
  type InputMode,
  type GameRowInput,
} from "@/app/actions/session-wizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  averageTeamSkill,
  expectedChampShares,
  expectedWinForSides,
  formatDisplayLevel,
  formatPercent,
  skillForPlayer,
} from "@/lib/rating";
import {
  MAX_SESSION_COURTS,
  MIN_SESSION_COURTS,
  SESSION_GAME_COURT_RADIO_MAX,
} from "@/lib/session-courts";
import { Check, Plus, Shuffle, Trash2 } from "lucide-react";

export type RosterPlayer = {
  playerId: string;
  displayName: string;
  username: string | null;
  isGuest: boolean;
};

function clampCourts(n: number): number {
  return Math.min(MAX_SESSION_COURTS, Math.max(MIN_SESSION_COURTS, Math.round(n)));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function truncateLabel(s: string, max = 56): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type GameRowState = {
  courtNumber: number;
  teamAIdx: number;
  teamBIdx: number;
  scoreAStr: string;
  scoreBStr: string;
  winner: "team_a" | "team_b";
};

function serializeEphemeralDraftSnapshot(input: {
  date: string;
  courtsInput: string;
  attendingIds: string[];
  teams: [string, string][];
  gameRows: GameRowState[];
  champCourt1WinsStr: string[];
  teamMode: "spin" | "manual";
  manualPick: string | null;
  playerSwapPick: { teamIdx: number; slot: 0 | 1 } | null;
}) {
  const teamsNorm = input.teams
    .map(([a, b]) => (a < b ? ([a, b] as [string, string]) : ([b, a] as [string, string])))
    .sort((x, y) => `${x[0]}\0${x[1]}`.localeCompare(`${y[0]}\0${y[1]}`));
  return JSON.stringify({
    date: input.date,
    courtsInput: input.courtsInput,
    attendingIds: [...input.attendingIds].sort(),
    teams: teamsNorm,
    gameRows: input.gameRows,
    champCourt1WinsStr: input.champCourt1WinsStr,
    teamMode: input.teamMode,
    manualPick: input.manualPick,
    playerSwapPick: input.playerSwapPick,
  });
}

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
  onFirstDraftSaved,
  onDraftDirtyChange,
}: {
  leagueId: string;
  /** `null` on /sessions/new until Save draft; then navigate to edit with a real id. */
  sessionId: string | null;
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
  /** When set and `sessionId` is null, first successful Save draft calls this instead of navigating to the editor. */
  onFirstDraftSaved?: (payload: { sessionId: string; date: string }) => void;
  /** When `sessionId` is null, reports whether the ephemeral draft differs from the post-mount baseline. */
  onDraftDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const isCompletedSession = sessionCompletionStatus === "completed";
  const hasPersistedSession = sessionId !== null;
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(
    () => initialDate ?? new Date().toISOString().slice(0, 10),
  );
  const [committedNumCourts, setCommittedNumCourts] = useState(() =>
    clampCourts(initialNumCourts ?? defaultCourts),
  );
  const [courtsInput, setCourtsInput] = useState(() =>
    String(clampCourts(initialNumCourts ?? defaultCourts)),
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

  const numCourts = useMemo(() => {
    const t = courtsInput.trim();
    if (t === "") return committedNumCourts;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n)) return committedNumCourts;
    return clampCourts(n);
  }, [courtsInput, committedNumCourts]);

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
    const id = requestAnimationFrame(() => {
      setGameRows((rows) => {
        let changed = false;
        const next = rows.map((r) => {
          const c = Math.min(r.courtNumber, effectiveCourts);
          if (c !== r.courtNumber) changed = true;
          return { ...r, courtNumber: c };
        });
        return changed ? next : rows;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [effectiveCourts]);

  useEffect(() => {
    const allowed = new Set(attendingIds);
    setTeams((prev) => prev.filter(([a, b]) => allowed.has(a) && allowed.has(b)));
  }, [attendingIds]);

  useEffect(() => {
    const v = clampCourts(initialNumCourts ?? defaultCourts);
    setCourtsInput(String(v));
    setCommittedNumCourts(v);
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

  const ephemeralDraftSnapshotRef = useRef<string | null>(null);
  const [ephemeralDirtyBaselineReady, setEphemeralDirtyBaselineReady] = useState(false);

  useEffect(() => {
    if (!onDraftDirtyChange || hasPersistedSession) {
      ephemeralDraftSnapshotRef.current = null;
      setEphemeralDirtyBaselineReady(false);
      onDraftDirtyChange?.(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      setEphemeralDirtyBaselineReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [onDraftDirtyChange, hasPersistedSession]);

  useEffect(() => {
    if (!onDraftDirtyChange || hasPersistedSession) return;
    if (!ephemeralDirtyBaselineReady) return;
    const s = serializeEphemeralDraftSnapshot({
      date,
      courtsInput,
      attendingIds,
      teams,
      gameRows,
      champCourt1WinsStr,
      teamMode,
      manualPick,
      playerSwapPick,
    });
    if (ephemeralDraftSnapshotRef.current === null) {
      ephemeralDraftSnapshotRef.current = s;
      onDraftDirtyChange(false);
      return;
    }
    onDraftDirtyChange(s !== ephemeralDraftSnapshotRef.current);
  }, [
    ephemeralDirtyBaselineReady,
    onDraftDirtyChange,
    hasPersistedSession,
    date,
    courtsInput,
    attendingIds,
    teams,
    gameRows,
    champCourt1WinsStr,
    teamMode,
    manualPick,
    playerSwapPick,
  ]);

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

  function applyLocalPostSaveTeamsLayout() {
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
    if (!hasPersistedSession) {
      applyLocalPostSaveTeamsLayout();
      toast.success("Teams saved locally — use Save draft to store.");
      return;
    }
    startTransition(async () => {
      const res = await upsertSessionTeams(leagueId, sessionId!, payload);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      applyLocalPostSaveTeamsLayout();
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
    if (!sessionId) {
      return { error: "Save draft first." };
    }
    const sid = sessionId;
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
    const teamRes = await upsertSessionTeams(leagueId, sid, teamPayload);
    if ("error" in teamRes && teamRes.error) {
      return { error: teamRes.error };
    }
    const res = await replaceSessionCourt1PairWins(leagueId, sid, rows);
    if ("error" in res && res.error) {
      return { error: res.error };
    }
    return {};
  }

  function buildGamesForDraft(): GameRowInput[] | null {
    if (inputMode === "champ_court_only") return null;
    const teamList = teams;
    const games: GameRowInput[] = [];
    for (let i = 0; i < gameRows.length; i++) {
      const row = gameRows[i]!;
      const ta = teamList[row.teamAIdx];
      const tb = teamList[row.teamBIdx];
      if (!ta || !tb) continue;
      if (row.teamAIdx === row.teamBIdx) continue;
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
    return games.length > 0 ? games : null;
  }

  function buildCourt1ForDraft(): Court1PairWinInput[] | null {
    if (inputMode !== "champ_court_only") return null;
    if (teams.length === 0) return null;
    return teams.map(([playerA, playerB], i) => ({
      playerA,
      playerB,
      wins: parseCourt1Wins(champCourt1WinsStr[i] ?? "0"),
    }));
  }

  function onSaveDraft() {
    startTransition(async () => {
      const res = await saveNewSessionDraft(leagueId, {
        date,
        numCourts: effectiveCourts,
        teams: teams.map(([playerA, playerB]) => ({ playerA, playerB })),
        games: buildGamesForDraft(),
        court1Rows: buildCourt1ForDraft(),
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("sessionId" in res && res.sessionId) {
        if (onFirstDraftSaved) {
          onFirstDraftSaved({ sessionId: res.sessionId, date });
          return;
        }
        router.push(`/leagues/${leagueId}/sessions/${res.sessionId}/edit`);
      }
    });
  }

  function onSaveGames() {
    if (inputMode === "champ_court_only") {
      if (!hasPersistedSession) {
        if (teams.length < teamsRequired) {
          toast.error(`Save teams first (need enough pairs for every court).`);
          return;
        }
        if (champCourt1WinsStr.length !== teams.length) {
          toast.error("Court 1 wins are out of sync with teams — save teams again.");
          return;
        }
        toast.success("Court 1 results saved locally — use Save draft to store.");
        return;
      }
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

    if (!hasPersistedSession) {
      toast.success("Results saved locally — use Save draft to store.");
      return;
    }

    startTransition(async () => {
      const res = await replaceSessionGames(leagueId, sessionId!, games, {
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
    if (!sessionId) {
      toast.error("Save draft first to create this session.");
      return;
    }
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

  function setCourtsCount(next: number) {
    const clamped = clampCourts(next);
    setCourtsInput(String(clamped));
    setCommittedNumCourts(clamped);
    setGameRows((rows) =>
      rows.map((r) => ({
        ...r,
        courtNumber: Math.min(r.courtNumber, clamped),
      })),
    );
    if (!sessionId) return;
    startTransition(async () => {
      const res = await updateSessionDraftMeta(leagueId, sessionId, {
        date,
        numCourts: clamped,
      });
      if ("error" in res && res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {isCompletedSession ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This session is <span className="font-medium text-foreground">complete</span>. Saving still updates
          standings and padel levels for players here.
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
              if (!sessionId) return;
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
              Results mode: <span className="font-medium text-foreground">scores per court</span> (set when the
              league was created).
            </>
          ) : (
            <>
              Results mode: <span className="font-medium text-foreground">court 1 wins only</span> (set when the
              league was created).
            </>
          )}
        </p>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Courts in play</legend>
          <div className="flex max-w-[12rem] flex-col gap-2">
            <Label htmlFor="sess-courts-count" className="sr-only">
              Number of courts
            </Label>
            <Input
              id="sess-courts-count"
              type="number"
              min={MIN_SESSION_COURTS}
              max={MAX_SESSION_COURTS}
              step={1}
              inputMode="numeric"
              autoComplete="off"
              value={courtsInput}
              onChange={(e) => setCourtsInput(e.target.value)}
              onBlur={() => {
                const t = courtsInput.trim();
                const parsed =
                  t === "" ? committedNumCourts : clampCourts(parseInt(t, 10) || committedNumCourts);
                setCourtsCount(parsed);
              }}
              aria-describedby="sess-courts-hint"
            />
            <p id="sess-courts-hint" className="text-muted-foreground text-xs">
              How many courts for this session ({MIN_SESSION_COURTS}–{MAX_SESSION_COURTS}).
            </p>
          </div>
          {inputMode === "champ_court_only" ? (
            <p className="text-muted-foreground text-xs">
              Roster size follows this count (4 players per court). Only wins on <span className="font-medium text-foreground">court 1</span> count toward stats.
            </p>
          ) : null}
        </fieldset>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Who&apos;s playing?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap to include. Up to{" "}
              <span className="font-medium text-foreground">{maxSelectablePlayers}</span> players (
              {effectiveCourts} court{effectiveCourts === 1 ? "" : "s"} × 4).
            </p>
          </div>
          <Badge variant={atAttendanceCap ? "default" : "secondary"} className="shrink-0 tabular-nums">
            {attendingIds.length} / {maxSelectablePlayers}
          </Badge>
        </div>

        {roster.length > 0 && roster.length < requiredPlayersForSession ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Roster has {roster.length} player{roster.length === 1 ? "" : "s"}; need {requiredPlayersForSession} for{" "}
            {effectiveCourts} court{effectiveCourts === 1 ? "" : "s"}. Add players or lower the court count.
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
          <p className="text-muted-foreground text-xs">Cap reached—deselect someone to swap in another player.</p>
        ) : null}

        {attendingIds.length > 0 && attendingIds.length < requiredPlayersForSession ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Pick {requiredPlayersForSession - attendingIds.length} more to fill all courts.
          </p>
        ) : null}
        {attendingIds.length > 0 && attendingIds.length % 2 !== 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">Player count must be even to form pairs.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-5 border-t border-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Build your teams</h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Two players per team. Need{" "}
              <span className="font-medium text-foreground">{teamsRequired}</span> teams for{" "}
              {effectiveCourts} court{effectiveCourts === 1 ? "" : "s"}. These pairs are used for results below.
            </p>
          </div>
          <Badge variant={teamsProgress ? "default" : "secondary"} className="shrink-0 tabular-nums">
            {teams.length} / {teamsRequired} teams
          </Badge>
        </div>

        {attendingIds.length < requiredPlayersForSession ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Finish selecting players above ({requiredPlayersForSession} total) before building teams.
          </p>
        ) : null}

        <div>
          <Label className="text-base">Pair players</Label>
          <p className="mt-1 text-sm text-muted-foreground">Shuffle for speed, or pick pairs yourself.</p>
          <RadioGroup
            value={teamMode}
            onValueChange={(v) => {
              const mode = v as "spin" | "manual";
              setTeamMode(mode);
              setManualPick(null);
              playerSwapPickRef.current = null;
              setPlayerSwapPick(null);
            }}
            className="mt-3 grid w-full gap-3 sm:grid-cols-2"
            name="team-pair-mode"
          >
            <Label
              htmlFor="team-mode-spin"
              className={cn(
                "cursor-pointer rounded-xl border px-4 py-3 text-left text-sm transition-all",
                "focus-within:ring-2 focus-within:ring-ring",
                "hover:border-primary/40 hover:shadow-md",
                teamMode === "spin"
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/35"
                  : "border-border bg-card ring-1 ring-foreground/10",
              )}
            >
              <span className="flex items-start gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">Shuffle pairs</span>
                  <span className="text-muted-foreground text-xs leading-snug">Random teams of two.</span>
                </span>
                <RadioGroupItem value="spin" id="team-mode-spin" className="mt-0.5 shrink-0" />
              </span>
            </Label>
            <Label
              htmlFor="team-mode-manual"
              className={cn(
                "cursor-pointer rounded-xl border px-4 py-3 text-left text-sm transition-all",
                "focus-within:ring-2 focus-within:ring-ring",
                "hover:border-primary/40 hover:shadow-md",
                teamMode === "manual"
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/35"
                  : "border-border bg-card ring-1 ring-foreground/10",
              )}
            >
              <span className="flex items-start gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">Pick pairs yourself</span>
                  <span className="text-muted-foreground text-xs leading-snug">
                    Tap two players to form each team.
                  </span>
                </span>
                <RadioGroupItem value="manual" id="team-mode-manual" className="mt-0.5 shrink-0" />
              </span>
            </Label>
          </RadioGroup>
        </div>

        {teamMode === "spin" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Shuffle again anytime for a new draw.</p>
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
                    — tap partner, or tap again to cancel.
                  </>
                ) : (
                  <>Tap a player, then their partner.</>
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
                All set. Remove a team below to change a pair.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Select everyone above, then pair players here.</p>
            )}
          </div>
        )}

        {teams.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your teams</p>
            <p className="text-sm text-muted-foreground">Tap two players to swap between teams; same player again cancels.</p>
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
            Add {teamsRequired - teams.length} more team{teamsRequired - teams.length === 1 ? "" : "s"} before saving.
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
              Enter <span className="font-medium text-foreground">court 1</span> wins per team only (no scores).
              <span className="font-medium text-foreground"> Exp Win</span> is an expected share from padel levels vs
              all pairs here—not a head‑to‑head %.
            </p>
          ) : (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Add each game for the leaderboard (rematches = extra rows). Need at least one game per court (
              {effectiveCourts}). Side odds use global padel levels.
            </p>
          )}
        </div>

        {inputMode === "champ_court_only" ? (
          champCourt1WinsStr.length === 0 ? (
            <p className="text-sm text-muted-foreground">Save teams above to enter court 1 wins.</p>
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
                <p className="text-muted-foreground text-xs">Add at least one court 1 win before completing.</p>
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
          <p className="text-sm text-muted-foreground">Save teams above, then add games here.</p>
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
                Add a result for court{missingCourtsMessage.length === 1 ? "" : "s"} {missingCourtsMessage.join(", ")}
                before completing (or change court on a row below).
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

                    <div className="mb-4 space-y-2">
                      <Label className="text-xs font-medium" htmlFor={`game-${idx}-court`} id={`game-${idx}-court-legend`}>
                        Court
                      </Label>
                      {effectiveCourts > SESSION_GAME_COURT_RADIO_MAX ? (
                        <select
                          id={`game-${idx}-court`}
                          className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
                          value={row.courtNumber}
                          onChange={(e) => {
                            const courtNum = parseInt(e.target.value, 10);
                            setGameRows((r) => {
                              const n = [...r];
                              n[idx] = { ...n[idx]!, courtNumber: courtNum };
                              return n;
                            });
                          }}
                          aria-labelledby={`game-${idx}-court-legend`}
                        >
                          {Array.from({ length: effectiveCourts }, (_, i) => i + 1).map((c) => (
                            <option key={c} value={c}>
                              Court {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <RadioGroup
                          value={String(row.courtNumber)}
                          onValueChange={(v) => {
                            const courtNum = parseInt(v, 10);
                            setGameRows((r) => {
                              const n = [...r];
                              n[idx] = { ...n[idx]!, courtNumber: courtNum };
                              return n;
                            });
                          }}
                          className="flex w-full flex-wrap gap-x-4 gap-y-2"
                          name={`game-${idx}-court`}
                          aria-labelledby={`game-${idx}-court-legend`}
                        >
                          {Array.from({ length: effectiveCourts }, (_, i) => i + 1).map((c) => {
                            const cid = `game-${idx}-court-${c}`;
                            return (
                              <div key={c} className="flex items-center gap-2">
                                <RadioGroupItem value={String(c)} id={cid} />
                                <Label htmlFor={cid} className="text-xs font-normal">
                                  {c}
                                </Label>
                              </div>
                            );
                          })}
                        </RadioGroup>
                      )}
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

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium" id={`game-${idx}-winner-legend`}>
                        Winner
                      </p>
                      <RadioGroup
                        value={row.winner}
                        onValueChange={(v) => {
                          const w = v as "team_a" | "team_b";
                          setGameRows((r) => {
                            const n = [...r];
                            n[idx] = { ...n[idx]!, winner: w };
                            return n;
                          });
                        }}
                        className="grid w-full gap-2 sm:max-w-md"
                        name={`game-${idx}-winner`}
                        aria-labelledby={`game-${idx}-winner-legend`}
                      >
                        <Label
                          htmlFor={`game-${idx}-winner-a`}
                          className={cn(
                            "cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            "focus-within:ring-2 focus-within:ring-ring",
                            row.winner === "team_a"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                              : "border-border bg-background hover:border-primary/35",
                          )}
                        >
                          <span className="flex items-start gap-3">
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-xs font-medium">Side A</span>
                              <span
                                className="text-muted-foreground line-clamp-2 text-xs leading-snug"
                                title={labelA}
                              >
                                {truncateLabel(labelA)}
                              </span>
                            </span>
                            <RadioGroupItem value="team_a" id={`game-${idx}-winner-a`} className="mt-0.5 shrink-0" />
                          </span>
                        </Label>
                        <Label
                          htmlFor={`game-${idx}-winner-b`}
                          className={cn(
                            "cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            "focus-within:ring-2 focus-within:ring-ring",
                            row.winner === "team_b"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                              : "border-border bg-background hover:border-primary/35",
                          )}
                        >
                          <span className="flex items-start gap-3">
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-xs font-medium">Side B</span>
                              <span
                                className="text-muted-foreground line-clamp-2 text-xs leading-snug"
                                title={labelB}
                              >
                                {truncateLabel(labelB)}
                              </span>
                            </span>
                            <RadioGroupItem value="team_b" id={`game-${idx}-winner-b`} className="mt-0.5 shrink-0" />
                          </span>
                        </Label>
                      </RadioGroup>
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

      {!hasPersistedSession ? (
        <footer className="mt-2 border-t border-border pt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Save a draft and finish later from this league.</p>
            <Button type="button" disabled={pending} onClick={onSaveDraft} className="w-full shrink-0 sm:w-auto">
              {pending ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
