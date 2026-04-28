"use client";

import type { RatingAttributeUi } from "@/lib/verification-attributes";
import { CoachRatingPick } from "@/components/coach-rating-pick";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  meta: RatingAttributeUi;
  score: number;
  note: string;
  onScore: (v: number) => void;
  onNote: (v: string) => void;
  disabled: boolean;
  index: number;
  total: number;
  /** Shown under the feedback field after a failed submit */
  sectionError?: string;
  /** When false (e.g. read-only preview), feedback is not required */
  feedbackRequired?: boolean;
};

export function CoachAttributeAssessmentBlock({
  meta,
  score,
  note,
  onScore,
  onNote,
  disabled,
  index,
  total,
  sectionError,
  feedbackRequired = true,
}: Props) {
  const Icon = meta.Icon;
  const required = feedbackRequired !== false;
  const remaining = 600 - note.length;

  return (
    <section className="rounded-xl border border-border/60 bg-card px-4 py-5 sm:px-5 sm:py-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-foreground"
            aria-hidden
          >
            <Icon className="size-[1.15rem]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {index} / {total}
            </p>
            <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {meta.label}
            </h3>
            <p className="text-sm leading-snug text-muted-foreground">{meta.coachPrompt}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">Rating</Label>
          <CoachRatingPick value={score} onChange={onScore} disabled={disabled} />
        </div>

        <details className="group rounded-lg bg-muted/30 open:bg-muted/40">
          <summary className="cursor-pointer select-none list-none px-3 py-2.5 text-xs font-medium text-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-muted-foreground group-open:text-foreground">Scoring guide</span>
            <span className="ml-1.5 font-normal text-muted-foreground">· {meta.spcPillars}</span>
          </summary>
          <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2 text-xs leading-relaxed text-muted-foreground">
            <p>{meta.rubric}</p>
          </div>
        </details>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={`note-${meta.value}`} className="text-xs font-medium text-foreground">
              Feedback{required ? <span className="text-destructive"> *</span> : null}
            </Label>
            <span className="tabular-nums text-[10px] text-muted-foreground">{remaining} left</span>
          </div>
          <Textarea
            id={`note-${meta.value}`}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            disabled={disabled}
            rows={2}
            maxLength={600}
            required={required}
            aria-invalid={Boolean(sectionError)}
            placeholder={
              required
                ? "What you saw on court for this area — required before submit."
                : "Preview — feedback disabled."
            }
            className={cn(
              "min-h-[4.25rem] resize-y border-border/80 bg-background text-sm leading-relaxed placeholder:text-muted-foreground/70",
              sectionError && "border-destructive/60",
            )}
          />
          {sectionError ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              {sectionError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
