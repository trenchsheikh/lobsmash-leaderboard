import {
  Card,
  CardContent,
  CardDescription,
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
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Skill rating</CardTitle>
        <CardDescription>
          Global padel skill from completed sessions (shared across leagues). Updates when sessions
          are completed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-6 gap-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Display level
                </p>
                <p className="mt-1 font-heading text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatDisplayLevel(effectiveSkill)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {Math.round(effectiveSkill)} skill
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rated games
                </p>
                <p className="mt-1 font-heading text-4xl font-semibold tabular-nums tracking-tight">
                  {ratedGames}
                </p>
                {span !== null ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="tabular-nums">Δ {formatSigned(span)}</span>
                    <span className="text-muted-foreground"> over chart</span>
                  </p>
                ) : hasHistory ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">Baseline snapshot</p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">—</p>
                )}
              </div>
              {updatedLabel ? (
                <div className="min-w-[10rem]">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Last update
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{updatedLabel}</p>
                </div>
              ) : null}
            </div>

            {hasHistory && history.length >= 2 ? (
              <ProfileRatingChart history={history} />
            ) : hasHistory ? (
              <p className="text-sm text-muted-foreground">
                Complete more rated sessions to see your skill trend over time.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your rating history appears after your first completed session that updates global
                skill (starts at {DEFAULT_SKILL}).
              </p>
            )}
          </div>

          <ProfileRatingScaleBar skill={effectiveSkill} className="lg:pt-1" />
        </div>

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
    </Card>
  );
}
