"use client";

import { useEffect, useMemo, useState } from "react";

import { RadarHexagon } from "@/components/radar-hexagon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  labelForStrength,
  labelForWeakness,
} from "@/lib/onboarding-options";
import { radarAxisLabels, type RadarAxes } from "@/lib/player-radar-scores";
import { cn } from "@/lib/utils";

const SLIDER_KEYS: (keyof RadarAxes)[] = [
  "offense",
  "netPlay",
  "wallsLobs",
  "defense",
  "serveReturn",
  "consistency",
];

export type ProfilePlaystyleRadarPanelProps = {
  baseline: RadarAxes;
  playstyleLabel: string;
  sideLabel: string;
  experienceLabel: string;
  strengths: string[];
  weaknesses: string[];
  className?: string;
};

export function ProfilePlaystyleRadarPanel({
  baseline,
  playstyleLabel,
  sideLabel,
  experienceLabel,
  strengths,
  weaknesses,
  className,
}: ProfilePlaystyleRadarPanelProps) {
  const [tab, setTab] = useState<"profile" | "explore">("profile");
  const [customAxes, setCustomAxes] = useState<RadarAxes>(() => baseline);

  useEffect(() => {
    setCustomAxes(baseline);
  }, [baseline]);

  const displayAxes = tab === "profile" ? baseline : customAxes;

  const axisLabels = useMemo(() => radarAxisLabels(), []);

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-md",
        className,
      )}
    >
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-heading text-xl tracking-tight">Your game</CardTitle>
            <CardDescription className="mt-1 max-w-xl">
              Self-reported style and a radar sketch from your profile. Explore tweaks the chart
              only on this page—your saved profile stays the same.
            </CardDescription>
          </div>
          <div className="inline-flex h-auto min-h-10 flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1.5">
            <Button
              type="button"
              variant={tab === "profile" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-lg"
              onClick={() => setTab("profile")}
            >
              From profile
            </Button>
            <Button
              type="button"
              variant={tab === "explore" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-lg"
              onClick={() => setTab("explore")}
            >
              Adjust
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start">
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Style
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{playstyleLabel || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Preferred side
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{sideLabel || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Experience
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{experienceLabel || "—"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Strengths
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {strengths.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  strengths.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {labelForStrength(s)}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Areas to grow
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {weaknesses.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  weaknesses.map((w) => (
                    <Badge
                      key={w}
                      variant="outline"
                      className="border-amber-400/40 bg-amber-500/10 font-normal dark:border-amber-500/30"
                    >
                      {labelForWeakness(w)}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 lg:items-stretch">
            <div className="relative w-full max-w-[320px] rounded-2xl border border-border/50 bg-muted/15 p-3 ring-1 ring-border/30">
              <RadarHexagon axes={displayAxes} className="max-h-[280px]" />
            </div>

            {tab === "explore" ? (
              <div className="w-full max-w-[320px] space-y-3 lg:max-w-none">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sliders
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomAxes(baseline)}
                  >
                    Reset to profile
                  </Button>
                </div>
                <ul className="space-y-3">
                  {SLIDER_KEYS.map((key) => (
                    <li key={key}>
                      <div className="mb-1 flex justify-between gap-2 text-xs">
                        <span className="font-medium text-foreground">{axisLabels[key]}</span>
                        <span className="tabular-nums text-muted-foreground">{customAxes[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={92}
                        value={customAxes[key]}
                        aria-label={`Adjust ${axisLabels[key]}`}
                        className={cn(
                          "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted",
                          "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm",
                          "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-sm",
                        )}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setCustomAxes((prev) => ({ ...prev, [key]: n }));
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
