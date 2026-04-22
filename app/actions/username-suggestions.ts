"use server";

import { requireUser } from "@/lib/auth/profile";
import { validateUsernameFormat } from "@/lib/username";

// Fun padel-flavored vocabulary. Keep entries short so combinations stay
// under the 24 char limit from `users_username_lower_unique`.
const PADEL_WORDS_A = [
  "smash",
  "lob",
  "bandeja",
  "vibora",
  "topspin",
  "rally",
  "slice",
  "chiquita",
  "bajada",
  "rulo",
  "ace",
  "net",
  "court",
  "padel",
  "glass",
  "cage",
  "spin",
  "volley",
  "remate",
  "globo",
  "dropshot",
  "backspin",
] as const;

const PADEL_WORDS_B = [
  "ninja",
  "beast",
  "guru",
  "king",
  "queen",
  "legend",
  "wizard",
  "scout",
  "bandit",
  "pro",
  "maestro",
  "machine",
  "boss",
  "captain",
  "hero",
  "hunter",
  "phantom",
  "rebel",
  "squad",
  "monster",
  "rocket",
  "striker",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function makeCandidate(): string {
  const a = pick(PADEL_WORDS_A);
  const b = pick(PADEL_WORDS_B);
  const r = Math.random();
  if (r < 0.45) return `${a}_${b}`;
  if (r < 0.75) return `${a}${b}`;
  const n = Math.floor(Math.random() * 90) + 10; // 10..99
  return Math.random() < 0.5 ? `${a}_${b}${n}` : `${a}${n}`;
}

/**
 * Generate up to `count` fun padel-themed usernames that are currently
 * available. Uses `check_username_availability` (SECURITY DEFINER) so the
 * check sees every row regardless of RLS, matching the final write-time guard.
 */
export async function suggestUsernames(
  count = 3,
  exclude: string[] = [],
): Promise<string[]> {
  const { supabase } = await requireUser();

  const target = Math.max(1, Math.min(10, count));
  const skip = new Set(exclude.map((x) => x.trim().toLowerCase()));
  const out: string[] = [];
  const seen = new Set<string>();

  const MAX_ATTEMPTS = 40;
  for (let i = 0; i < MAX_ATTEMPTS && out.length < target; i++) {
    const cand = makeCandidate();
    if (seen.has(cand) || skip.has(cand)) continue;
    seen.add(cand);
    if (validateUsernameFormat(cand)) continue;

    const { data, error } = await supabase.rpc(
      "check_username_availability",
      { p_username: cand },
    );
    if (error) continue;
    if (data === "available") out.push(cand);
  }

  return out;
}
