"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  variant?: "lime" | "navy" | "muted";
  disabled?: boolean;
  /** Hide the label + numeric row (e.g. when the parent shows the title). */
  hideLabelRow?: boolean;
};

export function VerificationAttributeBar({
  label,
  value,
  min = 1,
  max = 8,
  onChange,
  variant = "lime",
  disabled,
  hideLabelRow,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const fill =
    variant === "lime"
      ? "bg-primary"
      : variant === "navy"
        ? "bg-brand-navy"
        : "bg-muted-foreground/40";

  return (
    <div className="flex flex-col gap-2">
      {!hideLabelRow ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="tabular-nums text-sm text-muted-foreground">{value}</span>
        </div>
      ) : (
        <div className="flex justify-end">
          <span className="tabular-nums text-xs font-medium text-muted-foreground">{value}/8</span>
        </div>
      )}
      <div
        className={cn(
          "h-3 w-full overflow-hidden rounded-full bg-muted",
          "ring-1 ring-border/80",
        )}
        role="presentation"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-200", fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(ev) => onChange(Number(ev.target.value))}
        className={cn(
          "h-2 w-full cursor-pointer accent-primary",
          disabled && "cursor-not-allowed opacity-60",
        )}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label || "Rating"}
      />
    </div>
  );
}
