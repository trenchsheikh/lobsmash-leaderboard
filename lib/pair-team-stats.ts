import type { RadarAxes } from "@/lib/player-radar-scores";
import { meanRadarValue } from "@/lib/player-radar-scores";

/**
 * Single 0–100 “team” showcase for a fixed pair: blends self-reported style (radar)
 * with championship output (avg court-1 wins per session together).
 */
export function computePairTeamShowcase(input: {
  combinedRadar: RadarAxes;
  championshipWins: number;
  sessionsPlayed: number;
}): { teamIndex: number; chemistry: number; performance: number } {
  const chemistry = meanRadarValue(input.combinedRadar);
  const avgWins =
    input.sessionsPlayed > 0 ? input.championshipWins / input.sessionsPlayed : 0;
  // ~4+ wins/session → full performance contribution (champ mode can exceed that)
  const performance = Math.min(100, (avgWins / 4) * 100);
  const teamIndex = Math.round(chemistry * 0.55 + performance * 0.45);
  return {
    teamIndex: Math.min(100, Math.max(0, teamIndex)),
    chemistry: Math.round(chemistry),
    performance: Math.round(performance),
  };
}
