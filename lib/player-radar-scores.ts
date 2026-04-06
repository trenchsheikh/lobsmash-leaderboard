import type { LeagueFormat } from "@/lib/league-format";

/** Six axes for the self-reported radar (0–100). */
export type RadarAxes = {
  offense: number;
  defense: number;
  netPlay: number;
  wallsLobs: number;
  serveReturn: number;
  consistency: number;
};

const AXIS_LABELS: Record<keyof RadarAxes, string> = {
  offense: "Attack / finish",
  defense: "Defense / resets",
  netPlay: "Net / hands",
  wallsLobs: "Walls & lobs",
  serveReturn: "Serve & return",
  consistency: "Rally patience",
};

export function radarAxisLabels(): typeof AXIS_LABELS {
  return AXIS_LABELS;
}

/** Strength option values → axis boosts (sum applied then clamped). */
const STRENGTH_WEIGHTS: Record<string, Partial<Record<keyof RadarAxes, number>>> = {
  bandeja: { offense: 12, netPlay: 8 },
  vibora: { offense: 14, wallsLobs: 6 },
  smash_finish: { offense: 16 },
  defensive_glass: { defense: 14, wallsLobs: 8 },
  lob_quality: { wallsLobs: 14, offense: 4 },
  net_presence: { netPlay: 16 },
  court_speed: { defense: 8, consistency: 6 },
  serve_rhythm: { serveReturn: 14 },
  tactical_patience: { consistency: 14 },
  back_wall_reading: { wallsLobs: 12, defense: 6 },
};

const WEAKNESS_WEIGHTS: Record<string, Partial<Record<keyof RadarAxes, number>>> = {
  back_glass_panic: { wallsLobs: -10, defense: -6 },
  bandeja_consistency: { offense: -8, netPlay: -4 },
  smash_defense: { defense: -10, wallsLobs: -4 },
  corner_traffic: { defense: -8, wallsLobs: -6 },
  lob_defense: { wallsLobs: -10, defense: -6 },
  net_duels: { netPlay: -12 },
  transition_net: { netPlay: -8, consistency: -4 },
  serve_return: { serveReturn: -12 },
  side_wall_reads: { wallsLobs: -10 },
  consistency_rallies: { consistency: -14 },
};

const PLAYSTYLE_BIAS: Record<string, Partial<Record<keyof RadarAxes, number>>> = {
  net_presser: { netPlay: 14, offense: 8 },
  wall_grinder: { wallsLobs: 12, defense: 10, consistency: 6 },
  lob_tactician: { wallsLobs: 14, consistency: 10 },
  counter_striker: { defense: 12, offense: 8 },
  all_court_mixer: { offense: 6, defense: 6, netPlay: 6, wallsLobs: 6 },
  padel_rookie: {},
};

/** experience_level values from `EXPERIENCE_OPTIONS` */
const EXPERIENCE_SCALE: Record<string, number> = {
  first_steps: 42,
  club_social: 52,
  league_club: 62,
  tournament_hunter: 72,
  /** legacy keys */
  beginner: 42,
  improver: 52,
  intermediate: 58,
  advanced: 66,
  competitive: 72,
};

function clamp(n: number, lo = 8, hi = 92): number {
  return Math.round(Math.min(hi, Math.max(lo, n)));
}

/**
 * Deterministic radar from onboarding fields (self-reported).
 * Not a performance stat — visualization of how they describe their game.
 */
export function computeRadarFromProfile(input: {
  playstyle: string | null;
  strengths: string[];
  weaknesses: string[];
  experience_level: string | null;
}): RadarAxes {
  const exp = input.experience_level?.trim();
  const base: number =
    (exp && typeof EXPERIENCE_SCALE[exp] === "number" ? EXPERIENCE_SCALE[exp] : null) ??
    52;

  const axes: Record<keyof RadarAxes, number> = {
    offense: base,
    defense: base,
    netPlay: base,
    wallsLobs: base,
    serveReturn: base,
    consistency: base,
  };

  const ps = input.playstyle?.trim();
  if (ps && PLAYSTYLE_BIAS[ps]) {
    for (const [k, v] of Object.entries(PLAYSTYLE_BIAS[ps])) {
      const key = k as keyof RadarAxes;
      if (typeof v === "number") axes[key] += v;
    }
  }

  for (const s of input.strengths ?? []) {
    const w = STRENGTH_WEIGHTS[s];
    if (!w) continue;
    for (const [k, v] of Object.entries(w)) {
      const key = k as keyof RadarAxes;
      if (typeof v === "number") axes[key] += v;
    }
  }

  for (const w of input.weaknesses ?? []) {
    const cut = WEAKNESS_WEIGHTS[w];
    if (!cut) continue;
    for (const [k, v] of Object.entries(cut)) {
      const key = k as keyof RadarAxes;
      if (typeof v === "number") axes[key] += v;
    }
  }

  return {
    offense: clamp(axes.offense),
    defense: clamp(axes.defense),
    netPlay: clamp(axes.netPlay),
    wallsLobs: clamp(axes.wallsLobs),
    serveReturn: clamp(axes.serveReturn),
    consistency: clamp(axes.consistency),
  };
}

/** Radar vertex order for SVG (starting top, clockwise). */
export const RADAR_VERTEX_ORDER: (keyof RadarAxes)[] = [
  "offense",
  "netPlay",
  "wallsLobs",
  "defense",
  "consistency",
  "serveReturn",
];

/** Placeholder when profile fields are missing */
export function neutralRadar(): RadarAxes {
  return {
    offense: 50,
    defense: 50,
    netPlay: 50,
    wallsLobs: 50,
    serveReturn: 50,
    consistency: 50,
  };
}

export function formatLeagueRankLine(
  format: LeagueFormat,
  row: {
    total_points: number;
    total_wins: number;
    total_games: number;
    sessions_played: number;
    court1_wins: number;
  },
): string {
  if (format === "summit") {
    return `${row.total_wins} wins · ${row.sessions_played} sessions`;
  }
  return `${row.total_points} pts · ${row.total_wins}W / ${row.total_games}G · C1 ${row.court1_wins}`;
}
