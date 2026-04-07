"use client";

import { RADAR_VERTEX_ORDER, radarAxisLabels, type RadarAxes } from "@/lib/player-radar-scores";
import { cn } from "@/lib/utils";

export type RadarHexagonProps = {
  axes: RadarAxes;
  className?: string;
  /** SVG user-space font size for vertex labels (viewBox 0–100). */
  labelFontSize?: number;
  /** Extra offset beyond outer grid for label placement. */
  labelRadiusPadding?: number;
};

export function RadarHexagon({
  axes,
  className,
  labelFontSize = 3.55,
  labelRadiusPadding = 12,
}: RadarHexagonProps) {
  const labels = radarAxisLabels();
  const order = RADAR_VERTEX_ORDER;
  const n = order.length;
  const cx = 50;
  const cy = 50;
  const r = 38;

  const dataVertices = order.map((key, i) => {
    const angle = (-Math.PI / 2 + (i * 2 * Math.PI) / n) % (2 * Math.PI);
    const v = (axes[key] ?? 50) / 100;
    const r1 = r * v;
    return {
      x: cx + r1 * Math.cos(angle),
      y: cy + r1 * Math.sin(angle),
      key,
      angle,
    };
  });
  const poly = dataVertices.map((p) => `${p.x},${p.y}`).join(" ");

  const gridOuter = order
    .map((_, i) => {
      const angle = (-Math.PI / 2 + (i * 2 * Math.PI) / n) % (2 * Math.PI);
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    })
    .join(" ");

  return (
    <div className={cn("relative font-heading", className)}>
      <svg
        viewBox="0 0 100 100"
        className="h-auto w-full max-w-[280px] overflow-visible"
        aria-hidden
      >
        <g className="text-border/50">
          <polygon
            points={gridOuter}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.4}
          />
          {[0.33, 0.66].map((t) => (
            <polygon
              key={t}
              points={order
                .map((_, i) => {
                  const angle = (-Math.PI / 2 + (i * 2 * Math.PI) / n) % (2 * Math.PI);
                  const rr = r * t;
                  return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
                })
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.22}
              opacity={0.65}
            />
          ))}
        </g>
        <polygon
          points={poly}
          fill="hsl(var(--primary) / 0.14)"
          stroke="hsl(var(--primary))"
          strokeWidth={1.45}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="drop-shadow-[0_0_6px_hsl(var(--primary)/0.35)]"
        />
        {dataVertices.map((p) => (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r={1.75}
            className="fill-amber-500 stroke-primary dark:fill-amber-400"
            strokeWidth={0.5}
          />
        ))}
        {dataVertices.map((p) => {
          const lx = cx + (r + labelRadiusPadding) * Math.cos(p.angle);
          const ly = cy + (r + labelRadiusPadding) * Math.sin(p.angle);
          const anchor =
            Math.abs(Math.cos(p.angle)) < 0.2
              ? "middle"
              : Math.cos(p.angle) > 0
                ? "start"
                : "end";
          return (
            <text
              key={`${p.key}-label`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-muted-foreground font-semibold uppercase tracking-wide"
              style={{ fontSize: labelFontSize }}
            >
              {labels[p.key].split(" / ")[0]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
