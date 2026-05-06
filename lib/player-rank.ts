/**
 * Call-of-Duty-style rank tiers derived purely from `player_ratings.skill`.
 * Pure function (no DB column added) so the entire rank ladder is editable here
 * without a migration. Tier thresholds align with the display band defined in
 * `lib/rating.ts` (DISPLAY_SKILL_MIN=800, DISPLAY_SKILL_MAX=2200).
 */

export type RankTier = {
  id: "unranked" | "bronze" | "silver" | "gold" | "diamond" | "top250";
  label: string;
  minSkill: number;
  /** Tailwind-friendly accent color used for highlights/glow around the badge. */
  accentClass: string;
  textClass: string;
  /**
   * Metallic "shiny" gradient for the tier label text. Apply alongside
   * `bg-clip-text text-transparent` so the label reads as a polished
   * gold/silver/diamond/etc. wordmark instead of a flat color. Designed
   * with a bright highlight band in the middle to read as a metallic shine.
   */
  shinyClass: string;
  /**
   * Tier-coloured gradient (with matching glow) used for the promotion
   * progress bar so it matches the badge the player currently sits on
   * (e.g. gold bar for a Gold player). Bakes both the gradient and the
   * box-shadow glow into one class string.
   */
  progressClass: string;
  /** Path to the badge PNG (under /public). null for unranked. */
  imageSrc: string | null;
};

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
    id: "bronze",
    label: "Bronze",
    minSkill: 1100,
    accentClass: "bg-amber-700",
    textClass: "text-amber-200",
    shinyClass:
      "bg-gradient-to-r from-[#7a3a18] via-[#f6cfa3] to-[#7a3a18]",
    progressClass:
      "bg-gradient-to-r from-[#a05a2c] via-[#f6cfa3] to-[#a05a2c] shadow-[0_0_18px_rgba(246,176,90,0.55)]",
    imageSrc: "/bronze.png",
  },
  {
    id: "silver",
    label: "Silver",
    minSkill: 1300,
    accentClass: "bg-slate-400",
    textClass: "text-slate-100",
    shinyClass:
      "bg-gradient-to-r from-[#8a96a3] via-[#f6f8fb] to-[#8a96a3]",
    progressClass:
      "bg-gradient-to-r from-[#9aa6b3] via-[#f5f7fa] to-[#9aa6b3] shadow-[0_0_18px_rgba(226,232,240,0.6)]",
    imageSrc: "/silver.png",
  },
  {
    id: "gold",
    label: "Gold",
    minSkill: 1500,
    accentClass: "bg-yellow-500",
    textClass: "text-yellow-100",
    shinyClass:
      "bg-gradient-to-r from-[#a07203] via-[#fff1a8] to-[#a07203]",
    progressClass:
      "bg-gradient-to-r from-[#d4a017] via-[#fff1a8] to-[#d4a017] shadow-[0_0_18px_rgba(255,222,97,0.6)]",
    imageSrc: "/gold.png",
  },
  {
    id: "diamond",
    label: "Diamond",
    minSkill: 1750,
    accentClass: "bg-cyan-400",
    textClass: "text-cyan-100",
    shinyClass:
      "bg-gradient-to-r from-[#1ea7c4] via-[#dffaff] to-[#56d6ef]",
    progressClass:
      "bg-gradient-to-r from-[#1ea7c4] via-[#dffaff] to-[#56d6ef] shadow-[0_0_18px_rgba(125,225,250,0.55)]",
    imageSrc: "/diamond.png",
  },
  {
    id: "top250",
    label: "Top 250",
    minSkill: 2000,
    accentClass: "bg-rose-500",
    textClass: "text-rose-100",
    shinyClass:
      "bg-gradient-to-r from-[#a82358] via-[#ffd1ff] to-[#7e2ad6]",
    progressClass:
      "bg-gradient-to-r from-[#a82358] via-[#ffd1ff] to-[#7e2ad6] shadow-[0_0_18px_rgba(214,128,255,0.55)]",
    imageSrc: "/top250.png",
  },
];

export type PlayerRank = {
  tier: RankTier;
  /** Display string e.g. "Gold". */
  display: string;
  /** Where the player sits on the global skill ladder. */
  skill: number;
  /** Threshold the player needs to cross to enter the next tier. */
  nextTierMinSkill: number | null;
  /** Display label of the next tier (e.g. "Diamond"). null at top. */
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
