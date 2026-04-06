"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSpotlightPairs, buildSpotlightPlayers } from "@/lib/build-league-spotlight";
import type { LeagueFormat } from "@/lib/league-format";
import type { SessionInputMode } from "@/lib/league-format";
import {
  computeDraftDeltas,
  mergeLeaderboardWithDraft,
  mergePairLeaderboardWithDraft,
  type Court1PairWinRow,
  type DraftSessionMeta,
  type GameRow,
} from "@/lib/league-draft-standings-projection";
import type { LeaderboardRow, PairChampionshipRow } from "@/lib/leaderboard";
import {
  chainPreviewSkillDeltasForDrafts,
  type DraftSessionBundle,
  type SessionTeamRow,
} from "@/lib/skill-rating-preview";

export type RosterEntry = {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  isGuest: boolean;
};

type UseLeagueDraftLiveArgs = {
  supabase: SupabaseClient;
  leagueId: string;
  leagueFormat: LeagueFormat;
  leagueResultsMode: SessionInputMode;
  officialLeaderboard: LeaderboardRow[];
  officialPairLeaderboard: PairChampionshipRow[];
  rosterDisplay: RosterEntry[];
  pairPlayerMetaById: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
  /** Base skills from server (roster). */
  rosterSkillByPlayerId: Record<string, number>;
};

export function useLeagueDraftLive(args: UseLeagueDraftLiveArgs) {
  const {
    supabase,
    leagueId,
    leagueFormat,
    leagueResultsMode,
    officialLeaderboard,
    officialPairLeaderboard,
    rosterDisplay,
    pairPlayerMetaById,
    rosterSkillByPlayerId,
  } = args;

  const [tick, setTick] = useState(0);
  const [draftSnapshot, setDraftSnapshot] = useState<{
    draftSessions: DraftSessionMeta[];
    games: GameRow[];
    court1Wins: Court1PairWinRow[];
    sessionTeams: (SessionTeamRow & { session_id: string })[];
    ratedGamesByPlayer: Record<string, number>;
  } | null>(null);

  const rosterByPlayerId = useMemo(() => {
    const m = new Map<
      string,
      { name: string; username: string | null; avatar_url: string | null }
    >();
    for (const p of rosterDisplay) {
      m.set(p.id, { name: p.name, username: p.username, avatar_url: p.avatar_url });
    }
    return m;
  }, [rosterDisplay]);

  const registeredPlayerIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of rosterDisplay) {
      if (!p.isGuest) s.add(p.id);
    }
    return s;
  }, [rosterDisplay]);

  const load = useCallback(async () => {
    const { data: drafts, error: dErr } = await supabase
      .from("sessions")
      .select("id, input_mode, created_at, status")
      .eq("league_id", leagueId)
      .eq("status", "draft")
      .order("created_at", { ascending: true });

    if (dErr || !drafts?.length) {
      setDraftSnapshot(
        drafts?.length === 0
          ? {
              draftSessions: [],
              games: [],
              court1Wins: [],
              sessionTeams: [],
              ratedGamesByPlayer: {},
            }
          : null,
      );
      return;
    }

    const draftSessions: DraftSessionMeta[] = drafts.map((r) => ({
      id: r.id as string,
      input_mode: r.input_mode as string | null,
      created_at: r.created_at as string,
    }));
    const ids = draftSessions.map((s) => s.id);

    const [gamesRes, c1Res, teamsRes, ratingsRes] = await Promise.all([
      supabase.from("games").select("*").in("session_id", ids),
      supabase.from("session_court1_pair_wins").select("*").in("session_id", ids),
      supabase.from("session_teams").select("session_id, sort_order, player_a, player_b").in("session_id", ids),
      supabase
        .from("player_ratings")
        .select("player_id, rated_games")
        .in("player_id", [...registeredPlayerIds]),
    ]);

    const games = (gamesRes.data ?? []) as GameRow[];
    const court1Wins = (c1Res.data ?? []) as Court1PairWinRow[];
    const sessionTeams = (teamsRes.data ?? []) as (SessionTeamRow & { session_id: string })[];

    const ratedGamesByPlayer: Record<string, number> = {};
    for (const row of ratingsRes.data ?? []) {
      ratedGamesByPlayer[row.player_id as string] = row.rated_games as number;
    }
    for (const pid of registeredPlayerIds) {
      if (ratedGamesByPlayer[pid] === undefined) ratedGamesByPlayer[pid] = 0;
    }

    setDraftSnapshot({
      draftSessions,
      games,
      court1Wins,
      sessionTeams,
      ratedGamesByPlayer,
    });
  }, [supabase, leagueId, registeredPlayerIds]);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load, tick]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 12_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`league-draft-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          if (mounted.current) void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, leagueId, load]);

  const rosterRecord = useMemo(() => {
    const o: Record<string, { name: string; username: string | null; avatar_url: string | null }> =
      {};
    for (const p of rosterDisplay) {
      o[p.id] = { name: p.name, username: p.username, avatar_url: p.avatar_url };
    }
    return o;
  }, [rosterDisplay]);

  const merged = useMemo(() => {
    const sessions = draftSnapshot?.draftSessions ?? [];
    if (!draftSnapshot || sessions.length === 0) {
      const spotlightPlayers =
        leagueResultsMode !== "champ_court_only"
          ? buildSpotlightPlayers(officialLeaderboard, rosterByPlayerId, leagueFormat)
          : [];
      const spotlightPairs =
        leagueResultsMode === "champ_court_only"
          ? buildSpotlightPairs(officialPairLeaderboard, pairPlayerMetaById, rosterByPlayerId)
          : [];
      return {
        leaderboard: officialLeaderboard,
        pairLeaderboard: officialPairLeaderboard,
        spotlightPlayers,
        spotlightPairs,
        hasDraftProjection: false,
        skillPreviewDelta: new Map<string, number>(),
      };
    }

    const { byPlayer, pairWins } = computeDraftDeltas({
      draftSessions: draftSnapshot.draftSessions,
      games: draftSnapshot.games,
      court1Wins: draftSnapshot.court1Wins,
    });

    const hasDraftProjection = byPlayer.size > 0 || pairWins.size > 0;

    const leaderboard = mergeLeaderboardWithDraft({
      official: officialLeaderboard,
      byPlayer,
      format: leagueFormat,
      rosterByPlayerId: rosterRecord,
    });

    const pairLeaderboard = mergePairLeaderboardWithDraft({
      official: officialPairLeaderboard,
      pairDraft: pairWins,
      pairPlayerMetaById,
    });

    const spotlightPlayers =
      leagueResultsMode !== "champ_court_only"
        ? buildSpotlightPlayers(leaderboard, rosterByPlayerId, leagueFormat)
        : [];

    const spotlightPairs =
      leagueResultsMode === "champ_court_only"
        ? buildSpotlightPairs(pairLeaderboard, pairPlayerMetaById, rosterByPlayerId)
        : [];

    const bundles: DraftSessionBundle[] = draftSnapshot.draftSessions.map((d) => ({
      id: d.id,
      created_at: d.created_at,
      input_mode: d.input_mode,
      games: draftSnapshot.games.filter((g) => g.session_id === d.id),
      court1Wins: draftSnapshot.court1Wins.filter((c) => c.session_id === d.id),
      sessionTeams: draftSnapshot.sessionTeams
        .filter((t) => t.session_id === d.id)
        .map((t) => ({
          sort_order: t.sort_order,
          player_a: t.player_a,
          player_b: t.player_b,
        })),
    }));

    const baseSkills = { ...rosterSkillByPlayerId };
    const baseRg = { ...draftSnapshot.ratedGamesByPlayer };
    const skillPreviewDelta = chainPreviewSkillDeltasForDrafts(
      bundles,
      baseSkills,
      baseRg,
      registeredPlayerIds,
    );

    return {
      leaderboard,
      pairLeaderboard,
      spotlightPlayers,
      spotlightPairs,
      hasDraftProjection,
      skillPreviewDelta,
    };
  }, [
    draftSnapshot,
    officialLeaderboard,
    officialPairLeaderboard,
    leagueFormat,
    leagueResultsMode,
    pairPlayerMetaById,
    rosterByPlayerId,
    rosterRecord,
    rosterSkillByPlayerId,
    registeredPlayerIds,
  ]);

  const hasDraftSessions = (draftSnapshot?.draftSessions.length ?? 0) > 0;

  return {
    leaderboard: merged.leaderboard,
    pairLeaderboard: merged.pairLeaderboard,
    spotlightPlayers: merged.spotlightPlayers,
    spotlightPairs: merged.spotlightPairs,
    hasDraftProjection: merged.hasDraftProjection,
    hasDraftSessions,
    skillPreviewDelta: merged.skillPreviewDelta,
    refetchDrafts: load,
  };
}
