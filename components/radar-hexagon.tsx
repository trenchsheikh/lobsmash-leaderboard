"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  RADAR_VERTEX_ORDER,
  radarAxisLabels,
  type RadarAxes,
} from "@/lib/player-radar-scores";
import { useIsMaxSm } from "@/lib/use-is-max-sm";
import { cn } from "@/lib/utils";

const chartConfig = {
  value: {
    label: "Self-reported",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export type RadarHexagonProps = {
  axes: RadarAxes;
  className?: string;
  /** Maps to polar tick font size (default matches previous ~3.55 in 100 viewBox). */
  labelFontSize?: number;
  labelRadiusPadding?: number;
};

export function RadarHexagon({
  axes,
  className,
  labelFontSize = 3.55,
}: RadarHexagonProps) {
  const narrowMobile = useIsMaxSm();

  const tickFontSize = Math.max(
    narrowMobile ? 8 : 9,
    Math.round((labelFontSize / 3.55) * (narrowMobile ? 9 : 10)),
  );

  const chartData = useMemo(() => {
    const labels = radarAxisLabels();
    return RADAR_VERTEX_ORDER.map((key) => ({
      axis: labels[key].split(" / ")[0],
      fullLabel: labels[key],
      value: axes[key] ?? 50,
    }));
  }, [axes]);

  return (
    <div className={cn("relative w-full font-heading", className)}>
      <ChartContainer
        config={chartConfig}
        className={cn(
          "mx-auto aspect-square h-full max-h-[min(300px,calc(100vw-2rem))] w-full max-w-[min(300px,calc(100vw-2rem))] overflow-visible",
          "[&_.recharts-responsive-container]:overflow-visible [&_.recharts-wrapper]:overflow-visible [&_.recharts-surface]:overflow-visible",
          "[&_.recharts-polar-angle-axis-tick_text]:fill-muted-foreground [&_.recharts-polar-angle-axis-tick_text]:font-semibold [&_.recharts-polar-angle-axis-tick_text]:uppercase [&_.recharts-polar-angle-axis-tick_text]:tracking-wide",
        )}
      >
        <RadarChart
          data={chartData}
          margin={
            narrowMobile
              ? { top: 14, right: 18, bottom: 14, left: 18 }
              : { top: 24, right: 32, bottom: 24, left: 32 }
          }
          outerRadius={narrowMobile ? "58%" : "62%"}
        >
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, p) => {
                  const row = p?.[0]?.payload as { fullLabel?: string } | undefined;
                  return row?.fullLabel ?? null;
                }}
              />
            }
          />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: tickFontSize }} />
          <PolarGrid />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            type="number"
          />
          <Radar
            dataKey="value"
            fill="var(--color-value)"
            fillOpacity={0.6}
            stroke="var(--color-value)"
            strokeWidth={1}
            dot={{
              r: 4,
              fillOpacity: 1,
              fill: "var(--color-value)",
            }}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}
