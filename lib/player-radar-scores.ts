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

const PLAYSTYLE_BIAS: Record<string, Partial<Record<keyof RadarAxes, number>>> = {
  aggressive_baseliner: { offense: 8 },
  net_rusher: { netPlay: 10, offense: 4 },
  defensive_counter: { defense: 10, consistency: 5 },
  power_hitter: { offense: 12 },
  consistent_patient: { consistency: 12, defense: 4 },
  all_court: { offense: 4, defense: 4, netPlay: 4, wallsLobs: 4, serveReturn: 4, consistency: 4 },
};

/** experience_level values from `EXPERIENCE_OPTIONS` */
const EXPERIENCE_SCALE: Record<string, number> = {
  lt_1y: 40,
  y1_3: 52,
  y3_5: 62,
  gt_5y: 72,
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
  play_styles: string[];
  profile_attributes: Record<string, number>;
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

  const ratings = input.profile_attributes ?? {};
  const asRadar = (rating: number | undefined): number => {
    const r = Number.isFinite(rating) ? Number(rating) : 1;
    const bounded = Math.max(1, Math.min(8, Math.round(r)));
    return 8 + Math.round(((bounded - 1) / 7) * 84);
  };
  axes.serveReturn = asRadar(ratings.serve_return);
  axes.netPlay = asRadar(ratings.net_game);
  axes.offense = asRadar(ratings.power);
  axes.consistency = asRadar(ratings.consistency);
  axes.defense = asRadar(ratings.movement);
  axes.wallsLobs = asRadar(ratings.tactical_iq);

  for (const style of input.play_styles ?? []) {
    const bias = PLAYSTYLE_BIAS[style];
    if (!bias) continue;
    for (const [k, v] of Object.entries(bias)) {
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

/** Average two radars (e.g. fixed pair “together” style chart). */
export function averageRadarAxes(a: RadarAxes, b: RadarAxes): RadarAxes {
  const keys: (keyof RadarAxes)[] = [
    "offense",
    "defense",
    "netPlay",
    "wallsLobs",
    "serveReturn",
    "consistency",
  ];
  const out = {} as RadarAxes;
  for (const k of keys) {
    out[k] = Math.round((a[k] + b[k]) / 2);
  }
  return out;
}

export function meanRadarValue(axes: RadarAxes): number {
  const v = Object.values(axes);
  return v.reduce((s, n) => s + n, 0) / v.length;
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
