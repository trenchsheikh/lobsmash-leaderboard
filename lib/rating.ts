/** Mirrors SQL in `supabase/migrations/20260330100000_player_skill_ratings.sql`. */

export const DEFAULT_SKILL = 1500;
export const ELO_SCALE = 400;
export const K_BASE = 32;
export const ALPHA = 0.05;
export const CHAMP_TEMPERATURE = 200;
export const MARGIN_BETA = 0.15;
export const MARGIN_CAP = 8;

/** Internal skill band mapped to Playtomic-style 0–7 (half steps). */
export const DISPLAY_SKILL_MIN = 800;
export const DISPLAY_SKILL_MAX = 2200;

export function skillForPlayer(
  playerId: string,
  skillsByPlayerId: Record<string, number>,
): number {
  const s = skillsByPlayerId[playerId];
  return typeof s === "number" && Number.isFinite(s) ? s : DEFAULT_SKILL;
}

export function averageTeamSkill(
  playerIds: string[],
  skillsByPlayerId: Record<string, number>,
): number {
  if (playerIds.length === 0) return DEFAULT_SKILL;
  let sum = 0;
  for (const id of playerIds) {
    sum += skillForPlayer(id, skillsByPlayerId);
  }
  return sum / playerIds.length;
}

/** Probability team A wins (logistic / Elo), given team-average skills. */
export function expectedTeamWinProbability(
  teamASkill: number,
  teamBSkill: number,
): number {
  return 1 / (1 + Math.pow(10, (teamBSkill - teamASkill) / ELO_SCALE));
}

export function expectedWinForSides(
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  skillsByPlayerId: Record<string, number>,
): { teamA: number; teamB: number } {
  const sa = averageTeamSkill(teamAPlayerIds, skillsByPlayerId);
  const sb = averageTeamSkill(teamBPlayerIds, skillsByPlayerId);
  const pA = expectedTeamWinProbability(sa, sb);
  return { teamA: pA, teamB: 1 - pA };
}

/** Softmax shares over pair strengths (championship-court-only model). */
export function expectedChampShares(teamSkills: number[]): number[] {
  if (teamSkills.length === 0) return [];
  const exps = teamSkills.map((s) => Math.exp(s / CHAMP_TEMPERATURE));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

export function skillToDisplayLevel(skill: number): number {
  const t =
    (skill - DISPLAY_SKILL_MIN) / (DISPLAY_SKILL_MAX - DISPLAY_SKILL_MIN);
  const raw = Math.max(0, Math.min(1, t)) * 7;
  return Math.round(raw * 2) / 2;
}

export function formatPercent(probability: number, fractionDigits = 0): string {
  if (!Number.isFinite(probability)) return "—";
  const p = Math.max(0, Math.min(1, probability)) * 100;
  return `${p.toFixed(fractionDigits)}%`;
}

export function formatDisplayLevel(skill: number): string {
  const lv = skillToDisplayLevel(skill);
  return lv.toFixed(1);
}
