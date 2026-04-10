"use client";

import { useMemo } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import type { LeaderboardRow } from "@/lib/leaderboard";
import type { SessionInputMode } from "@/lib/league-format";
import {
  DEFAULT_SKILL,
  DISPLAY_SKILL_MAX,
  DISPLAY_SKILL_MIN,
  formatDisplayLevel,
} from "@/lib/rating";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  level: {
    label: "Skill",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export type LeagueOverviewSummaryProps = {
  rosterDisplay: Array<{
    id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
    isGuest: boolean;
    playstyle?: string | null;
  }>;
  rosterSkillByPlayerId: Record<string, number>;
  leaderboard: LeaderboardRow[];
  leagueResultsMode: SessionInputMode;
  skillPreviewDelta: Map<string, number>;
  hasDraftSessions: boolean;
  memberRows: Array<{ id: string }>;
};

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(1, t));
}

export function LeagueOverviewSummary({
  rosterDisplay,
  rosterSkillByPlayerId,
  leaderboard,
  leagueResultsMode,
  skillPreviewDelta,
  hasDraftSessions,
  memberRows,
}: LeagueOverviewSummaryProps) {
  const rosterIds = useMemo(
    () => rosterDisplay.map((p) => p.id).filter((id) => id.length > 0),
    [rosterDisplay],
  );

  const rosterCount = rosterIds.length;
  const memberCount = memberRows.length;

  const avgSkill = useMemo(() => {
    if (rosterCount === 0) return null;
    let sum = 0;
    for (const id of rosterIds) {
      const base = rosterSkillByPlayerId[id];
      const skill =
        typeof base === "number" && Number.isFinite(base) ? base : DEFAULT_SKILL;
      const d = skillPreviewDelta.get(id);
      sum += skill + (typeof d === "number" && Number.isFinite(d) ? d : 0);
    }
    return sum / rosterCount;
  }, [rosterIds, rosterSkillByPlayerId, rosterCount, skillPreviewDelta]);

  const skillFillPercent = useMemo(() => {
    if (avgSkill == null) return 0;
    const span = DISPLAY_SKILL_MAX - DISPLAY_SKILL_MIN;
    const t = (avgSkill - DISPLAY_SKILL_MIN) / span;
    return Math.round(clamp01(t) * 100);
  }, [avgSkill]);

  const avgScore = useMemo(() => {
    if (leaderboard.length === 0) return null;
    const key = leagueResultsMode === "champ_court_only" ? "total_wins" : "total_points";
    let sum = 0;
    for (const row of leaderboard) {
      sum += row[key];
    }
    return sum / leaderboard.length;
  }, [leaderboard, leagueResultsMode]);

  const scoreLabel =
    leagueResultsMode === "champ_court_only" ? "Avg wins (standings)" : "Avg points (standings)";

  const chartData = useMemo(
    () => [{ name: "level", value: skillFillPercent, fill: "var(--color-level)" }],
    [skillFillPercent],
  );

  const hasDraftSkillPreview = useMemo(() => {
    for (const v of skillPreviewDelta.values()) {
      if (typeof v === "number" && Number.isFinite(v) && v !== 0) return true;
    }
    return false;
  }, [skillPreviewDelta]);

  const levelDisplay = avgSkill != null ? formatDisplayLevel(avgSkill) : "—";
  const scoreDisplay =
    avgScore != null ? (Number.isInteger(avgScore) ? String(avgScore) : avgScore.toFixed(1)) : "—";

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">League overview</CardTitle>
        <CardDescription>
          Roster skill and standings-based averages
          {hasDraftSessions && hasDraftSkillPreview ? (
            <span className="mt-1 block text-amber-800/95 dark:text-amber-400/90">
              Average level includes live skill preview until sessions complete.
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,280px)] lg:items-center">
        <div className="grid gap-3 sm:grid-cols-3">
          <div
            className={cn(
              "rounded-xl border border-border/60 bg-muted/30 px-4 py-3",
              "flex flex-col gap-0.5",
            )}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Players on roster
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {rosterCount}
            </span>
          </div>
          <div
            className={cn(
              "rounded-xl border border-border/60 bg-muted/30 px-4 py-3",
              "flex flex-col gap-0.5",
            )}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              League members
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {memberCount}
            </span>
          </div>
          <div
            className={cn(
              "rounded-xl border border-border/60 bg-muted/30 px-4 py-3",
              "flex flex-col gap-0.5",
            )}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {scoreLabel}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {scoreDisplay}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Among {leaderboard.length} with stats
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[280px]">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[220px] w-full max-w-[280px]"
          >
            <RadialBarChart
              data={chartData}
              startAngle={90}
              endAngle={-270}
              innerRadius={68}
              outerRadius={110}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" background cornerRadius={10} />
            </RadialBarChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 pt-1">
            <span className="text-3xl font-semibold tabular-nums leading-none text-foreground">
              {levelDisplay}
            </span>
            <span className="text-xs text-muted-foreground">Avg level</span>
            <span className="mt-1 max-w-[12rem] text-center text-[10px] leading-tight text-muted-foreground">
              Scale {DISPLAY_SKILL_MIN}–{DISPLAY_SKILL_MAX}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
