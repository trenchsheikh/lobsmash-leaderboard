"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { buttonVariants } from "@/lib/button-variants";
import { CoachAttributeAssessmentBlock } from "@/components/coach-attribute-assessment-block";
import {
  PlayerVerificationStatsPanel,
  buildDefaultAttributeScores,
} from "@/components/verification/player-verification-stats-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RATING_ATTRIBUTE_UI } from "@/lib/verification-attributes";
import { upsertDemoFeedback } from "@/lib/verification-demo-feedback";
import { cn } from "@/lib/utils";

type Props = {
  slotId: string;
  coachUserId: string;
  coachLabel: string;
  slotVenue: string;
  playerName: string;
  playerUsername: string | null;
  selfReported: Record<string, number> | null;
};

export function VerificationDevSessionPortal({
  slotId,
  coachUserId,
  coachLabel,
  slotVenue,
  playerName,
  playerUsername,
  selfReported,
}: Props) {
  const total = RATING_ATTRIBUTE_UI.length;
  const [tab, setTab] = useState("player");

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const a of RATING_ATTRIBUTE_UI) o[a.value] = 5;
    return o;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const a of RATING_ATTRIBUTE_UI) o[a.value] = "";
    return o;
  });
  const [venue, setVenue] = useState(slotVenue.slice(0, 200));
  const [mockCoachVerified, setMockCoachVerified] = useState<Record<string, number> | null>(null);
  const [mockCoachNotes, setMockCoachNotes] = useState<Record<string, string> | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selfScores = useMemo(() => buildDefaultAttributeScores(selfReported ?? undefined), [selfReported]);

  const coachScores = mockCoachVerified ? buildDefaultAttributeScores(mockCoachVerified) : null;

  useEffect(() => {
    if (mockCoachVerified && mockCoachNotes) setTab("player");
  }, [mockCoachVerified, mockCoachNotes]);

  function setNote(key: string, v: string) {
    setNotes((s) => ({ ...s, [key]: v.slice(0, 600) }));
    setSectionErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function applyDemoSubmit() {
    setFormError(null);
    const nextSection: Record<string, string> = {};
    for (const meta of RATING_ATTRIBUTE_UI) {
      const t = (notes[meta.value] ?? "").trim();
      if (t.length < 1) nextSection[meta.value] = "Add feedback for this area.";
    }
    if (Object.keys(nextSection).length > 0) {
      setSectionErrors(nextSection);
      setFormError("Every rating needs written feedback (same as the live coach form).");
      return;
    }
    setSectionErrors({});

    start(async () => {
      await new Promise((r) => setTimeout(r, 150));
      const nextScores: Record<string, number> = {};
      const nextNotes: Record<string, string> = {};
      for (const a of RATING_ATTRIBUTE_UI) {
        nextScores[a.value] = Math.min(8, Math.max(1, Math.round(scores[a.value] ?? 4)));
        nextNotes[a.value] = (notes[a.value] ?? "").trim().slice(0, 600);
      }
      upsertDemoFeedback({
        slotId,
        coachUserId,
        scores: nextScores,
        notes: nextNotes,
        submittedAt: new Date().toISOString(),
      });
      setMockCoachVerified(nextScores);
      setMockCoachNotes(nextNotes);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/verification"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-fit gap-1 px-2 text-muted-foreground hover:text-foreground",
        )}
      >
        ← Verification
      </Link>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo session</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Development portal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Not saved to the server. After you apply, feedback is written to this browser and appears on
          your <span className="font-medium text-foreground">Verification</span> page for this demo
          booking (including if that page is open in another tab).
          Coach: <span className="font-medium text-foreground">{coachLabel}</span> ·{" "}
          <span className="font-medium text-foreground">{slotVenue}</span>
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="player">Player</TabsTrigger>
          <TabsTrigger value="coach">Coach</TabsTrigger>
        </TabsList>

        <TabsContent value="player" className="flex flex-col gap-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">{playerName}</h2>
            {playerUsername ? (
              <p className="font-mono text-sm text-muted-foreground">@{playerUsername}</p>
            ) : null}
          </div>
          <PlayerVerificationStatsPanel
            title="Self-reported"
            description="From your real profile (demo only)."
            scores={selfScores}
            compact
          />
          {coachScores && mockCoachNotes ? (
            <PlayerVerificationStatsPanel
              title="Coach feedback (demo)"
              description="Shown here and on your Verification requests list for this slot."
              scores={coachScores}
              notes={mockCoachNotes}
              compact
            />
          ) : (
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Use the Coach tab: rate each area and write feedback, then apply. It will appear here and
              on Verification.
            </p>
          )}
        </TabsContent>

        <TabsContent value="coach" className="flex flex-col gap-5">
          <div>
            <p className="text-sm text-muted-foreground">Coach (demo)</p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              {playerName}
            </h2>
            {playerUsername ? (
              <p className="font-mono text-sm text-muted-foreground">@{playerUsername}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dev-verify-venue" className="text-xs font-medium text-foreground">
              Where (optional)
            </Label>
            <Input
              id="dev-verify-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value.slice(0, 200))}
              maxLength={200}
              disabled={pending}
              className="h-11 border-border/80 bg-background"
            />
          </div>

          <ol className="flex list-none flex-col gap-4 p-0">
            {RATING_ATTRIBUTE_UI.map((meta, i) => (
              <li key={meta.value} className="m-0 p-0">
                <CoachAttributeAssessmentBlock
                  meta={meta}
                  index={i + 1}
                  total={total}
                  score={scores[meta.value] ?? 4}
                  note={notes[meta.value] ?? ""}
                  onScore={(v) => setScores((s) => ({ ...s, [meta.value]: v }))}
                  onNote={(v) => setNote(meta.value, v)}
                  disabled={pending}
                  sectionError={sectionErrors[meta.value]}
                  feedbackRequired
                />
              </li>
            ))}
          </ol>

          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={applyDemoSubmit}
            disabled={pending}
            className="h-12 w-full max-w-lg text-base font-medium"
          >
            {pending ? "Applying…" : "Send feedback to player (demo)"}
          </Button>
          {mockCoachVerified && mockCoachNotes ? (
            <p className="text-sm text-muted-foreground" role="status">
              Open the Player tab or go back to Verification — your notes appear under the demo
              request.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
