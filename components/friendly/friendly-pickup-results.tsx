"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveFriendlyCompetitiveScores,
  completeFriendlyPickupSession,
  replaceFriendlySessionGames,
  type FriendlyGameRowInput,
} from "@/app/actions/friendly-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type GameRow = {
  courtNumber: number;
  teamAScore: number;
  teamBScore: number;
  winner: "team_a" | "team_b";
};

type Props = {
  sessionId: string;
  matchKind: "friendly" | "competitive";
  status: string;
  capacity: number;
  leftPlayerIds: string[];
  rightPlayerIds: string[];
  rosterFull: boolean;
  isCreator: boolean;
  creatorUserId: string;
  currentUserId: string;
  skillRatingAppliedAt: string | null;
  competitiveApprovalUserIds: string[];
  rosterUserIds: string[];
  initialGames: Array<{
    court_number: number;
    team_a_players: string[];
    team_b_players: string[];
    team_a_score: number;
    team_b_score: number;
    winner: string;
  }>;
};

function buildPayload(
  left: string[],
  right: string[],
  row: GameRow,
): FriendlyGameRowInput {
  if (left.length < 2 || right.length < 2) {
    throw new Error("Need two players on each side.");
  }
  return {
    courtNumber: row.courtNumber,
    teamAPlayers: [left[0]!, left[1]!] as [string, string],
    teamBPlayers: [right[0]!, right[1]!] as [string, string],
    teamAScore: row.teamAScore,
    teamBScore: row.teamBScore,
    winner: row.winner,
  };
}

export function FriendlyPickupResults({
  sessionId,
  matchKind,
  status,
  capacity,
  leftPlayerIds,
  rightPlayerIds,
  rosterFull,
  isCreator,
  creatorUserId,
  currentUserId,
  skillRatingAppliedAt,
  competitiveApprovalUserIds,
  rosterUserIds,
  initialGames,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const first = initialGames[0];
  const [scoreA, setScoreA] = useState(String(first?.team_a_score ?? 6));
  const [scoreB, setScoreB] = useState(String(first?.team_b_score ?? 4));
  const [winner, setWinner] = useState<"team_a" | "team_b">(
    (first?.winner === "team_b" ? "team_b" : "team_a") as "team_a" | "team_b",
  );

  const open = status === "open";
  const completed = status === "completed";
  const competitive = matchKind === "competitive";
  const usePairsOnly = capacity === 4;
  const hasSavedGames = initialGames.length > 0;

  const nonCreatorRosterUserIds = rosterUserIds.filter((id) => id !== creatorUserId);
  const pendingApprovals = nonCreatorRosterUserIds.filter(
    (id) => !competitiveApprovalUserIds.includes(id),
  );
  const allApproved =
    nonCreatorRosterUserIds.length === 0 ||
    nonCreatorRosterUserIds.every((id) => competitiveApprovalUserIds.includes(id));

  const canEnterScores =
    competitive &&
    rosterFull &&
    leftPlayerIds.length >= 2 &&
    rightPlayerIds.length >= 2 &&
    isCreator;

  const canApproveAsPlayer =
    competitive &&
    open &&
    hasSavedGames &&
    !isCreator &&
    rosterUserIds.includes(currentUserId) &&
    currentUserId !== creatorUserId &&
    !competitiveApprovalUserIds.includes(currentUserId);

  if (completed) {
    return (
      <div className="rounded-xl border border-border/80 bg-muted/15 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Session completed</p>
        {competitive ? (
          <p className="mt-1 text-muted-foreground">
            {skillRatingAppliedAt
              ? "Global skill rating was updated from this session."
              : "Completed without rating changes."}
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">Global skill rating was not changed.</p>
        )}
      </div>
    );
  }

  if (!open) return null;

  function complete() {
    startTransition(async () => {
      const res = await completeFriendlyPickupSession(sessionId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        competitive ? "Session completed — global skill updated." : "Session completed.",
      );
      router.refresh();
    });
  }

  if (matchKind === "friendly") {
    return (
      <div className="rounded-xl border border-border/80 bg-muted/15 p-4">
        <p className="text-sm text-muted-foreground">
          Friendly pickup — global skill is not changed. When everyone has joined, the organiser can complete
          the session.
        </p>
        {isCreator && rosterFull ? (
          <Button
            type="button"
            className="mt-3"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await completeFriendlyPickupSession(sessionId);
                if ("error" in res && res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Session completed.");
                router.refresh();
              })
            }
          >
            {pending ? "Completing…" : "Complete session"}
          </Button>
        ) : null}
      </div>
    );
  }

  if (!competitive) return null;

  if (!usePairsOnly) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
        Competitive rating with results is available for <span className="font-medium">4-player</span> open
        sessions only.
      </div>
    );
  }

  function saveResults() {
    const sa = Math.max(0, parseInt(scoreA, 10) || 0);
    const sb = Math.max(0, parseInt(scoreB, 10) || 0);
    const w: "team_a" | "team_b" =
      winner === "team_b" ? "team_b" : (sa > sb ? "team_a" : sb > sa ? "team_b" : winner);
    if ((w === "team_a" && sa <= sb) || (w === "team_b" && sb <= sa)) {
      toast.error("Winner must have the higher score.");
      return;
    }
    const row: GameRow = { courtNumber: 1, teamAScore: sa, teamBScore: sb, winner: w };
    let payload: FriendlyGameRowInput;
    try {
      payload = buildPayload(leftPlayerIds, rightPlayerIds, row);
    } catch {
      toast.error("Need two players on each side.");
      return;
    }
    startTransition(async () => {
      const res = await replaceFriendlySessionGames(sessionId, [payload]);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Results saved — other players must approve.");
      router.refresh();
    });
  }

  function approve() {
    startTransition(async () => {
      const res = await approveFriendlyCompetitiveScores(sessionId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Results approved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-muted/15 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Match result (competitive)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The organiser enters scores. Every other player must approve before you complete the session for
          global skill to update.
        </p>
      </div>

      {canApproveAsPlayer ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3">
          <p className="text-sm font-medium text-foreground">Confirm results</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check the scores look right, then approve so the organiser can finalise the match.
          </p>
          <Button type="button" className="mt-3" size="sm" disabled={pending} onClick={() => approve()}>
            {pending ? "Submitting…" : "Approve results"}
          </Button>
        </div>
      ) : null}

      {!canEnterScores ? (
        <p className="text-sm text-muted-foreground">
          {!rosterFull
            ? "Fill every slot (4 players) before the organiser can enter results."
            : !isCreator
              ? "Only the organiser can enter or change scores."
              : null}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pickup-sa">Side A score</Label>
              <Input
                id="pickup-sa"
                type="number"
                min={0}
                inputMode="numeric"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-sb">Side B score</Label>
              <Input
                id="pickup-sb"
                type="number"
                min={0}
                inputMode="numeric"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Winner</Label>
            <RadioGroup
              value={winner}
              onValueChange={(v) => setWinner(v as "team_a" | "team_b")}
              className="flex flex-col gap-2 sm:flex-row sm:gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="team_a" id="pickup-w-a" />
                <Label htmlFor="pickup-w-a" className="font-normal">
                  Side A
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="team_b" id="pickup-w-b" />
                <Label htmlFor="pickup-w-b" className="font-normal">
                  Side B
                </Label>
              </div>
            </RadioGroup>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => saveResults()}>
            {pending ? "Saving…" : "Save results"}
          </Button>
        </>
      )}

      {competitive && rosterFull && hasSavedGames ? (
        <p className="text-xs text-muted-foreground">
          Approvals:{" "}
          <span className="font-medium text-foreground">
            {nonCreatorRosterUserIds.length - pendingApprovals.length}/{nonCreatorRosterUserIds.length}
          </span>{" "}
          other players
          {pendingApprovals.length > 0 ? (
            <span className="text-muted-foreground"> (waiting on {pendingApprovals.length})</span>
          ) : null}
        </p>
      ) : null}

      {isCreator && rosterFull ? (
        <div className="border-t border-border/60 pt-4">
          <Button
            type="button"
            disabled={
              pending ||
              !hasSavedGames ||
              (competitive && nonCreatorRosterUserIds.length > 0 && !allApproved)
            }
            onClick={() => complete()}
          >
            {pending ? "Completing…" : "Complete session"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {competitive
              ? "Complete after results are saved and every other player has approved."
              : "Complete when the roster is full."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
