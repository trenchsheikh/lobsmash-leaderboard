import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ProfileRatingChart,
  ProfileRatingScaleBar,
  type RatingHistoryPoint,
} from "@/components/profile-rating-chart";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";

type ProfileRatingPanelProps = {
  effectiveSkill: number;
  ratedGames: number;
  history: RatingHistoryPoint[];
  updatedAtIso: string | null;
};

function formatSigned(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${Math.round(n)}`;
  return `${Math.round(n)}`;
}

export function ProfileRatingPanel({
  effectiveSkill,
  ratedGames,
  history,
  updatedAtIso,
}: ProfileRatingPanelProps) {
  const hasHistory = history.length > 0;
  const span =
    hasHistory && history.length >= 2
      ? history[history.length - 1].skill - history[0].skill
      : null;
  const updatedLabel = updatedAtIso
    ? new Date(updatedAtIso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <Card className="overflow-hidden rounded-[1.6rem] border-white/50 bg-card/90 shadow-md backdrop-blur-xl dark:border-white/15 sm:rounded-xl sm:border-border/80 sm:bg-card sm:shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/10">
        <CardTitle className="font-heading text-lg tracking-tight">Level insights</CardTitle>
        <CardDescription className="max-w-2xl">
          Global skill from completed sessions across all leagues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] lg:items-start">
          <div className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Level
                </p>
                <p className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatDisplayLevel(effectiveSkill)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {Math.round(effectiveSkill)} skill
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rated games
                </p>
                <p className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
                  {ratedGames}
                </p>
                {span !== null ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="tabular-nums">Δ {formatSigned(span)}</span>
                    <span className="text-muted-foreground"> full history</span>
                  </p>
                ) : hasHistory ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">Baseline snapshot</p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">—</p>
                )}
              </div>
              {updatedLabel ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Last update
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{updatedLabel}</p>
                </div>
              ) : null}
            </div>

            {!hasHistory ? (
              <p className="text-sm text-muted-foreground">
                History appears after your first completed rated session (starts at {DEFAULT_SKILL}).
              </p>
            ) : null}
          </div>

          <ProfileRatingScaleBar skill={effectiveSkill} className="lg:pt-1" />
        </div>

        {hasHistory && history.length >= 1 ? (
          <div className="min-w-0 border-t border-border/50 pt-6">
            <ProfileRatingChart history={history} presentation="embedded" />
          </div>
        ) : null}

        {hasHistory ? (
          <table className="sr-only">
            <caption>Skill rating history</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Skill</th>
                <th scope="col">Rated games</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
                <tr key={`${row.recorded_at}-${row.rated_games}-${i}`}>
                  <td>{new Date(row.recorded_at).toISOString()}</td>
                  <td>{Math.round(row.skill)}</td>
                  <td>{row.rated_games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </CardContent>

      {hasHistory && history.length >= 2 ? (
        <CardFooter className="flex-col items-start gap-1 border-t border-border/50 bg-muted/10 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            {span !== null && span > 0 ? (
              <>
                <TrendingUp className="size-4 text-chart-1" aria-hidden />
                <span>
                  Up <span className="tabular-nums">{formatSigned(span)}</span> skill over your full
                  history
                </span>
              </>
            ) : span !== null && span < 0 ? (
              <>
                <TrendingDown className="size-4 text-muted-foreground" aria-hidden />
                <span>
                  Down <span className="tabular-nums">{formatSigned(span)}</span> skill over your full
                  history
                </span>
              </>
            ) : span === 0 ? (
              <>
                <Minus className="size-4 text-muted-foreground" aria-hidden />
                <span>Flat between your first and last snapshot</span>
              </>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            Tip: use the window buttons on the chart to focus recent rating updates.
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
