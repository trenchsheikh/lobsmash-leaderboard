"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buttonVariants } from "@/lib/button-variants";
import { CoachAssessmentForm } from "@/components/verification/coach-assessment-form";
import {
  PlayerVerificationStatsPanel,
  buildDefaultAttributeScores,
} from "@/components/verification/player-verification-stats-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { verificationSessionDualViewEnabled } from "@/lib/verification-dev";

export type SessionPortalPlayerPayload = {
  name: string;
  username: string | null;
  selfReported: Record<string, number> | null;
  coachVerified: Record<string, number> | null;
  coachVerifiedNotes: Record<string, string> | null;
  coachVerifiedAt: string | null;
  coachVerifiedByLabel: string | null;
  coachVerifiedVenue: string | null;
};

type Props = {
  requestId: string;
  status: string;
  slotId: string | null;
  isPlayer: boolean;
  isCoach: boolean;
  player: SessionPortalPlayerPayload;
};

export function VerificationSessionPortal({
  requestId,
  status,
  slotId,
  isPlayer,
  isCoach,
  player,
}: Props) {
  const dual = verificationSessionDualViewEnabled();
  const showCoachTab = isCoach || (dual && isPlayer);
  const showPlayerTab = isPlayer || isCoach;

  const defaultTab = isCoach && !isPlayer ? "coach" : "player";

  const selfScores = useMemo(
    () => buildDefaultAttributeScores(player.selfReported ?? undefined),
    [player.selfReported],
  );
  const coachScores = useMemo(
    () => buildDefaultAttributeScores(player.coachVerified ?? undefined),
    [player.coachVerified],
  );

  const pending = status === "pending";
  const completed = status === "submitted";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={isCoach ? "/verification/inbox" : "/verification"}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit gap-1 px-2 text-muted-foreground hover:text-foreground",
          )}
        >
          ← {isCoach ? "Coach inbox" : "Verification"}
        </Link>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Session</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {isPlayer ? "Your session" : player.name}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {completed
            ? "Verification submitted — coach-backed ratings and notes are on your profile."
            : pending
              ? slotId
                ? "After you play together, your coach records ratings and optional notes for each area."
                : "Your coach will record ratings here after the session."
              : null}
        </p>
      </div>

      {dual && isPlayer && !isCoach ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Dev: open <span className="font-medium text-foreground">Coach</span> to preview the form — submit
          still needs the coach account.
        </p>
      ) : null}

      <Tabs defaultValue={showPlayerTab ? defaultTab : "coach"} className="w-full">
        <TabsList className="h-auto w-full justify-stretch gap-0 rounded-xl border border-border/60 bg-muted/30 p-1 sm:w-auto sm:justify-start">
          {showPlayerTab ? (
            <TabsTrigger value="player" className="flex-1 rounded-lg sm:flex-none">
              Player
            </TabsTrigger>
          ) : null}
          {showCoachTab ? (
            <TabsTrigger value="coach" className="flex-1 rounded-lg sm:flex-none">
              Coach
            </TabsTrigger>
          ) : null}
        </TabsList>

        {showPlayerTab ? (
          <TabsContent value="player" className="flex flex-col gap-6">
            <div className="space-y-0.5">
              <h2 className="font-heading text-lg font-semibold text-foreground">{player.name}</h2>
              {player.username ? (
                <p className="font-mono text-sm text-muted-foreground">@{player.username}</p>
              ) : null}
            </div>

            <PlayerVerificationStatsPanel
              title={isPlayer ? "Self-reported" : "Self-reported (player)"}
              description={
                isPlayer
                  ? "From your profile — your coach sees this for context."
                  : "Their profile baseline before your assessment."
              }
              scores={selfScores}
              compact
            />

            {player.coachVerifiedAt && player.coachVerified ? (
              <div className="flex flex-col gap-2">
                <PlayerVerificationStatsPanel
                  title="Coach-verified"
                  description={
                    player.coachVerifiedByLabel
                      ? `${player.coachVerifiedByLabel}${
                          player.coachVerifiedVenue ? ` · ${player.coachVerifiedVenue}` : ""
                        } · ${new Date(player.coachVerifiedAt).toLocaleString()}`
                      : new Date(player.coachVerifiedAt).toLocaleString()
                  }
                  scores={coachScores}
                  notes={player.coachVerifiedNotes}
                  compact
                />
                <Link href="/profile" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                  View on profile
                </Link>
              </div>
            ) : completed ? (
              <p className="text-sm text-muted-foreground">
                This request is marked complete. Refresh if ratings just appeared.
              </p>
            ) : (
              <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Coach-verified stats will appear here after your coach submits the assessment for this
                request.
              </p>
            )}
          </TabsContent>
        ) : null}

        {showCoachTab ? (
          <TabsContent value="coach" className="flex flex-col gap-4">
            {pending && isCoach ? (
              <CoachAssessmentForm
                requestId={requestId}
                playerName={player.name}
                playerUsername={player.username}
                finishHref={`/verification/session/${requestId}`}
              />
            ) : pending && !isCoach && dual && isPlayer ? (
              <CoachAssessmentForm
                requestId={requestId}
                playerName={player.name}
                playerUsername={player.username}
                readOnlyPreview
              />
            ) : (
              <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                {completed ? (
                  <>
                    <p className="font-medium text-foreground">Assessment submitted</p>
                    <p className="mt-2">
                      The player is now coach-verified with the submitted attribute ratings on their
                      profile.
                    </p>
                  </>
                ) : (
                  <p>You can only enter ratings while the request is pending and you are the assigned coach.</p>
                )}
              </div>
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
