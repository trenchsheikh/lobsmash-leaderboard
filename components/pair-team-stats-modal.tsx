"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useSupabaseBrowser } from "@/lib/supabase/client";
import type { PairChampionshipRow } from "@/lib/leaderboard";
import type { LeagueFormat } from "@/lib/league-format";
import {
  labelForExperience,
  labelForPlaystyle,
  labelForSide,
  labelForStrength,
  labelForWeakness,
} from "@/lib/onboarding-options";
import {
  averageRadarAxes,
  computeRadarFromProfile,
  formatLeagueRankLine,
  neutralRadar,
} from "@/lib/player-radar-scores";
import { computePairTeamShowcase } from "@/lib/pair-team-stats";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";
import { cn } from "@/lib/utils";
import { displayFirstName } from "@/lib/display-name";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PairTeamModalSection = "team" | "low" | "high";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: PairChampionshipRow | null;
  pairPlayerMetaById: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
  leagueId: string;
  leagueFormat: LeagueFormat;
  initialSection: PairTeamModalSection;
};

type PlayerRow = {
  id: string;
  user_id: string | null;
  playstyle: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  preferred_side: string | null;
  experience_level: string | null;
};

function radarFromPlayerRow(row: PlayerRow | null): ReturnType<typeof neutralRadar> {
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
    experience_level,
  });
}

export function PairTeamStatsModal({
  open,
  onOpenChange,
  pair,
  pairPlayerMetaById,
  leagueId,
  leagueFormat,
  initialSection,
}: Props) {
  const supabase = useSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<PairTeamModalSection>("team");
  const [rowLow, setRowLow] = useState<PlayerRow | null>(null);
  const [rowHigh, setRowHigh] = useState<PlayerRow | null>(null);
  const [combinedRadar, setCombinedRadar] = useState(() => neutralRadar());
  const [skillLow, setSkillLow] = useState(DEFAULT_SKILL);
  const [skillHigh, setSkillHigh] = useState(DEFAULT_SKILL);
  const [guestLow, setGuestLow] = useState(false);
  const [guestHigh, setGuestHigh] = useState(false);
  const [leagueStatsLow, setLeagueStatsLow] = useState<{
    total_points: number;
    total_wins: number;
    total_games: number;
    sessions_played: number;
    court1_wins: number;
  } | null>(null);
  const [leagueStatsHigh, setLeagueStatsHigh] = useState<{
    total_points: number;
    total_wins: number;
    total_games: number;
    sessions_played: number;
    court1_wins: number;
  } | null>(null);

  const loadCore = useCallback(async () => {
    if (!open || !pair) return;
    setLoading(true);
    setError(null);
    setLeagueStatsLow(null);
    setLeagueStatsHigh(null);

    async function fetchLeagueStats(playerId: string) {
      const { data: statsRow } = await supabase
        .from("player_stats")
        .select("total_points, total_wins, total_games, sessions_played, court1_wins")
        .eq("league_id", leagueId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (!statsRow) return null;
      return {
        total_points: statsRow.total_points as number,
        total_wins: statsRow.total_wins as number,
        total_games: statsRow.total_games as number,
        sessions_played: (statsRow.sessions_played as number) ?? 0,
        court1_wins: statsRow.court1_wins as number,
      };
    }

    const low = pair.player_low;
    const high = pair.player_high;

    const { data: players, error: pErr } = await supabase
      .from("players")
      .select(
        "id, user_id, playstyle, strengths, weaknesses, preferred_side, experience_level",
      )
      .in("id", [low, high]);

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    const byId = new Map((players ?? []).map((r) => [r.id as string, r as PlayerRow]));
    const rowL = byId.get(low) ?? null;
    const rowH = byId.get(high) ?? null;

    setRowLow(rowL);
    setRowHigh(rowH);
    setGuestLow(!rowL?.user_id);
    setGuestHigh(!rowH?.user_id);

    const rL = radarFromPlayerRow(rowL);
    const rH = radarFromPlayerRow(rowH);
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

    const gl = !rowL?.user_id;
    const gh = !rowH?.user_id;
    const [sL, sH] = await Promise.all([
      gl ? Promise.resolve(null) : fetchLeagueStats(low),
      gh ? Promise.resolve(null) : fetchLeagueStats(high),
    ]);
    setLeagueStatsLow(sL);
    setLeagueStatsHigh(sH);

    setLoading(false);
  }, [open, pair, supabase, leagueId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (open && pair) {
      setActiveSection(initialSection);
    }
  }, [open, pair?.player_low, pair?.player_high, initialSection]);

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

  const tabLowLabel = displayFirstName(metaL?.name ?? "Player");
  const tabHighLabel = displayFirstName(metaH?.name ?? "Player");

  function renderPlayerPanel(which: "low" | "high") {
    const row = which === "low" ? rowLow : rowHigh;
    const meta = which === "low" ? metaL : metaH;
    const guest = which === "low" ? guestLow : guestHigh;
    const skill = which === "low" ? skillLow : skillHigh;
    const leagueStats = which === "low" ? leagueStatsLow : leagueStatsHigh;

    if (guest || !row?.user_id) {
      return (
        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {meta?.name ?? "This player"} is a guest or has no linked profile, so there is no individual
          stats view.
        </div>
      );
    }

    const radar = radarFromPlayerRow(row);
    const strengths = row.strengths ?? [];
    const weaknesses = row.weaknesses ?? [];

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatarDisplay
              name={meta?.name ?? "—"}
              username={meta?.username}
              avatarUrl={meta?.avatar_url}
              size="lg"
              className="size-[4.5rem] shrink-0 ring-2 ring-primary/20"
            />
            <div className="min-w-0">
              <p className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {meta?.name ?? "Player"}
              </p>
              {meta?.username ? (
                <p className="break-all font-mono text-sm text-muted-foreground">@{meta.username}</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-right tabular-nums">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Global skill
            </p>
            <p className="font-heading text-3xl font-semibold text-foreground">
              {formatDisplayLevel(skill)}
            </p>
            <p className="text-sm text-muted-foreground">{Math.round(skill)} pts</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            In this league
          </p>
          {leagueStats ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {formatLeagueRankLine(leagueFormat, leagueStats)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No completed stats in this league yet.</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Self-reported style
            </p>
            <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
              <li>
                <span className="text-muted-foreground">Playstyle: </span>
                {labelForPlaystyle(row.playstyle)}
              </li>
              <li>
                <span className="text-muted-foreground">Side: </span>
                {labelForSide(row.preferred_side)}
              </li>
              <li>
                <span className="text-muted-foreground">Experience: </span>
                {labelForExperience(row.experience_level)}
              </li>
            </ul>
            {strengths.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Strengths</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-foreground">
                  {strengths.map((s) => (
                    <li key={s}>{labelForStrength(s)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {weaknesses.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-400/90">Working on</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-foreground">
                  {weaknesses.map((w) => (
                    <li key={w}>{labelForWeakness(w)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex justify-center lg:justify-end">
            <RadarHexagon axes={radar} className="max-w-[280px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,52rem)] max-h-[min(92vh,52rem)] min-h-0 w-full max-w-lg flex-col overflow-hidden border-border/80 bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
          <DialogTitle className="font-heading text-lg">Team together</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Championship pair stats in this league, combined style radar, and team skill rating. Use the
            tabs to compare each player.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Spinner className="size-5" />
            Loading…
          </div>
        ) : error ? (
          <p className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center text-sm text-destructive sm:px-6">
            {error}
          </p>
        ) : (
          <Tabs
            value={activeSection}
            onValueChange={(v) => setActiveSection(v as PairTeamModalSection)}
            className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col"
          >
            <div className="shrink-0 border-b border-border/50 px-4 pt-3 sm:px-6">
              <TabsList className="mb-3 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
                <TabsTrigger value="team" className="flex-1 sm:flex-none">
                  Team
                </TabsTrigger>
                <TabsTrigger value="low" disabled={guestLow} className="flex-1 sm:flex-none">
                  {guestLow ? `${tabLowLabel} (guest)` : tabLowLabel}
                </TabsTrigger>
                <TabsTrigger value="high" disabled={guestHigh} className="flex-1 sm:flex-none">
                  {guestHigh ? `${tabHighLabel} (guest)` : tabHighLabel}
                </TabsTrigger>
              </TabsList>
            </div>

            <div
              className={cn(
                "min-h-0 min-w-0 flex-1 basis-0 overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-6",
                "[scrollbar-gutter:stable]",
                "[scrollbar-width:thin]",
                "[scrollbar-color:var(--border)_transparent]",
                "[&::-webkit-scrollbar]:w-2",
                "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
              )}
            >
              <TabsContent value="team" className="mt-0 flex flex-col gap-6 focus-visible:outline-none">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded-full outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => !guestLow && setActiveSection("low")}
                      disabled={guestLow}
                    >
                      <UserAvatarDisplay
                        name={metaL?.name ?? "—"}
                        username={metaL?.username}
                        avatarUrl={metaL?.avatar_url}
                        size="lg"
                        className="size-[3.25rem] ring-2 ring-primary/15"
                      />
                    </button>
                    <button
                      type="button"
                      className="rounded-full outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => !guestHigh && setActiveSection("high")}
                      disabled={guestHigh}
                    >
                      <UserAvatarDisplay
                        name={metaH?.name ?? "—"}
                        username={metaH?.username}
                        avatarUrl={metaH?.avatar_url}
                        size="lg"
                        className="size-[3.25rem] ring-2 ring-primary/15"
                      />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
                      {pair.label}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tap an avatar to open that player&apos;s tab.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      In this league (pair)
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
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
                  <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Team skill rating
                    </p>
                    <p className="font-heading text-4xl font-semibold text-foreground tabular-nums">
                      {showcase.teamIndex}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Blends self-reported chemistry (~{showcase.chemistry}) with court-1 output (~
                      {showcase.performance}) for this pair in this league.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-center tabular-nums">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Average global skill (both players)
                  </p>
                  <p className="font-heading text-2xl font-semibold text-foreground">
                    {formatDisplayLevel(avgSkill)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(skillLow)} + {Math.round(skillHigh)} → average {Math.round(avgSkill)} pts
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Combined self-reported style
                  </p>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    Average of both players&apos; onboarding radar. Guests use a neutral baseline when
                    profile fields are missing.
                  </p>
                  <div className="flex justify-center">
                    <RadarHexagon axes={combinedRadar} className="max-w-[300px]" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="low" className="mt-0 focus-visible:outline-none">
                {renderPlayerPanel("low")}
              </TabsContent>

              <TabsContent value="high" className="mt-0 focus-visible:outline-none">
                {renderPlayerPanel("high")}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
