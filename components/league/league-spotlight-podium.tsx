"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { cn } from "@/lib/utils";

export type SpotlightPlayer = {
  rank: 1 | 2 | 3;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  statLeft: { label: string; value: string | number };
  statRight: { label: string; value: string | number };
};

export type SpotlightPair = {
  rank: 1 | 2 | 3;
  label: string;
  p1: { name: string; username: string | null; avatarUrl: string | null };
  p2: { name: string; username: string | null; avatarUrl: string | null };
  statLeft: { label: string; value: string | number };
  statRight: { label: string; value: string | number };
};

type Props =
  | {
      variant: "players";
      players: SpotlightPlayer[];
      /** Use with in-page anchor navigation. Omit if `onFullTableClick` is set. */
      fullStandingsHref?: string;
      /** Switch to standings tab / scroll (e.g. league tabs). Omit if `fullStandingsHref` is set. */
      onFullTableClick?: () => void;
    }
  | {
      variant: "pairs";
      pairs: SpotlightPair[];
      fullStandingsHref?: string;
      onFullTableClick?: () => void;
    };

export function LeagueSpotlightPodium(props: Props) {
  const hasData =
    props.variant === "players" ? props.players.length > 0 : props.pairs.length > 0;

  if (!hasData) {
    return (
      <section
        className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-sm backdrop-blur-sm dark:bg-card/80"
        aria-labelledby="spotlight-heading"
      >
        <h2 id="spotlight-heading" className="font-heading text-lg font-semibold tracking-tight">
          Standings spotlight
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Play and complete sessions to see the top three here.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-3xl border border-border/60 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-6 dark:bg-card/80"
      aria-labelledby="spotlight-heading"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Standings
          </p>
          <h2 id="spotlight-heading" className="font-heading text-lg font-semibold tracking-tight">
            Top 3
          </h2>
        </div>
        {props.onFullTableClick ? (
          <button
            type="button"
            onClick={props.onFullTableClick}
            className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Full table
          </button>
        ) : (
          <Link
            href={props.fullStandingsHref ?? "#full-standings"}
            className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Full table
          </Link>
        )}
      </div>

      {props.variant === "players" ? (
        <div
          className={cn(
            "grid gap-2 sm:gap-4",
            props.players.length === 1 && "mx-auto max-w-xs grid-cols-1",
            props.players.length === 2 && "mx-auto max-w-lg grid-cols-2",
            props.players.length >= 3 && "grid-cols-3",
          )}
        >
          {props.players.map((p) => (
            <PlayerPillar key={p.rank} player={p} />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-2 sm:gap-4",
            props.pairs.length === 1 && "mx-auto max-w-xs grid-cols-1",
            props.pairs.length === 2 && "mx-auto max-w-lg grid-cols-2",
            props.pairs.length >= 3 && "grid-cols-3",
          )}
        >
          {props.pairs.map((pair) => (
            <PairPillar key={`${pair.rank}-${pair.label}`} pair={pair} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerPillar({ player }: { player: SpotlightPlayer }) {
  const isFirst = player.rank === 1;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center rounded-2xl border bg-background/80 px-2 py-4 text-center dark:bg-background/40",
        isFirst
          ? "border-primary/35 ring-1 ring-primary/20 shadow-md"
          : "border-border/50 shadow-sm",
      )}
    >
      {isFirst ? (
        <Trophy className="mb-1 size-5 text-primary" aria-hidden />
      ) : (
        <span className="mb-1 font-heading text-lg font-bold tabular-nums text-muted-foreground">
          {player.rank}
        </span>
      )}
      <UserAvatarDisplay
        name={player.name}
        username={player.username}
        avatarUrl={player.avatarUrl}
        size="lg"
        className={cn(isFirst && "ring-2 ring-primary/25")}
      />
      <p className="mt-2 w-full truncate px-0.5 text-sm font-semibold leading-tight">{player.name}</p>
      {player.username ? (
        <p className="truncate text-xs text-muted-foreground">@{player.username}</p>
      ) : (
        <span className="h-4" aria-hidden />
      )}
      <div className="mt-3 grid w-full grid-cols-2 gap-1 border-t border-border/50 pt-3">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {player.statLeft.label}
          </p>
          <p className="text-sm font-semibold tabular-nums">{player.statLeft.value}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {player.statRight.label}
          </p>
          <p className="text-sm font-semibold tabular-nums">{player.statRight.value}</p>
        </div>
      </div>
    </div>
  );
}

function PairPillar({ pair }: { pair: SpotlightPair }) {
  const isFirst = pair.rank === 1;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center rounded-2xl border bg-background/80 px-2 py-4 text-center dark:bg-background/40",
        isFirst
          ? "border-primary/35 ring-1 ring-primary/20 shadow-md"
          : "border-border/50 shadow-sm",
      )}
    >
      {isFirst ? (
        <Trophy className="mb-1 size-5 text-primary" aria-hidden />
      ) : (
        <span className="mb-1 font-heading text-lg font-bold tabular-nums text-muted-foreground">
          {pair.rank}
        </span>
      )}
      <div className="flex shrink-0 justify-center gap-1">
        <UserAvatarDisplay
          name={pair.p1.name}
          username={pair.p1.username}
          avatarUrl={pair.p1.avatarUrl}
          size="default"
          className="size-11 sm:size-12"
        />
        <UserAvatarDisplay
          name={pair.p2.name}
          username={pair.p2.username}
          avatarUrl={pair.p2.avatarUrl}
          size="default"
          className="size-11 sm:size-12"
        />
      </div>
      <p className="mt-2 line-clamp-2 w-full px-0.5 text-xs font-semibold leading-tight sm:text-sm">
        {pair.label}
      </p>
      <div className="mt-3 grid w-full grid-cols-2 gap-1 border-t border-border/50 pt-3">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {pair.statLeft.label}
          </p>
          <p className="text-sm font-semibold tabular-nums">{pair.statLeft.value}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {pair.statRight.label}
          </p>
          <p className="text-sm font-semibold tabular-nums">{pair.statRight.value}</p>
        </div>
      </div>
    </div>
  );
}
