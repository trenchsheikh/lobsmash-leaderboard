/**
 * Mirrors `apply_skill_rating_for_session` in
 * `supabase/migrations/20260330100000_player_skill_ratings.sql` for **preview only**
 * (no DB writes). Used for draft sessions before completion.
 */

import {
  ALPHA,
  CHAMP_TEMPERATURE,
  DEFAULT_SKILL,
  K_BASE,
  MARGIN_BETA,
  MARGIN_CAP,
  expectedTeamWinProbability,
} from "@/lib/rating";
import type { Court1PairWinRow, GameRow } from "@/lib/league-draft-standings-projection";

export type SessionTeamRow = {
  sort_order: number;
  player_a: string;
  player_b: string;
};

function skillFor(
  playerId: string,
  skills: Record<string, number>,
): number {
  const s = skills[playerId];
  return typeof s === "number" && Number.isFinite(s) ? s : DEFAULT_SKILL;
}

function ratedGamesFor(playerId: string, ratedGames: Record<string, number>): number {
  const n = ratedGames[playerId];
  return typeof n === "number" && n >= 0 ? n : 0;
}

/** One session’s skill deltas (only registered players). */
export function previewSkillDeltasForSession(args: {
  inputMode: "full" | "champ_court_only";
  games: GameRow[];
  court1Wins: Court1PairWinRow[];
  sessionTeams: SessionTeamRow[];
  /** Working skill snapshot (mutated by caller if chaining). */
  skills: Record<string, number>;
  /** From `player_ratings.rated_games` — updated by caller when chaining. */
  ratedGames: Record<string, number>;
  registeredPlayerIds: Set<string>;
}): Map<string, { delta: number; gamesInc: number }> {
  const out = new Map<string, { delta: number; gamesInc: number }>();

  function add(pid: string, delta: number, gamesInc: number) {
    if (!args.registeredPlayerIds.has(pid)) return;
    const cur = out.get(pid);
    if (!cur) {
      out.set(pid, { delta, gamesInc });
    } else {
      cur.delta += delta;
      cur.gamesInc += gamesInc;
    }
  }

  if (args.inputMode === "full") {
    const sorted = [...args.games].sort((a, b) => {
      if (a.court_number !== b.court_number) return a.court_number - b.court_number;
      return 0;
    });

    for (const g of sorted) {
      const ta = g.team_a_players ?? [];
      const tb = g.team_b_players ?? [];
      let sa = DEFAULT_SKILL;
      if (ta.length > 0) {
        let sum = 0;
        for (const pid of ta) sum += skillFor(pid, args.skills);
        sa = sum / ta.length;
      }
      let sb = DEFAULT_SKILL;
      if (tb.length > 0) {
        let sum = 0;
        for (const pid of tb) sum += skillFor(pid, args.skills);
        sb = sum / tb.length;
      }

      const ea = expectedTeamWinProbability(sa, sb);
      const oa = g.winner === "team_a" ? 1 : 0;
      const surpriseA = oa - ea;
      const margin =
        1 +
        MARGIN_BETA *
          Math.min(
            Math.max(Math.abs(g.team_a_score - g.team_b_score) / MARGIN_CAP, 0),
            1,
          );

      for (const pid of ta) {
        const rg = ratedGamesFor(pid, args.ratedGames);
        const k = K_BASE / (1 + ALPHA * rg);
        const dDelta = k * surpriseA * margin;
        add(pid, dDelta, 1);
      }
      for (const pid of tb) {
        const rg = ratedGamesFor(pid, args.ratedGames);
        const k = K_BASE / (1 + ALPHA * rg);
        const dDelta = k * -surpriseA * margin;
        add(pid, dDelta, 1);
      }
    }
  } else {
    let wTotal = 0;
    for (const sc of args.court1Wins) {
      wTotal += Math.max(0, sc.wins | 0);
    }
    if (wTotal <= 0 || args.sessionTeams.length === 0) {
      return out;
    }

    type PairRow = {
      sort_order: number;
      player_low: string;
      player_high: string;
      wins: number;
      team_skill: number;
      exp_share: number;
    };

    const rows: PairRow[] = args.sessionTeams
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((st) => {
        const low = st.player_a < st.player_b ? st.player_a : st.player_b;
        const high = st.player_a < st.player_b ? st.player_b : st.player_a;
        const winRow = args.court1Wins.find(
          (c) => c.player_low === low && c.player_high === high,
        );
        const wins = winRow?.wins ?? 0;
        const sk =
          (skillFor(st.player_a, args.skills) + skillFor(st.player_b, args.skills)) / 2;
        return {
          sort_order: st.sort_order,
          player_low: low,
          player_high: high,
          wins: Math.max(0, wins),
          team_skill: sk,
          exp_share: 0,
        };
      });

    let sumExp = 0;
    for (const r of rows) {
      sumExp += Math.exp(r.team_skill / CHAMP_TEMPERATURE);
    }
    if (sumExp <= 0) sumExp = 1;

    for (const r of rows) {
      r.exp_share = Math.exp(r.team_skill / CHAMP_TEMPERATURE) / sumExp;
    }

    for (const r of rows) {
      const obsShare = r.wins / wTotal;
      const expShare = r.exp_share;
      for (const pid of [r.player_low, r.player_high]) {
        const rg = ratedGamesFor(pid, args.ratedGames);
        const k = K_BASE / (1 + ALPHA * rg);
        const dDelta = k * (obsShare - expShare);
        add(pid, dDelta, 1);
      }
    }
  }

  return out;
}

/** Apply deltas to working skill/ratedGames maps (for chaining multiple draft sessions). */
export function applyDeltasToWorkingState(
  skills: Record<string, number>,
  ratedGames: Record<string, number>,
  deltas: Map<string, { delta: number; gamesInc: number }>,
) {
  for (const [pid, d] of deltas) {
    skills[pid] = skillFor(pid, skills) + d.delta;
    ratedGames[pid] = ratedGamesFor(pid, ratedGames) + d.gamesInc;
  }
}

export type DraftSessionBundle = {
  id: string;
  created_at: string;
  input_mode: string | null;
  games: GameRow[];
  court1Wins: Court1PairWinRow[];
  sessionTeams: SessionTeamRow[];
};

/**
 * Preview total skill delta per player across draft sessions, chained in `created_at` order
 * (matches sequential completion better than summing isolated session deltas).
 */
export function chainPreviewSkillDeltasForDrafts(
  sessions: DraftSessionBundle[],
  baseSkills: Record<string, number>,
  baseRatedGames: Record<string, number>,
  registeredPlayerIds: Set<string>,
): Map<string, number> {
  const total = new Map<string, number>();
  const skills = { ...baseSkills };
  const ratedGames = { ...baseRatedGames };

  const ordered = [...sessions].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  for (const s of ordered) {
    const mode =
      s.input_mode === "champ_court_only" ? "champ_court_only" : "full";
    const deltas = previewSkillDeltasForSession({
      inputMode: mode,
      games: s.games,
      court1Wins: s.court1Wins,
      sessionTeams: s.sessionTeams,
      skills,
      ratedGames,
      registeredPlayerIds,
    });
    for (const [pid, d] of deltas) {
      total.set(pid, (total.get(pid) ?? 0) + d.delta);
    }
    applyDeltasToWorkingState(skills, ratedGames, deltas);
  }

  return total;
}
