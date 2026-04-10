"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  delta: number | null;
  className?: string;
};

/**
 * Green ↑ / red ↓ with position change; muted “—” when unchanged; empty when no baseline yet.
 */
export function StandingsRankDelta({ delta, className }: Props) {
  if (delta === null) {
    return (
      <span
        className={cn("inline-flex min-w-[2.75rem] justify-center", className)}
        aria-hidden
      />
    );
  }

  if (delta === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-muted-foreground transition-all duration-300 ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
          className,
        )}
        title="No change in rank"
        aria-label="No change in rank"
      >
        <Minus className="size-3 shrink-0 opacity-70" aria-hidden />
      </span>
    );
  }

  if (delta > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-emerald-700 transition-all duration-300 ease-out dark:text-emerald-400 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
          className,
        )}
        title={`Up ${delta} position${delta === 1 ? "" : "s"}`}
        aria-label={`Up ${delta} position${delta === 1 ? "" : "s"}`}
      >
        <ArrowUp className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        {delta}
      </span>
    );
  }

  const down = Math.abs(delta);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-red-500/12 px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums text-red-700 transition-all duration-300 ease-out dark:text-red-400 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200",
        className,
      )}
      title={`Down ${down} position${down === 1 ? "" : "s"}`}
      aria-label={`Down ${down} position${down === 1 ? "" : "s"}`}
    >
      <ArrowDown className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      {down}
    </span>
  );
}
