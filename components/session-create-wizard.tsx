"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  completeSession,
} from "@/app/actions/sessions";
import {
  createSessionDraft,
  replaceSessionGames,
  upsertSessionTeams,
  type InputMode,
  type GameRowInput,
} from "@/app/actions/session-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type RosterPlayer = {
  playerId: string;
  displayName: string;
  username: string | null;
  isGuest: boolean;
};

type Step = "meta" | "attendance" | "teams" | "results";

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

export function SessionCreateWizard({
  leagueId,
  defaultCourts,
  roster,
}: {
  leagueId: string;
  defaultCourts: number;
  roster: RosterPlayer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("meta");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [numCourts, setNumCourts] = useState(defaultCourts);
  const [inputMode, setInputMode] = useState<InputMode>("full");

  const [attendingIds, setAttendingIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<[string, string][]>([]);
  const [teamMode, setTeamMode] = useState<"spin" | "manual">("spin");
  const [manualPick, setManualPick] = useState<string | null>(null);

  const [courtRows, setCourtRows] = useState<
    {
      teamAIdx: number;
      teamBIdx: number;
      teamAScore: number;
      teamBScore: number;
      winner: "team_a" | "team_b";
    }[]
  >([]);

  const effectiveCourts = inputMode === "champ_court_only" ? 1 : numCourts;

  function toggleAttend(id: string) {
    setAttendingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function buildSpinTeams() {
    if (attendingIds.length < 4 || attendingIds.length % 2 !== 0) {
      toast.error("Need at least 4 attending players and an even count.");
      return;
    }
    const order = shuffle(attendingIds);
    const pairs: [string, string][] = [];
    for (let i = 0; i < order.length; i += 2) {
      pairs.push([order[i]!, order[i + 1]!]);
    }
    setTeams(pairs);
  }

  function addManualTeam(a: string, b: string) {
    if (a === b) return;
    const used = new Set(teams.flat());
    if (used.has(a) || used.has(b)) return;
    setTeams((t) => [...t, [a, b]]);
  }

  function removeTeam(idx: number) {
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

  async function onMetaNext() {
    const nc = inputMode === "champ_court_only" ? 1 : numCourts;
    startTransition(async () => {
      const res = await createSessionDraft(leagueId, {
        date,
        numCourts: nc,
        inputMode,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("sessionId" in res && res.sessionId) {
        setSessionId(res.sessionId);
        setStep("attendance");
        router.refresh();
      }
    });
  }

  async function onTeamsNext() {
    if (!sessionId) return;
    if (teams.length === 0) {
      toast.error("Create at least one team.");
      return;
    }
    const nCourts = inputMode === "champ_court_only" ? 1 : numCourts;
    if (teams.length < nCourts * 2) {
      toast.error(
        `Need at least ${nCourts * 2} teams for ${nCourts} court${nCourts === 1 ? "" : "s"} (${nCourts * 2} pairs of players).`,
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
      setCourtRows(
        Array.from({ length: nCourts }, (_, i) => ({
          teamAIdx: i * 2,
          teamBIdx: i * 2 + 1,
          teamAScore: 6,
          teamBScore: 4,
          winner: "team_a" as const,
        })),
      );
      setStep("results");
      router.refresh();
    });
  }

  async function onSaveGames() {
    if (!sessionId) return;
    const teamList = teams;
    const games: GameRowInput[] = [];

    for (let i = 0; i < courtRows.length; i++) {
      const row = courtRows[i]!;
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
      games.push({
        courtNumber: i + 1,
        teamAPlayers: [ta[0], ta[1]],
        teamBPlayers: [tb[0], tb[1]],
        teamAScore: row.teamAScore,
        teamBScore: row.teamBScore,
        winner: row.winner,
      });
    }

    startTransition(async () => {
      const res = await replaceSessionGames(leagueId, sessionId, games, {
        numCourts: effectiveCourts,
        inputMode,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Results saved");
      router.refresh();
    });
  }

  async function onComplete() {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await completeSession(leagueId, sessionId, {
        numCourts: effectiveCourts,
        inputMode,
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

  return (
    <div className="flex flex-col gap-6">
      <div className="text-xs text-muted-foreground">
        Step{" "}
        {step === "meta"
          ? "1"
          : step === "attendance"
            ? "2"
            : step === "teams"
              ? "3"
              : "4"}{" "}
        / 4
      </div>

      {step === "meta" ? (
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="sess-date">Session date</Label>
            <Input
              id="sess-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Input mode</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={inputMode}
              onChange={(e) =>
                setInputMode(e.target.value as InputMode)
              }
            >
              <option value="full">Full results (all courts)</option>
              <option value="champ_court_only">Champ court only (court 1)</option>
            </select>
          </div>
          {inputMode === "full" ? (
            <div className="space-y-2">
              <Label htmlFor="sess-courts">Courts (1–12)</Label>
              <Input
                id="sess-courts"
                type="number"
                min={1}
                max={12}
                value={numCourts}
                onChange={(e) => setNumCourts(Number(e.target.value))}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              One court (court 1). Enter the winners for the champ match only.
            </p>
          )}
          <Button type="button" disabled={pending} onClick={onMetaNext}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === "attendance" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Who is playing?</p>
          <ul className="flex flex-col gap-2">
            {roster.map((p) => (
              <li key={p.playerId}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={attendingIds.includes(p.playerId)}
                    onChange={() => toggleAttend(p.playerId)}
                    className="size-4 rounded border-input"
                  />
                  <span>{labelForPlayer(p)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={attendingIds.length < 4}
              onClick={() => setStep("teams")}
            >
              Next
            </Button>
          </div>
          {attendingIds.length > 0 && attendingIds.length < 4 ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Pick at least 4 players for 2v2 sessions.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "teams" ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={teamMode === "spin" ? "default" : "outline"}
              size="sm"
              onClick={() => setTeamMode("spin")}
            >
              Spin the wheel
            </Button>
            <Button
              type="button"
              variant={teamMode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setTeamMode("manual")}
            >
              Manual pairs
            </Button>
          </div>

          {teamMode === "spin" ? (
            <Button type="button" variant="secondary" onClick={buildSpinTeams}>
              Randomize balanced pairs
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Tap two players to pair. Remaining: {unassigned.join(", ") || "none"}
              </p>
              <div className="flex flex-wrap gap-1">
                {unassigned.map((id) => {
                  const p = roster.find((x) => x.playerId === id);
                  if (!p) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        manualPick === id ? "border-primary bg-primary/10" : "border-border",
                      )}
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
                    >
                      {labelForPlayer(p)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {teams.map((pair, idx) => (
              <li
                key={`${pair[0]}-${pair[1]}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 px-3 py-2 text-sm"
              >
                <span>
                  Team {idx + 1}: {pair.map((id) => labelForPlayer(roster.find((r) => r.playerId === id)!)).join(" · ")}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeTeam(idx)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>

          {teams.length >= 2 ? (
            <p className="text-xs text-muted-foreground">
              Swap: pick two teams and use controls (team 1 slot A ↔ team 2 slot A).
            </p>
          ) : null}
          {teams.length >= 2 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => swapPlayers(0, 0, 1, 0)}
              >
                Swap T1a ↔ T2a
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => swapPlayers(0, 1, 1, 1)}
              >
                Swap T1b ↔ T2b
              </Button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("attendance")}>
              Back
            </Button>
            <Button type="button" disabled={pending} onClick={onTeamsNext}>
              Save teams & continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === "results" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {effectiveCourts} court{effectiveCourts === 1 ? "" : "s"} — assign teams and scores.
          </p>
          {courtRows.map((row, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-md border border-border/80 p-3"
            >
              <p className="text-sm font-medium">Court {idx + 1}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Team A</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={row.teamAIdx}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCourtRows((r) => {
                        const n = [...r];
                        n[idx] = { ...n[idx]!, teamAIdx: v };
                        return n;
                      });
                    }}
                  >
                    {teams.map((_, i) => (
                      <option key={i} value={i}>
                        Team {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Team B</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={row.teamBIdx}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCourtRows((r) => {
                        const n = [...r];
                        n[idx] = { ...n[idx]!, teamBIdx: v };
                        return n;
                      });
                    }}
                  >
                    {teams.map((_, i) => (
                      <option key={i} value={i}>
                        Team {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Score A</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.teamAScore}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCourtRows((r) => {
                        const n = [...r];
                        n[idx] = { ...n[idx]!, teamAScore: v };
                        return n;
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Score B</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.teamBScore}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCourtRows((r) => {
                        const n = [...r];
                        n[idx] = { ...n[idx]!, teamBScore: v };
                        return n;
                      });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Winner</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={row.winner}
                  onChange={(e) => {
                    const v = e.target.value as "team_a" | "team_b";
                    setCourtRows((r) => {
                      const n = [...r];
                      n[idx] = { ...n[idx]!, winner: v };
                      return n;
                    });
                  }}
                >
                  <option value="team_a">Team A</option>
                  <option value="team_b">Team B</option>
                </select>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setStep("teams")}>
              Back
            </Button>
            <Button type="button" disabled={pending} onClick={onSaveGames}>
              Save results
            </Button>
            <Button type="button" disabled={pending} onClick={onComplete}>
              Complete session
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
