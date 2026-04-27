"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { sendFriendRequestToUserId } from "@/app/actions/friends";
import { useSupabaseBrowser } from "@/lib/supabase/client";
import {
  labelForExperience,
  labelForPlaystyle,
  labelForSide,
} from "@/lib/onboarding-options";
import {
  computeRadarFromProfile,
  formatLeagueRankLine,
  neutralRadar,
} from "@/lib/player-radar-scores";
import { RadarHexagon } from "@/components/radar-hexagon";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import type { LeagueFormat } from "@/lib/league-format";
import type { SessionInputMode } from "@/lib/league-format";
import type { RatingHistoryPoint } from "@/components/profile-rating-chart";
import { ProfileRatingChart } from "@/components/profile-rating-chart";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string | null;
  leagueId: string;
  leagueFormat: LeagueFormat;
  leagueResultsMode: SessionInputMode;
  currentUserId: string;
};

export function PlayerProfileAnalyticsModal({
  open,
  onOpenChange,
  playerId,
  leagueId,
  leagueFormat,
  leagueResultsMode,
  currentUserId,
}: Props) {
  const supabase = useSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [playStyles, setPlayStyles] = useState<string[]>([]);
  const [profileAttributes, setProfileAttributes] = useState<Record<string, number>>({});
  const [preferredSide, setPreferredSide] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [skill, setSkill] = useState<number>(DEFAULT_SKILL);
  const [ratedGames, setRatedGames] = useState(0);
  const [ratingUpdatedAt, setRatingUpdatedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<RatingHistoryPoint[]>([]);
  const [leagueStats, setLeagueStats] = useState<{
    total_points: number;
    total_wins: number;
    total_games: number;
    sessions_played: number;
    court1_wins: number;
  } | null>(null);
  const [pairRank, setPairRank] = useState<{
    championship_wins: number;
    sessions_played: number;
    partnerName: string | null;
  } | null>(null);
  const [friendship, setFriendship] = useState<
    "none" | "pending_out" | "pending_in" | "accepted" | "self"
  >("none");
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!playerId || !open) return;
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const { data: playerRow, error: pErr } = await supabase
        .from("players")
        .select(
          "id, user_id, play_styles, profile_attributes, preferred_side, experience_level",
        )
        .eq("id", playerId)
        .maybeSingle();

      if (pErr || !playerRow) {
        if (!silent) {
          setError(pErr?.message ?? "Could not load player.");
          setLoading(false);
        }
        return;
      }

      const uid = playerRow.user_id as string | null;
      if (!uid) {
        if (!silent) {
          setError("This guest player has no profile.");
          setLoading(false);
        }
        return;
      }

    setTargetUserId(uid);
    if (uid === currentUserId) {
      setFriendship("self");
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("name, username, avatar_url")
      .eq("id", uid)
      .maybeSingle();

    setName((userRow?.name as string)?.trim() ?? "Player");
    setUsername((userRow?.username as string)?.trim() ?? null);
    setAvatarUrl((userRow?.avatar_url as string)?.trim() ?? null);
    setPlayStyles((playerRow.play_styles as string[]) ?? []);
    setProfileAttributes(
      (playerRow.profile_attributes as Record<string, number> | null) ?? {},
    );
    setPreferredSide((playerRow.preferred_side as string) ?? null);
    setExperienceLevel((playerRow.experience_level as string) ?? null);

    const { data: ratingRow } = await supabase
      .from("player_ratings")
      .select("skill, rated_games, updated_at")
      .eq("player_id", playerId)
      .maybeSingle();

    if (ratingRow) {
      setSkill(ratingRow.skill as number);
      setRatedGames(ratingRow.rated_games as number);
      setRatingUpdatedAt((ratingRow.updated_at as string) ?? null);
    } else {
      setSkill(DEFAULT_SKILL);
      setRatedGames(0);
      setRatingUpdatedAt(null);
    }

    const { data: histRows } = await supabase
      .from("player_rating_history")
      .select("recorded_at, skill, rated_games")
      .eq("player_id", playerId)
      .order("recorded_at", { ascending: true })
      .limit(200);

    setHistory(
      (histRows ?? []).map((h) => ({
        recorded_at: h.recorded_at as string,
        skill: h.skill as number,
        rated_games: h.rated_games as number,
      })),
    );

    const { data: statsRow } = await supabase
      .from("player_stats")
      .select(
        "total_points, total_wins, total_games, sessions_played, court1_wins",
      )
      .eq("league_id", leagueId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (statsRow) {
      setLeagueStats({
        total_points: statsRow.total_points as number,
        total_wins: statsRow.total_wins as number,
        total_games: statsRow.total_games as number,
        sessions_played: (statsRow.sessions_played as number) ?? 0,
        court1_wins: statsRow.court1_wins as number,
      });
    } else {
      setLeagueStats(null);
    }

    if (leagueResultsMode === "champ_court_only") {
      const { data: pairRows } = await supabase
        .from("pair_championship_stats")
        .select("player_low, player_high, championship_wins, sessions_played")
        .eq("league_id", leagueId);

      const relevant = (pairRows ?? []).filter(
        (r) => r.player_low === playerId || r.player_high === playerId,
      );

      let best: (typeof relevant)[0] | null = null;
      for (const r of relevant) {
        if (!best || (r.championship_wins as number) > (best.championship_wins as number)) {
          best = r;
        }
      }
      if (best) {
        const other =
          best.player_low === playerId ? best.player_high : best.player_low;
        const { data: otherP } = await supabase
          .from("players")
          .select("name, user_id")
          .eq("id", other as string)
          .maybeSingle();
        const ouid = otherP?.user_id as string | null | undefined;
        const { data: otherU } = ouid
          ? await supabase.from("users").select("username").eq("id", ouid).maybeSingle()
          : { data: null };
        const un = (otherU?.username as string | null)?.trim();
        const partnerName =
          un && un.length > 0 ? `@${un}` : (otherP?.name as string)?.trim() ?? "Partner";
        setPairRank({
          championship_wins: best.championship_wins as number,
          sessions_played: (best.sessions_played as number) ?? 0,
          partnerName,
        });
      } else {
        setPairRank(null);
      }
    } else {
      setPairRank(null);
    }

    const { data: friendRows } = await supabase
      .from("friendships")
      .select("id, status, requested_by, user_a, user_b")
      .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`);

    const row = (friendRows ?? []).find(
      (f) =>
        (f.user_a === uid && f.user_b === currentUserId) ||
        (f.user_b === uid && f.user_a === currentUserId),
    );

    if (row) {
      if (row.status === "accepted") setFriendship("accepted");
      else if (row.requested_by === currentUserId) setFriendship("pending_out");
      else setFriendship("pending_in");
    } else if (uid !== currentUserId) {
      setFriendship("none");
    }

      if (!silent) setLoading(false);
    },
    [playerId, open, supabase, leagueId, leagueResultsMode, currentUserId],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!open || !playerId) return;
    const intervalMs = 18_000;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open, playerId, load]);

  const radarDisplay =
    playStyles.length ||
    Object.keys(profileAttributes).length ||
    experienceLevel
      ? computeRadarFromProfile({
          play_styles: playStyles,
          profile_attributes: profileAttributes,
          experience_level: experienceLevel,
        })
      : neutralRadar();

  async function onAddFriend() {
    if (!targetUserId) return;
    setAdding(true);
    const res = await sendFriendRequestToUserId(targetUserId);
    setAdding(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Friend request sent");
    setFriendship("pending_out");
    void load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(100dvh,48rem)] w-full max-w-lg flex-col overflow-hidden border-border/80 bg-card p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
          <DialogTitle className="font-heading text-lg">Player profile</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            <span className="block sm:inline">
              Self-reported style and global skill from completed sessions.
            </span>{" "}
            <span className="hidden sm:inline">
              League row includes completed sessions only; live in-progress sessions on the league can
              update the preview.
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Spinner className="size-5" />
            Loading…
          </div>
        ) : error ? (
          <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-destructive sm:px-6">
            {error}
          </p>
        ) : (
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatarDisplay
                  name={name}
                  username={username}
                  avatarUrl={avatarUrl}
                  size="lg"
                  className="size-[4.5rem] shrink-0 ring-2 ring-primary/20"
                />
                <div className="min-w-0">
                  <p className="font-heading text-xl font-semibold tracking-tight">{name}</p>
                  {username ? (
                    <p className="font-mono text-sm text-muted-foreground">@{username}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {friendship === "self" ? (
                      <Badge variant="secondary">You</Badge>
                    ) : friendship === "accepted" ? (
                      <Badge variant="secondary">Friends</Badge>
                    ) : friendship === "pending_out" ? (
                      <Badge variant="outline">Request sent</Badge>
                    ) : friendship === "pending_in" ? (
                      <Badge variant="outline">Request pending</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={adding}
                        onClick={() => void onAddFriend()}
                      >
                        {adding ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <UserPlus className="size-3.5" />
                        )}
                        Add friend
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-right tabular-nums">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Global skill
                </p>
                <p className="font-heading text-3xl font-semibold text-foreground">
                  {formatDisplayLevel(skill)}
                </p>
                <p className="text-xs text-muted-foreground">{Math.round(skill)} pts</p>
                <p className="mt-1 text-xs text-muted-foreground">{ratedGames} rated games</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  In this league
                </p>
                {leagueStats ? (
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {formatLeagueRankLine(leagueFormat, leagueStats)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No completed stats in this league yet.</p>
                )}
              </div>
              {leagueResultsMode === "champ_court_only" && pairRank ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Best pair (this league)
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {pairRank.championship_wins} champ wins · {pairRank.sessions_played} sessions
                    {pairRank.partnerName ? (
                      <span className="text-muted-foreground"> · with {pairRank.partnerName}</span>
                    ) : null}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Self-reported style
                </p>
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li>
                    <span className="text-muted-foreground">Playstyle: </span>
                    {labelForPlaystyle(playStyles[0] ?? null)}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Side: </span>
                    {labelForSide(preferredSide)}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Experience: </span>
                    {labelForExperience(experienceLevel)}
                  </li>
                </ul>
                {playStyles.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Play styles</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                      {playStyles.map((s) => (
                        <li key={s}>{labelForPlaystyle(s)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="flex w-full justify-center lg:items-start lg:justify-end lg:pt-0.5">
                <RadarHexagon axes={radarDisplay} />
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/10 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rating history
              </p>
              {history.length > 0 ? (
                <ProfileRatingChart
                  history={history}
                  className="w-full max-w-none [&_svg]:max-h-[180px]"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No rating history yet.</p>
              )}
              {ratingUpdatedAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last update: {new Date(ratingUpdatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
