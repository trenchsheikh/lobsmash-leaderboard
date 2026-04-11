"use client";

import { useMemo, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DEFAULT_SKILL,
  DISPLAY_SKILL_MAX,
  DISPLAY_SKILL_MIN,
  formatDisplayLevel,
} from "@/lib/rating";
import { useIsMaxSm } from "@/lib/use-is-max-sm";
import { cn } from "@/lib/utils";

export type RatingHistoryPoint = {
  recorded_at: string;
  skill: number;
  rated_games: number;
};

type ProfileRatingChartProps = {
  history: RatingHistoryPoint[];
  className?: string;
  /**
   * `embedded` — title, window toolbar, chart, window trend (for inside Skill rating card).
   * `card` — same chrome wrapped in a nested Card. `inline` — toolbar + chart only (e.g. modals).
   */
  presentation?: "inline" | "card" | "embedded";
};

const chartConfig = {
  skill: {
    label: "Skill rating",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type RangeKey = "all" | 50 | 30 | 15;

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: 50, label: "50" },
  { key: 30, label: "30" },
  { key: 15, label: "15" },
];

function sliceHistory(history: RatingHistoryPoint[], mode: RangeKey) {
  if (mode === "all") return history;
  if (history.length <= mode) return history;
  return history.slice(-mode);
}

function padSkillDomain(skills: number[]): [number, number] {
  if (skills.length === 0) {
    return [DEFAULT_SKILL - 24, DEFAULT_SKILL + 24];
  }
  let lo = Math.min(...skills);
  let hi = Math.max(...skills);
  const pad = Math.max(10, (hi - lo) * 0.15 || 20);
  lo -= pad;
  hi += pad;
  lo = Math.max(DISPLAY_SKILL_MIN - 200, lo);
  hi = Math.min(DISPLAY_SKILL_MAX + 200, hi);
  if (hi - lo < 36) {
    const mid = (lo + hi) / 2;
    lo = mid - 18;
    hi = mid + 18;
  }
  return [Math.round(lo), Math.round(hi)];
}

function formatSignedSkill(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${Math.round(n)}`;
  return `${Math.round(n)}`;
}

export function ProfileRatingChart({
  history,
  className,
  presentation = "inline",
}: ProfileRatingChartProps) {
  const [range, setRange] = useState<RangeKey>("all");
  const narrowMobile = useIsMaxSm();

  const visible = useMemo(() => sliceHistory(history, range), [history, range]);

  const chartRows = useMemo(
    () =>
      visible.map((h) => {
        const d = new Date(h.recorded_at);
        return {
          label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          tooltipTitle: d.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }),
          skill: Math.round(h.skill),
          ratedGames: h.rated_games,
        };
      }),
    [visible],
  );

  const yDomain = useMemo(
    () => padSkillDomain(visible.map((h) => h.skill)),
    [visible],
  );

  const windowTrend = useMemo(() => {
    if (visible.length < 2) return null;
    const first = visible[0];
    const last = visible[visible.length - 1];
    const delta = last.skill - first.skill;
    const firstLv = formatDisplayLevel(first.skill);
    const lastLv = formatDisplayLevel(last.skill);
    return {
      delta,
      firstLabel: new Date(first.recorded_at).toLocaleDateString(undefined, {
        dateStyle: "medium",
      }),
      lastLabel: new Date(last.recorded_at).toLocaleDateString(undefined, {
        dateStyle: "medium",
      }),
      firstLv,
      lastLv,
      snapshots: visible.length,
    };
  }, [visible]);

  const rangeDescription = useMemo(() => {
    if (visible.length === 0) return "";
    if (visible.length === 1) {
      return new Date(visible[0].recorded_at).toLocaleDateString(undefined, {
        dateStyle: "medium",
      });
    }
    const a = new Date(visible[0].recorded_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const b = new Date(visible[visible.length - 1].recorded_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${a} → ${b} · ${visible.length} snapshots`;
  }, [visible]);

  if (history.length === 0) {
    return null;
  }

  const framed = presentation === "card" || presentation === "embedded";

  const windowToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline">
        Window
      </span>
      <div className="flex flex-wrap gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={String(opt.key)}
            type="button"
            variant={range === opt.key ? "secondary" : "ghost"}
            size="sm"
            className="h-9 min-h-9 rounded-lg px-2.5 text-xs sm:h-8 sm:min-h-8"
            onClick={() => setRange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );

  const chartOuterHeight = framed
    ? "h-[200px] min-h-[200px] sm:h-[240px] sm:min-h-[240px]"
    : "h-[220px] min-h-[220px] sm:h-[260px] sm:min-h-[260px]";

  const lineMargins = narrowMobile
    ? { left: framed ? 0 : 0, right: 4, top: 6, bottom: 2 }
    : {
        left: framed ? 8 : 4,
        right: 12,
        top: 8,
        bottom: 4,
      };

  const chartBlock = (
    <div className={cn("w-full min-w-0", chartOuterHeight)}>
      <ChartContainer config={chartConfig} className="h-full w-full min-h-0">
        <LineChart
          accessibilityLayer
          data={chartRows}
          margin={lineMargins}
        >
          <CartesianGrid vertical={false} className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={narrowMobile ? 4 : 8}
            interval="preserveStartEnd"
            minTickGap={narrowMobile ? 42 : 28}
          />
          <YAxis
            dataKey="skill"
            domain={yDomain}
            tickLine={false}
            axisLine={false}
            tickMargin={narrowMobile ? 4 : 8}
            width={narrowMobile ? 32 : 40}
            tickFormatter={(v) => `${v}`}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { tooltipTitle?: string } | undefined;
                  return row?.tooltipTitle ?? null;
                }}
                formatter={(value, name, item) => {
                  const row = item?.payload as { ratedGames?: number } | undefined;
                  return (
                    <div className="flex w-full flex-col items-end gap-0.5 text-right">
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {value} skill
                      </span>
                      {row?.ratedGames != null ? (
                        <span className="text-[0.7rem] text-muted-foreground tabular-nums">
                          {row.ratedGames} rated games
                        </span>
                      ) : null}
                    </div>
                  );
                }}
              />
            }
          />
          <Line
            name="Skill rating"
            dataKey="skill"
            type="natural"
            stroke="var(--color-skill)"
            strokeWidth={2}
            dot={
              chartRows.length <= 24
                ? {
                    fill: "var(--color-skill)",
                  }
                : false
            }
            activeDot={{
              r: 6,
              fill: "var(--color-skill)",
            }}
            isAnimationActive={chartRows.length < 80}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );

  const windowTrendFooterInner = (
    <>
      {windowTrend ? (
        <>
          <div className="flex flex-wrap items-center gap-2 leading-none font-medium text-foreground">
            {windowTrend.delta > 0 ? (
              <>
                <span>
                  Net growth <span className="tabular-nums">{formatSignedSkill(windowTrend.delta)}</span>{" "}
                  skill ({windowTrend.firstLv} → {windowTrend.lastLv})
                </span>
                <TrendingUp className="size-4 shrink-0 text-chart-1" aria-hidden />
              </>
            ) : windowTrend.delta < 0 ? (
              <>
                <span>
                  Net decline <span className="tabular-nums">{formatSignedSkill(windowTrend.delta)}</span>{" "}
                  skill ({windowTrend.firstLv} → {windowTrend.lastLv})
                </span>
                <TrendingDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </>
            ) : (
              <>
                <span>
                  Flat in this window ({windowTrend.firstLv} → {windowTrend.lastLv})
                </span>
                <Minus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </>
            )}
          </div>
          <p className="leading-snug text-muted-foreground">
            From {windowTrend.firstLabel} through {windowTrend.lastLabel} ({windowTrend.snapshots}{" "}
            rating updates). Shorter windows focus on recent form.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span>Single snapshot so far</span>
            <Minus className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="leading-snug text-muted-foreground">
            Complete more rated sessions to see how your skill moves over time.
          </p>
        </>
      )}
    </>
  );

  if (presentation === "embedded") {
    return (
      <div
        className={cn(
          "w-full min-w-0 space-y-4 rounded-xl border border-border/50 bg-muted/10 p-4 sm:p-5",
          className,
        )}
      >
        <div className="space-y-1">
          <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
            Skill over time
          </h3>
          <p className="text-xs text-muted-foreground sm:text-sm">{rangeDescription}</p>
        </div>
        {windowToolbar}
        {chartBlock}
        <div className="flex flex-col gap-2 border-t border-border/50 pt-4 text-sm">
          {windowTrendFooterInner}
        </div>
      </div>
    );
  }

  if (presentation === "card") {
    return (
      <Card className={cn("w-full min-w-0 border-border/70 shadow-sm", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Skill over time</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{rangeDescription}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-3 pt-0">
          {windowToolbar}
          {chartBlock}
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 border-t border-border/50 bg-muted/10 pt-4 text-sm">
          {windowTrendFooterInner}
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      {windowToolbar}
      {chartBlock}
    </div>
  );
}

type ProfileRatingScaleBarProps = {
  skill: number;
  className?: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Position on the 800–2200 display scale (algorithm.md). */
export function ProfileRatingScaleBar({ skill, className }: ProfileRatingScaleBarProps) {
  const t = clamp(
    (skill - DISPLAY_SKILL_MIN) / (DISPLAY_SKILL_MAX - DISPLAY_SKILL_MIN),
    0,
    1,
  );
  const pct = `${(t * 100).toFixed(2)}%`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Level scale</span>
        <span className="tabular-nums">
          Lv {formatDisplayLevel(skill)} · {Math.round(skill)} skill
        </span>
      </div>
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/60"
        role="meter"
        aria-valuemin={DISPLAY_SKILL_MIN}
        aria-valuemax={DISPLAY_SKILL_MAX}
        aria-valuenow={Math.round(skill)}
        aria-label={`Skill ${Math.round(skill)} on scale from ${DISPLAY_SKILL_MIN} to ${DISPLAY_SKILL_MAX}`}
      >
        <div className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-chart-3 via-chart-1 to-chart-2 opacity-35" />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm ring-2 ring-primary/25"
          style={{ left: pct }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
        <span>0</span>
        <span>7</span>
      </div>
    </div>
  );
}
