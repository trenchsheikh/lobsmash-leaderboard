"use client";

import { RATING_ATTRIBUTE_UI } from "@/lib/verification-attributes";
import { VerificationAttributeBar } from "@/components/verification/verification-attribute-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const variants = ["lime", "navy", "muted"] as const;

type Props = {
  title: string;
  description?: string;
  scores: Record<string, number>;
  /** Coach comments keyed by attribute (shown under each bar when present). */
  notes?: Record<string, string> | null;
  /** When false, bars are non-interactive (default true). */
  readOnly?: boolean;
  /** Slightly tighter layout for the session portal. */
  compact?: boolean;
};

export function PlayerVerificationStatsPanel({
  title,
  description,
  scores,
  notes,
  readOnly = true,
  compact,
}: Props) {
  return (
    <Card className={cn("border-border/80 shadow-sm", compact && "shadow-none")}>
      <CardHeader className={cn("pb-2", compact && "px-4 pt-4")}>
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-5 pt-2", compact && "px-4 pb-4")}>
        {RATING_ATTRIBUTE_UI.map((meta, i) => {
          const Icon = meta.Icon;
          const note = notes?.[meta.value]?.trim() ?? "";
          return (
            <div key={meta.value} className="flex gap-3 sm:gap-4">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl bg-muted text-foreground",
                  compact ? "size-9" : "size-10 sm:size-11",
                )}
                aria-hidden
              >
                <Icon
                  className={cn(compact ? "size-4" : "size-[1.1rem] sm:size-5")}
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{meta.label}</span>
                </div>
                <VerificationAttributeBar
                  label=""
                  value={scores[meta.value] ?? 4}
                  onChange={() => {}}
                  variant={variants[i % variants.length]!}
                  disabled={readOnly}
                  hideLabelRow
                />
                {note ? (
                  <p className="border-l-2 border-primary/25 pl-3 text-xs leading-relaxed text-muted-foreground">
                    {note}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function normalizeScores(raw: Record<string, number> | null | undefined): Record<string, number> {
  const o: Record<string, number> = {};
  for (const a of RATING_ATTRIBUTE_UI) {
    const n = raw?.[a.value];
    o[a.value] =
      typeof n === "number" && Number.isFinite(n) ? Math.min(8, Math.max(1, Math.round(n))) : 4;
  }
  return o;
}

export function buildDefaultAttributeScores(
  raw: Record<string, number> | null | undefined,
): Record<string, number> {
  return normalizeScores(raw);
}
