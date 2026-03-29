"use client";

import { useId, useMemo } from "react";
import {
  DEFAULT_SKILL,
  DISPLAY_SKILL_MAX,
  DISPLAY_SKILL_MIN,
  formatDisplayLevel,
} from "@/lib/rating";
import { cn } from "@/lib/utils";

export type RatingHistoryPoint = {
  recorded_at: string;
  skill: number;
  rated_games: number;
};

type ProfileRatingChartProps = {
  history: RatingHistoryPoint[];
  className?: string;
};

const VIEW_W = 640;
const VIEW_H = 200;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function formatSkillTick(n: number) {
  return Math.round(n).toString();
}

function computeLayout(history: RatingHistoryPoint[]) {
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const pts = history.map((h) => ({
    t: new Date(h.recorded_at).getTime(),
    skill: h.skill,
  }));

  if (pts.length === 0) {
    return {
      pathLine: "",
      pathArea: "",
      yTicks: [] as number[],
      xLabels: [] as { x: number; text: string }[],
      minY: DEFAULT_SKILL,
      maxY: DEFAULT_SKILL,
      ariaLabel: "No rating history yet.",
      plotPoints: [] as { x: number; y: number; skill: number }[],
    };
  }

  const skills = pts.map((p) => p.skill);
  let min = Math.min(...skills);
  let max = Math.max(...skills);
  const pad = Math.max(12, (max - min) * 0.12 || 24);
  min -= pad;
  max += pad;
  min = clamp(min, DISPLAY_SKILL_MIN - 200, DISPLAY_SKILL_MAX + 200);
  max = clamp(max, DISPLAY_SKILL_MIN - 200, DISPLAY_SKILL_MAX + 200);
  if (max - min < 40) {
    const mid = (min + max) / 2;
    min = mid - 20;
    max = mid + 20;
  }

  const toX = (i: number) => PAD_L + (innerW * i) / Math.max(1, pts.length - 1);
  const toY = (skill: number) => PAD_T + innerH - (innerH * (skill - min)) / (max - min);

  const plotPoints = pts.map((p, i) => {
    const x = pts.length === 1 ? PAD_L + innerW / 2 : toX(i);
    const y = toY(p.skill);
    return { x, y, skill: p.skill };
  });

  const lineD = plotPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const last = plotPoints[plotPoints.length - 1];
  const first = plotPoints[0];
  const areaD = [
    `M ${first.x.toFixed(2)} ${(PAD_T + innerH).toFixed(2)}`,
    ...plotPoints.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`),
    `L ${last.x.toFixed(2)} ${(PAD_T + innerH).toFixed(2)}`,
    "Z",
  ].join(" ");

  const yStep = (max - min) / 3;
  const yTicks = [min, min + yStep, min + 2 * yStep, max].map((v) => Math.round(v));

  const xLabels: { x: number; text: string }[] = [];
  if (pts.length === 1) {
    xLabels.push({
      x: plotPoints[0].x,
      text: new Date(pts[0].t).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    });
  } else {
    const pick = (idx: number) => {
      const i = clamp(idx, 0, pts.length - 1);
      xLabels.push({
        x: plotPoints[i].x,
        text: new Date(pts[i].t).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      });
    };
    pick(0);
    if (pts.length > 2) pick(Math.floor((pts.length - 1) / 2));
    pick(pts.length - 1);
  }

  const firstD = new Date(pts[0].t).toLocaleDateString();
  const lastD = new Date(pts[pts.length - 1].t).toLocaleDateString();
  const ariaLabel = `Skill rating from ${firstD} to ${lastD}, ${pts.length} data points.`;

  return {
    pathLine: lineD,
    pathArea: areaD,
    yTicks,
    xLabels,
    minY: min,
    maxY: max,
    ariaLabel,
    plotPoints,
  };
}

export function ProfileRatingChart({ history, className }: ProfileRatingChartProps) {
  const rawGrad = useId();
  const rawClip = useId();
  const gradId = rawGrad.replace(/:/g, "");
  const clipId = rawClip.replace(/:/g, "");

  const { pathLine, pathArea, yTicks, xLabels, minY, maxY, ariaLabel, plotPoints } =
    useMemo(() => computeLayout(history), [history]);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-[min(220px,42vw)] w-full max-h-[240px] touch-manipulation"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="[stop-color:var(--color-chart-1)]" stopOpacity="0.35" />
            <stop offset="100%" className="[stop-color:var(--color-chart-1)]" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect
              x={PAD_L}
              y={PAD_T}
              width={VIEW_W - PAD_L - PAD_R}
              height={VIEW_H - PAD_T - PAD_B}
              rx="6"
            />
          </clipPath>
        </defs>

        {yTicks.map((tick) => {
          const y =
            PAD_T +
            (VIEW_H - PAD_T - PAD_B) -
            ((VIEW_H - PAD_T - PAD_B) * (tick - minY)) / (maxY - minY);
          return (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y}
                x2={VIEW_W - PAD_R}
                y2={y}
                className="stroke-border/80"
                strokeWidth={1}
                strokeDasharray="4 6"
              />
              <text
                x={PAD_L - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
                style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
              >
                {formatSkillTick(tick)}
              </text>
            </g>
          );
        })}

        <text
          x={PAD_L}
          y={12}
          className="fill-muted-foreground text-[10px] font-medium uppercase tracking-wide"
          style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif" }}
        >
          Skill
        </text>

        <g clipPath={`url(#${clipId})`}>
          {pathArea ? (
            <path d={pathArea} fill={`url(#${gradId})`} className="motion-reduce:opacity-90" />
          ) : null}
          {pathLine ? (
            <path
              d={pathLine}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {plotPoints.map((p, i) => (
            <circle
              key={`${p.skill}-${i}`}
              cx={p.x}
              cy={p.y}
              r={plotPoints.length === 1 ? 5 : 4}
              fill="var(--card)"
              stroke="var(--chart-1)"
              strokeWidth={2}
            />
          ))}
        </g>

        {xLabels.map((lab, i) => (
          <text
            key={`${lab.text}-${i}`}
            x={lab.x}
            y={VIEW_H - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
            style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif" }}
          >
            {lab.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

type ProfileRatingScaleBarProps = {
  skill: number;
  className?: string;
};

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
        <div
          className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-chart-3 via-chart-1 to-chart-2 opacity-35"
        />
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
