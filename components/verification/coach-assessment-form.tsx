"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitCoachAssessment } from "@/app/actions/verification";
import { RATING_ATTRIBUTE_UI } from "@/lib/verification-attributes";
import { CoachAttributeAssessmentBlock } from "@/components/coach-attribute-assessment-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  requestId: string;
  playerName: string;
  playerUsername: string | null;
  finishHref?: string;
  readOnlyPreview?: boolean;
};

export function CoachAssessmentForm({
  requestId,
  playerName,
  playerUsername,
  finishHref = "/verification/inbox",
  readOnlyPreview,
}: Props) {
  const router = useRouter();
  const total = RATING_ATTRIBUTE_UI.length;
  const requireNotes = !readOnlyPreview;

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const a of RATING_ATTRIBUTE_UI) o[a.value] = 4;
    return o;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const a of RATING_ATTRIBUTE_UI) o[a.value] = "";
    return o;
  });
  const [venue, setVenue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [isSubmitting, start] = useTransition();

  const locked = isSubmitting || Boolean(readOnlyPreview);

  function setScore(key: string, v: number) {
    setScores((s) => ({ ...s, [key]: v }));
  }

  function setNote(key: string, v: string) {
    setNotes((s) => ({ ...s, [key]: v.slice(0, 600) }));
    setSectionErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function submit() {
    if (readOnlyPreview) return;
    setErr(null);

    if (requireNotes) {
      const nextSection: Record<string, string> = {};
      for (const meta of RATING_ATTRIBUTE_UI) {
        const t = (notes[meta.value] ?? "").trim();
        if (t.length < 1) {
          nextSection[meta.value] = "Add feedback for this area.";
        }
      }
      if (Object.keys(nextSection).length > 0) {
        setSectionErrors(nextSection);
        setErr("Every rating needs written feedback before you can submit.");
        return;
      }
    }
    setSectionErrors({});

    start(async () => {
      const r = await submitCoachAssessment(requestId, scores, venue, notes);
      if ("error" in r) {
        setErr(r.error ?? "Something went wrong.");
        return;
      }
      router.push(finishHref);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-4">
      <header className="space-y-2 border-b border-border/50 pb-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Verification
        </p>
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {playerName}
          </h2>
          {playerUsername ? (
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">@{playerUsername}</p>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pick a score and write a short note for each area — both are required and appear on the
          player&apos;s profile after submit.
        </p>
      </header>

      {readOnlyPreview ? (
        <p className="rounded-lg border border-dashed border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
          Preview — sign in as this player&apos;s coach to submit.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="verify-venue" className="text-xs font-medium text-foreground">
          Where you coached (optional)
        </Label>
        <Input
          id="verify-venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value.slice(0, 200))}
          maxLength={200}
          placeholder="e.g. Club or city — shows on their badge"
          disabled={locked}
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
              onScore={(v) => setScore(meta.value, v)}
              onNote={(v) => setNote(meta.value, v)}
              disabled={locked}
              sectionError={sectionErrors[meta.value]}
              feedbackRequired={requireNotes}
            />
          </li>
        ))}
      </ol>

      {err ? (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}

      {readOnlyPreview ? null : (
        <div className="sticky bottom-0 border-t border-border/60 bg-background/95 pt-4 pb-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
          <Button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className={cn("h-12 w-full text-base font-medium")}
          >
            {isSubmitting ? "Submitting…" : "Submit verification"}
          </Button>
        </div>
      )}
    </div>
  );
}
