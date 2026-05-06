/**
 * Call-of-Duty-style rank tiers derived purely from `player_ratings.skill`.
 * Pure function (no DB column added) so the entire rank ladder is editable here
 * without a migration. Tier thresholds align with the display band defined in
 * `lib/rating.ts` (DISPLAY_SKILL_MIN=800, DISPLAY_SKILL_MAX=2200).
 */

export type RankTier = {
  id: "unranked" | "core" | "rise" | "pulse" | "prime" | "elite" | "icon";
  label: string;
  minSkill: number;
  /** Tailwind-friendly accent color used for highlights/glow around the badge. */
  accentClass: string;
  textClass: string;
  /**
   * Metallic "shiny" gradient for the tier label text. Apply alongside
   * `bg-clip-text text-transparent` so the label reads as a polished
   * lime/gold/cyan/etc. wordmark instead of a flat color. Designed with a
   * bright highlight band in the middle to read as a metallic shine.
   */
  shinyClass: string;
  /**
   * Tier-coloured gradient (with matching glow) used for the promotion
   * progress bar so it matches the badge the player currently sits on
   * (e.g. gold bar for a Rise player). Bakes both the gradient and the
   * box-shadow glow into one class string.
   */
  progressClass: string;
  /** Path to the badge PNG (under /public). null for unranked. */
  imageSrc: string | null;
};

// Six-tier ladder: Core → Rise → Pulse → Prime → Elite → Icon. Thresholds are
// evenly spaced 200-pt steps inside the display band (DISPLAY_SKILL_MIN=800,
// DISPLAY_SKILL_MAX=2200) so promotion progress always feels measurable on
// the rank hero progress bar.
export const RANK_TIERS: ReadonlyArray<RankTier> = [
  {
    id: "unranked",
    label: "Unranked",
    minSkill: -Infinity,
    accentClass: "bg-slate-500",
    textClass: "text-slate-200",
    shinyClass:
      "bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400",
    progressClass:
      "bg-gradient-to-r from-slate-500 via-slate-300 to-slate-500 shadow-[0_0_14px_rgba(148,163,184,0.45)]",
    imageSrc: null,
  },
  {
    // Brand-lime + steel: foundation tier with green laurel + tennis-ball pop.
    id: "core",
    label: "Core",
    minSkill: 1000,
    accentClass: "bg-lime-500",
    textClass: "text-lime-100",
    shinyClass:
      "bg-gradient-to-r from-[#5a7a1f] via-[#d8ff96] to-[#5a7a1f]",
    progressClass:
      "bg-gradient-to-r from-[#86E10B] via-[#d8ff96] to-[#86E10B] shadow-[0_0_18px_rgba(190,255,55,0.55)]",
    imageSrc: "/core.png",
  },
  {
    // All-gold rising shield with bright laurels.
    id: "rise",
    label: "Rise",
    minSkill: 1200,
    accentClass: "bg-yellow-500",
    textClass: "text-yellow-100",
    shinyClass:
      "bg-gradient-to-r from-[#7a5402] via-[#fff1a8] to-[#7a5402]",
    progressClass:
      "bg-gradient-to-r from-[#d4a017] via-[#fff1a8] to-[#d4a017] shadow-[0_0_18px_rgba(255,222,97,0.6)]",
    imageSrc: "/rise.png",
  },
  {
    // Electric cyan/blue heartbeat over a steel shield.
    id: "pulse",
    label: "Pulse",
    minSkill: 1400,
    accentClass: "bg-cyan-400",
    textClass: "text-cyan-100",
    shinyClass:
      "bg-gradient-to-r from-[#0c5d8a] via-[#cdf3ff] to-[#0c5d8a]",
    progressClass:
      "bg-gradient-to-r from-[#1ea7c4] via-[#dffaff] to-[#56d6ef] shadow-[0_0_18px_rgba(125,225,250,0.55)]",
    imageSrc: "/pulse.png",
  },
  {
    // Royal violet shield with crystal accents.
    id: "prime",
    label: "Prime",
    minSkill: 1600,
    accentClass: "bg-violet-500",
    textClass: "text-violet-100",
    shinyClass:
      "bg-gradient-to-r from-[#5b1e9f] via-[#e7ccff] to-[#5b1e9f]",
    progressClass:
      "bg-gradient-to-r from-[#7e2ad6] via-[#e7ccff] to-[#7e2ad6] shadow-[0_0_18px_rgba(178,128,255,0.6)]",
    imageSrc: "/prime.png",
  },
  {
    // Vivid gold + emerald gem at the apex of the gold tiers.
    id: "elite",
    label: "Elite",
    minSkill: 1800,
    accentClass: "bg-emerald-500",
    textClass: "text-emerald-100",
    shinyClass:
      "bg-gradient-to-r from-[#876004] via-[#fff5b0] to-[#0e7038]",
    progressClass:
      "bg-gradient-to-r from-[#876004] via-[#fff5b0] to-[#0e7038] shadow-[0_0_20px_rgba(255,222,97,0.5)]",
    imageSrc: "/elite.png",
  },
  {
    // Diamond/silver crown with gold trim — top of the ladder.
    id: "icon",
    label: "Icon",
    minSkill: 2000,
    accentClass: "bg-sky-400",
    textClass: "text-sky-50",
    shinyClass:
      "bg-gradient-to-r from-[#9ba6bd] via-[#ffffff] to-[#a07203]",
    progressClass:
      "bg-gradient-to-r from-[#9ba6bd] via-[#ffffff] to-[#a07203] shadow-[0_0_22px_rgba(220,232,255,0.65)]",
    imageSrc: "/icon.png",
  },
];

export type PlayerRank = {
  tier: RankTier;
  /** Display string e.g. "Rise". */
  display: string;
  /** Where the player sits on the global skill ladder. */
  skill: number;
  /** Threshold the player needs to cross to enter the next tier. */
  nextTierMinSkill: number | null;
  /** Display label of the next tier (e.g. "Pulse"). null at top. */
  nextTierLabel: string | null;
  /** 0..1 progress from current tier floor to next tier floor. */
  progressPct: number;
  /** Skill above current tier floor. Useful for "1280 RR" style copy. */
  ratingInTier: number;
  /** Span of current tier in skill points (used to size progress bar). */
  tierSpan: number;
  /** Skill points still needed to reach the next tier. 0 at the very top. */
  ratingToNextTier: number;
};

function tierForSkill(skill: number): RankTier {
  let chosen = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (skill >= tier.minSkill) chosen = tier;
  }
  return chosen;
}

/**
 * Returns the rank tier + progression info for a given global skill.
 * Used by the profile hero (tier badge + promotion progress bar).
 */
export function rankFromSkill(skill: number, ratedGames: number): PlayerRank {
  const safeSkill = Number.isFinite(skill) ? skill : 1500;
  const isUnranked = ratedGames <= 0;
  const tier = isUnranked ? RANK_TIERS[0] : tierForSkill(safeSkill);

  const tierIndex = RANK_TIERS.findIndex((t) => t.id === tier.id);
  const nextTier = RANK_TIERS[tierIndex + 1] ?? null;

  const tierFloor = tier.minSkill === -Infinity ? 1100 : tier.minSkill;
  const tierCeiling = nextTier ? nextTier.minSkill : tierFloor + 200;
  const tierSpan = Math.max(1, tierCeiling - tierFloor);

  const ratingInTier = Math.max(0, safeSkill - tierFloor);
  const progressPct = Math.max(0, Math.min(1, ratingInTier / tierSpan));

  const display = isUnranked ? "Unranked" : tier.label;

  const ratingToNextTier = nextTier
    ? Math.max(0, nextTier.minSkill - safeSkill)
    : 0;

  return {
    tier,
    display,
    skill: safeSkill,
    nextTierMinSkill: nextTier?.minSkill ?? null,
    nextTierLabel: nextTier?.label ?? null,
    progressPct,
    ratingInTier: Math.round(ratingInTier),
    tierSpan,
    ratingToNextTier: Math.round(ratingToNextTier),
  };
}

/**
 * Chemistry score (0-100) for a partner pairing.
 * Blends:
 *  - Wilson lower bound of win rate (confidence-aware win share)
 *  - Sample-size confidence (saturating at ~20 games)
 *  - Recency bonus (recent activity nudges score up)
 *
 * Used for the Best Partner card. Returns null when there are too few games
 * for the score to be meaningful (caller renders an empty state instead).
 */
export function chemistryScore(input: {
  wins: number;
  losses: number;
  gamesPlayed: number;
  lastPlayedAt?: string | null;
  /** Threshold below which we don't show a chemistry score. */
  minGames?: number;
}): number | null {
  const { wins, losses, gamesPlayed, lastPlayedAt } = input;
  const minGames = input.minGames ?? 4;

  if (gamesPlayed < minGames || wins + losses === 0) return null;

  const n = wins + losses;
  const p = wins / n;
  // Wilson lower bound, z=1.64 (~90% confidence). Stable for small N.
  const z = 1.64;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const wilsonLower = Math.max(0, (center - margin) / denom);

  // Sample-size confidence saturates around 20 games.
  const sampleConfidence = Math.min(1, n / 20);

  // Recency bonus: 1.0 if played in last 14 days, decays to 0 over 90 days.
  let recencyBonus = 0;
  if (lastPlayedAt) {
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    recencyBonus = Math.max(0, 1 - Math.max(0, ageDays - 14) / 76);
  }

  const blended =
    0.65 * wilsonLower * 100 +
    0.2 * sampleConfidence * 100 +
    0.15 * recencyBonus * 100;

  return Math.round(Math.max(0, Math.min(100, blended)));
}

/**
 * "Heat" 1..5 for a rival, used for the Active Rival card badge.
 * Higher when you've played them often *and* lost often *and* recently.
 */
export function rivalHeat(input: {
  losses: number;
  gamesPlayed: number;
  lastMeetingAt?: string | null;
}): 1 | 2 | 3 | 4 | 5 {
  const { losses, gamesPlayed, lastMeetingAt } = input;
  if (gamesPlayed <= 0) return 1;

  const lossShare = losses / gamesPlayed; // 0..1
  const volume = Math.min(1, gamesPlayed / 10); // saturates at 10 meetings
  let recency = 0.5;
  if (lastMeetingAt) {
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(lastMeetingAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    recency = Math.max(0, 1 - ageDays / 60);
  }

  const score = 0.55 * lossShare + 0.25 * volume + 0.2 * recency;
  if (score >= 0.8) return 5;
  if (score >= 0.6) return 4;
  if (score >= 0.4) return 3;
  if (score >= 0.2) return 2;
  return 1;
}

/**
 * Pair Locked progress: how close a duo is to the (display-only) milestone of
 * 20 wins together. Returns 0..1.
 */
export const PAIR_LOCK_THRESHOLD = 20;
export function pairLockProgress(wins: number): number {
  return Math.max(0, Math.min(1, wins / PAIR_LOCK_THRESHOLD));
}
