import { Card, CardContent } from "@/components/ui/card";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { PAIR_LOCK_THRESHOLD, chemistryScore, pairLockProgress } from "@/lib/player-rank";
import { profileCardShell } from "@/lib/profile-styles";
import { cn } from "@/lib/utils";

type Props = {
  partner: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    wins: number;
    losses: number;
    gamesPlayed: number;
    currentStreak: number;
    lastPlayedAt: string | null;
  } | null;
};

/**
 * "BEST PARTNER" — top duo by wins, with chemistry score, win streak, and
 * progress toward the symbolic Pair Locked milestone (20 wins together).
 */
export function ProfileBestPartnerCard({ partner }: Props) {
  if (!partner) {
    return (
      <Card className={profileCardShell}>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Best partner
          </p>
          <p className="text-sm text-muted-foreground">
            Play more competitive matches with a partner to unlock chemistry.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chem = chemistryScore({
    wins: partner.wins,
    losses: partner.losses,
    gamesPlayed: partner.gamesPlayed,
    lastPlayedAt: partner.lastPlayedAt,
  });
  const lockProgress = pairLockProgress(partner.wins);
  const winsLeft = Math.max(0, PAIR_LOCK_THRESHOLD - partner.wins);
  const winRatePct = partner.gamesPlayed > 0
    ? Math.round((partner.wins / partner.gamesPlayed) * 100)
    : 0;
  const displayName = partner.name?.trim() || partner.username || "Partner";

  return (
    <Card className={profileCardShell}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Best partner
          </p>
          {chem !== null ? (
            <span className="rounded-full bg-lime-500/15 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-lime-700 dark:text-lime-300">
              chemistry · {chem}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
              chemistry · pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <UserAvatarDisplay
            name={partner.name}
            username={partner.username}
            avatarUrl={partner.avatarUrl}
            className="size-12 ring-2 ring-lime-500/30"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-semibold leading-tight">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {partner.wins}–{partner.losses} together · {winRatePct}% win rate
              {partner.currentStreak > 0 ? ` · ${partner.currentStreak}-win streak` : null}
              {partner.currentStreak < 0 ? ` · ${-partner.currentStreak}-loss streak` : null}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>
              {partner.wins} / {PAIR_LOCK_THRESHOLD} to <span className="text-foreground/80">Pair Locked</span>
            </span>
            <span className="font-mono normal-case tracking-normal text-muted-foreground">
              {winsLeft === 0 ? "locked" : `${winsLeft} wins left`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-500 transition-all",
                lockProgress >= 1 && "shadow-[0_0_12px_rgba(132,204,22,0.55)]",
              )}
              style={{ width: `${Math.round(lockProgress * 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
