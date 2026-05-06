import { Card, CardContent } from "@/components/ui/card";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { rivalHeat } from "@/lib/player-rank";
import { formLossClass, formWinClass, profileCardShell } from "@/lib/profile-styles";
import { cn } from "@/lib/utils";

type Props = {
  rival: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    winsForPlayer: number;
    lossesForPlayer: number;
    gamesPlayed: number;
    currentStreak: number;
    lastMeetingAt: string | null;
    /** Most recent N H2H results (newest first), each from the player's POV. */
    recentH2H: Array<{ played_at: string; won: boolean }>;
  } | null;
};

/**
 * "ACTIVE RIVAL" — opponent the player has lost to most. Shows H2H, recent
 * match strip vs them, and a Heat 1-5 indicator from frequency + recency.
 */
export function ProfileActiveRivalCard({ rival }: Props) {
  if (!rival) {
    return (
      <Card className={profileCardShell}>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active rival
          </p>
          <p className="text-sm text-muted-foreground">
            No standout rival yet. Play more competitive matches to find one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const heat = rivalHeat({
    losses: rival.lossesForPlayer,
    gamesPlayed: rival.gamesPlayed,
    lastMeetingAt: rival.lastMeetingAt,
  });

  const ordered = [...rival.recentH2H].slice(0, 8).reverse();
  const displayName = rival.name?.trim() || rival.username || "Rival";

  return (
    <Card className={profileCardShell}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active rival
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-rose-700 dark:text-rose-300">
            Heat {heat}/5
          </span>
        </div>

        <div className="flex items-center gap-3">
          <UserAvatarDisplay
            name={rival.name}
            username={rival.username}
            avatarUrl={rival.avatarUrl}
            className="size-12 ring-2 ring-rose-500/30"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-semibold leading-tight">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {rival.gamesPlayed} meetings
              {rival.currentStreak > 0 ? ` · ${rival.currentStreak}-win run` : null}
              {rival.currentStreak < 0 ? ` · ${-rival.currentStreak}-loss run` : null}
            </p>
          </div>
          <div className="flex shrink-0 items-baseline gap-2 text-right">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-lime-600 dark:text-lime-400">
                You
              </p>
              <p className="font-heading text-xl font-semibold tabular-nums">
                {rival.winsForPlayer}
              </p>
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400">
                Them
              </p>
              <p className="font-heading text-xl font-semibold tabular-nums">
                {rival.lossesForPlayer}
              </p>
            </div>
          </div>
        </div>

        {ordered.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {ordered.map((r) => (
              <span
                key={r.played_at}
                className={cn(
                  "inline-flex h-5 w-6 items-center justify-center rounded-md text-[0.6rem] font-bold leading-none ring-1 ring-black/10",
                  r.won ? formWinClass : formLossClass,
                )}
                aria-label={r.won ? "Win" : "Loss"}
                title={new Date(r.played_at).toLocaleDateString()}
              >
                {r.won ? "W" : "L"}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
