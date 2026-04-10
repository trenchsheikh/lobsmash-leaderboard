"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Users } from "lucide-react";
import { formatSessionDate } from "@/components/league-sessions-list";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sessionStatusDisplayLabel } from "@/lib/session-status-label";
import { labelForPlaystyle } from "@/lib/onboarding-options";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { cn } from "@/lib/utils";

export type LeagueOverviewNextSessionPayload =
  | { kind: "no_player" }
  | {
      kind: "session";
      sessionId: string;
      date: string;
      status: string;
      partner: {
        playerId: string;
        name: string;
        username: string | null;
        avatar_url: string | null;
        isGuest: boolean;
        playstyle: string | null;
        skill: number;
      } | null;
    };

function partnerPlaystyleLevelLine(playstyle: string | null, skill: number): string {
  const style = labelForPlaystyle(playstyle).trim();
  const sk = Number.isFinite(skill) ? skill : DEFAULT_SKILL;
  const lv = formatDisplayLevel(sk);
  if (style && lv !== "—") return `${style} · Lv ${lv}`;
  if (style) return style;
  return `Lv ${lv}`;
}

type Props = {
  leagueId: string;
  payload: LeagueOverviewNextSessionPayload | null;
  onPartnerClick: (playerId: string, isGuest?: boolean) => void;
  onGoToPeople: () => void;
};

export function LeagueOverviewNextSession({
  leagueId,
  payload,
  onPartnerClick,
  onGoToPeople,
}: Props) {
  if (payload == null) return null;

  if (payload.kind === "no_player") {
    return (
      <Card className="border-border/80 border-dashed shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" aria-hidden />
            Your next game
          </CardTitle>
          <CardDescription>
            Link your account to a roster player on the People tab to see upcoming sessions and your
            partner here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="secondary" size="sm" onClick={onGoToPeople}>
            Open People
            <ChevronRight className="ml-1 size-4 opacity-70" aria-hidden />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sessionHref = `/leagues/${leagueId}/sessions/${payload.sessionId}`;
  const dateLabel = formatSessionDate(payload.date);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="size-5 text-primary" aria-hidden />
          Your next game
        </CardTitle>
        <CardDescription>
          Next scheduled session in this league{payload.partner ? " and your assigned partner" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={payload.status === "draft" ? "outline" : "secondary"}>
            {sessionStatusDisplayLabel(payload.status)}
          </Badge>
          <span className="text-sm font-medium text-foreground">{dateLabel}</span>
        </div>

        <Link
          href={sessionHref}
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4",
            "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
          )}
        >
          View session
          <ChevronRight className="size-4 opacity-80" aria-hidden />
        </Link>

        {payload.partner ? (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/25">
            <p className="border-b border-border/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your partner
            </p>
            <button
              type="button"
              onClick={() =>
                onPartnerClick(payload.partner!.playerId, payload.partner!.isGuest)
              }
              className={cn(
                "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <UserAvatarDisplay
                name={payload.partner.name}
                username={payload.partner.username}
                avatarUrl={payload.partner.avatar_url}
                size="default"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-semibold text-foreground">{payload.partner.name}</p>
                {payload.partner.username ? (
                  <p className="truncate text-sm text-muted-foreground">
                    @{payload.partner.username}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Tap to open profile</p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {partnerPlaystyleLevelLine(
                    payload.partner.playstyle,
                    payload.partner.skill,
                  )}
                </p>
              </div>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground/80"
                aria-hidden
              />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pairings aren&apos;t set for you in this session yet, or you&apos;re not on a pair.
            Open the session to check the draw.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
