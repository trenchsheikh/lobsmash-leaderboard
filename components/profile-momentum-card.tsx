import { Card, CardContent } from "@/components/ui/card";
import { profileCardShell } from "@/lib/profile-styles";
import { nowMs } from "@/lib/server-time";
import { cn } from "@/lib/utils";

type RatingPoint = {
  recorded_at: string;
  skill: number;
};

type Props = {
  history: RatingPoint[];
  /** Days the delta is computed over (default 30). */
  windowDays?: number;
  currentStreak: number;
};

/**
 * Momentum: skill delta over the last N days, current streak, and a tiny
 * sparkline. Empty state when fewer than 2 history points or no streak.
 */
export function ProfileMomentumCard({ history, windowDays = 30, currentStreak }: Props) {
  if (history.length < 2) {
    return (
      <Card className={profileCardShell}>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Momentum
          </p>
          <p className="text-sm text-muted-foreground">
            Play a few rated matches to see your trend.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cutoff = nowMs() - windowDays * 24 * 60 * 60 * 1000;
  const within = history.filter((h) => new Date(h.recorded_at).getTime() >= cutoff);
  const baseline = within.length >= 2 ? within[0].skill : history[0].skill;
  const latest = history[history.length - 1].skill;
  const delta = latest - baseline;
  const points = within.length >= 2 ? within : history.slice(-12);

  const minSkill = Math.min(...points.map((p) => p.skill));
  const maxSkill = Math.max(...points.map((p) => p.skill));
  const span = Math.max(1, maxSkill - minSkill);
  const w = 220;
  const h = 60;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p.skill - minSkill) / span) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const trendColor = delta > 0 ? "text-lime-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground";
  const strokeColor = delta >= 0 ? "stroke-lime-500" : "stroke-rose-500";

  return (
    <Card className={profileCardShell}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Momentum
          </p>
          {currentStreak !== 0 ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                currentStreak > 0
                  ? "bg-lime-500/15 text-lime-700 dark:text-lime-300"
                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
              )}
            >
              {Math.abs(currentStreak)} {currentStreak > 0 ? "Win" : "Loss"} Streak
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn("font-heading text-3xl font-semibold tabular-nums", trendColor)}>
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {Math.abs(Math.round(delta))}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={cn("inline-block size-1.5 rounded-full", delta > 0 ? "bg-lime-500" : delta < 0 ? "bg-rose-500" : "bg-muted-foreground")} />
            {delta === 0 ? "flat" : delta > 0 ? "trending up" : "cooling off"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{windowDays}-day rating delta</p>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="block w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={path} fill="none" strokeWidth={2.25} className={strokeColor} strokeLinecap="round" strokeLinejoin="round" />
          {points.length > 0 ? (
            <circle
              cx={(points.length - 1) * stepX}
              cy={h - ((points[points.length - 1].skill - minSkill) / span) * h}
              r={3}
              className={cn("fill-background", strokeColor)}
              strokeWidth={2}
            />
          ) : null}
        </svg>
      </CardContent>
    </Card>
  );
}
