import { cn } from "@/lib/utils";
import { formLossClass, formWinClass } from "@/lib/profile-styles";

export type FormResult = {
  played_at: string;
  won: boolean;
};

type Props = {
  results: FormResult[];
  /** When true, pads to this length with dim placeholders. Defaults to 10. */
  paddedLength?: number;
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
};

/**
 * Renders the most recent W/L results as filled pills, oldest -> newest.
 * Lime for wins, blue (sky) for losses, per the requested visual.
 */
export function ProfileRankFormStrip({
  results,
  paddedLength = 10,
  size = "md",
  className,
  showLabel = true,
}: Props) {
  const ordered = [...results].reverse();
  const placeholders = Math.max(0, paddedLength - ordered.length);
  const wins = results.filter((r) => r.won).length;
  const losses = results.length - wins;

  const pillSize = size === "sm" ? "h-5 w-6 text-[0.6rem]" : "h-6 w-7 text-[0.65rem]";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/70">
            Form
          </span>
          <span className="font-mono text-[0.65rem] text-white/70">
            <span className="text-lime-300 tabular-nums">{wins}W</span>
            <span className="px-1 text-white/40">·</span>
            <span className="text-sky-300 tabular-nums">{losses}L</span>
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        {ordered.map((r) => (
          <span
            key={r.played_at}
            className={cn(
              "inline-flex items-center justify-center rounded-md font-bold leading-none shadow-sm ring-1 ring-black/10",
              pillSize,
              r.won ? formWinClass : formLossClass,
            )}
            aria-label={r.won ? "Win" : "Loss"}
            title={new Date(r.played_at).toLocaleDateString()}
          >
            {r.won ? "W" : "L"}
          </span>
        ))}
        {Array.from({ length: placeholders }).map((_, i) => (
          <span
            key={`placeholder-${i}`}
            aria-hidden
            className={cn(
              "inline-block rounded-md border border-white/15 bg-white/5",
              pillSize,
            )}
          />
        ))}
      </div>
    </div>
  );
}
