import { customAlphabet } from "nanoid";

/** Characters used for league reference codes (no I, O, 0, 1). */
export const LEAGUE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LEAGUE_CODE_LENGTH = 8;

const allowedCodeChars = new Set(LEAGUE_CODE_ALPHABET.split(""));

const nano = customAlphabet(LEAGUE_CODE_ALPHABET, LEAGUE_CODE_LENGTH);

export function generateLeagueCode() {
  return nano();
}

/** Normalise user input for comparison (stored codes are uppercase). */
export function normalizeLeagueCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** True if `s` is exactly 8 chars from {@link LEAGUE_CODE_ALPHABET} (case-insensitive). */
export function isValidLeagueInviteCode(s: string): boolean {
  const u = normalizeLeagueCode(s);
  if (u.length !== LEAGUE_CODE_LENGTH) return false;
  return [...u].every((c) => allowedCodeChars.has(c));
}
