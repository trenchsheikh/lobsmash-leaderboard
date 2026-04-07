"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSupabaseBrowser } from "@/lib/supabase/client";
import type { PairChampionshipRow } from "@/lib/leaderboard";
import {
  averageRadarAxes,
  computeRadarFromProfile,
  neutralRadar,
} from "@/lib/player-radar-scores";
import { computePairTeamShowcase } from "@/lib/pair-team-stats";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { RadarHexagon } from "@/components/radar-hexagon";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: PairChampionshipRow | null;
  pairPlayerMetaById: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
};

function radarFromPlayerRow(row: {
  playstyle: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  experience_level: string | null;
} | null): ReturnType<typeof neutralRadar> {
  if (!row) return neutralRadar();
  const strengths = row.strengths ?? [];
  const weaknesses = row.weaknesses ?? [];
  const playstyle = row.playstyle ?? null;
  const experience_level = row.experience_level ?? null;
  if (!strengths.length && !weaknesses.length && !playstyle?.trim() && !experience_level?.trim()) {
    return neutralRadar();
  }
  return computeRadarFromProfile({
    playstyle,
    strengths,
    weaknesses,
    experience_level: experience_level,
  });
}

export function PairTeamStatsModal({
  open,
  onOpenChange,
  pair,
  pairPlayerMetaById,
}: Props) {
  const supabase = useSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combinedRadar, setCombinedRadar] = useState(() => neutralRadar());
  const [skillLow, setSkillLow] = useState(DEFAULT_SKILL);
  const [skillHigh, setSkillHigh] = useState(DEFAULT_SKILL);
  const [guestLow, setGuestLow] = useState(false);
  const [guestHigh, setGuestHigh] = useState(false);

  const load = useCallback(async () => {
    if (!open || !pair) return;
    setLoading(true);
    setError(null);

    const low = pair.player_low;
    const high = pair.player_high;

    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id, user_id, playstyle, strengths, weaknesses, experience_level")
      .in("id", [low, high]);

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    const byId = new Map((players ?? []).map((r) => [r.id as string, r]));
    const rowL = byId.get(low) ?? null;
    const rowH = byId.get(high) ?? null;

    setGuestLow(!rowL?.user_id);
    setGuestHigh(!rowH?.user_id);

    const rL = radarFromPlayerRow(
      rowL
        ? {
            playstyle: rowL.playstyle as string | null,
            strengths: (rowL.strengths as string[]) ?? [],
            weaknesses: (rowL.weaknesses as string[]) ?? [],
            experience_level: rowL.experience_level as string | null,
          }
        : null,
    );
    const rH = radarFromPlayerRow(
      rowH
        ? {
            playstyle: rowH.playstyle as string | null,
            strengths: (rowH.strengths as string[]) ?? [],
            weaknesses: (rowH.weaknesses as string[]) ?? [],
            experience_level: rowH.experience_level as string | null,
          }
        : null,
    );
    setCombinedRadar(averageRadarAxes(rL, rH));

    const { data: ratL } = await supabase
      .from("player_ratings")
      .select("skill")
      .eq("player_id", low)
      .maybeSingle();
    const { data: ratH } = await supabase
      .from("player_ratings")
      .select("skill")
      .eq("player_id", high)
      .maybeSingle();

    setSkillLow(
      typeof ratL?.skill === "number" && Number.isFinite(ratL.skill)
        ? ratL.skill
        : DEFAULT_SKILL,
    );
    setSkillHigh(
      typeof ratH?.skill === "number" && Number.isFinite(ratH.skill)
        ? ratH.skill
        : DEFAULT_SKILL,
    );

    setLoading(false);
  }, [open, pair, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!pair) return null;

  const metaL = pairPlayerMetaById[pair.player_low];
  const metaH = pairPlayerMetaById[pair.player_high];
  const avgWins =
    pair.sessions_played > 0 ? pair.championship_wins / pair.sessions_played : 0;
  const showcase = computePairTeamShowcase({
    combinedRadar,
    championshipWins: pair.championship_wins,
    sessionsPlayed: pair.sessions_played,
  });
  const avgSkill = (skillLow + skillHigh) / 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,48rem)] w-full max-w-lg overflow-y-auto border-border/80 bg-card p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
          <DialogTitle className="font-heading text-lg">Team together</DialogTitle>
          <DialogDescription className="text-xs">
            Championship pair stats in this league, combined self-reported style, and a simple team index
            from chemistry + court-1 output.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-destructive sm:px-6">{error}</p>
        ) : (
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex shrink-0 gap-1">
                <UserAvatarDisplay
                  name={metaL?.name ?? "—"}
                  username={metaL?.username}
                  avatarUrl={metaL?.avatar_url}
                  size="lg"
                  className="size-[3.25rem] ring-2 ring-primary/15"
                />
                <UserAvatarDisplay
                  name={metaH?.name ?? "—"}
                  username={metaH?.username}
                  avatarUrl={metaH?.avatar_url}
                  size="lg"
                  className="size-[3.25rem] ring-2 ring-primary/15"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-lg font-semibold tracking-tight">{pair.label}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {guestLow ? (
                    <Badge variant="outline">Guest: {metaL?.name ?? "Player"}</Badge>
                  ) : null}
                  {guestHigh ? (
                    <Badge variant="outline">Guest: {metaH?.name ?? "Player"}</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/15 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  In this league (pair)
                </p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  <li>
                    <span className="text-muted-foreground">Sessions together: </span>
                    {pair.sessions_played}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Champ court wins: </span>
                    {pair.championship_wins}
                  </li>
                  <li>
                    <span className="text-muted-foreground">Avg wins / session: </span>
                    {pair.sessions_played > 0 ? avgWins.toFixed(1) : "—"}
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Team index
                </p>
                <p className="font-heading text-4xl font-semibold text-foreground tabular-nums">
                  {showcase.teamIndex}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Style blend ~{showcase.chemistry} · Output ~{showcase.performance}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-center tabular-nums">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Avg squad skill (global)
              </p>
              <p className="font-heading text-2xl font-semibold">{formatDisplayLevel(avgSkill)}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(skillLow)} + {Math.round(skillHigh)} → avg {Math.round(avgSkill)} pts
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Combined self-reported style
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                Average of both players’ onboarding radar (guests use a neutral baseline for missing
                profiles).
              </p>
              <div className="flex justify-center">
                <RadarHexagon axes={combinedRadar} className="max-w-[300px]" />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
