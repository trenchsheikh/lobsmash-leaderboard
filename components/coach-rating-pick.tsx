"use client";

import { cn } from "@/lib/utils";

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
};

/**
 * Discrete 1–8 rating row — faster than a slider on mobile and easy to scan.
 */
export function CoachRatingPick({
  value,
  min = 1,
  max = 8,
  onChange,
  disabled,
}: Props) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1 sm:gap-1.5" role="radiogroup" aria-label="Rating">
        {nums.map((n) => {
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                "flex min-h-10 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-[color,background,box-shadow,transform] sm:min-h-11 sm:rounded-lg sm:text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "active:scale-[0.97]",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/80 bg-background text-foreground/80 hover:border-primary/40 hover:bg-muted/60",
                disabled && "pointer-events-none opacity-45",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between px-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}
