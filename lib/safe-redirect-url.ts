import {
  isValidLeagueInviteCode,
  normalizeLeagueCode,
} from "@/lib/league-code";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSafePathPrefix(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.includes("//") || path.includes("\\")) return false;
  return true;
}

/**
 * Same-origin path allowed after auth/onboarding when joining a league.
 * Uses `/join/<league reference code>` (8 chars). Legacy `/join/<uuid>` still parses for redirects only.
 */
export function isSafeJoinRedirectPath(path: string | null | undefined): path is string {
  if (!path || !isSafePathPrefix(path)) return false;
  const firstSegment = path.split("/").filter(Boolean)[0];
  if (firstSegment !== "join") return false;
  const slug = path.split("/").filter(Boolean)[1];
  if (!slug) return false;
  return isValidLeagueInviteCode(slug) || UUID_RE.test(slug);
}

/** `/friendly/invite/<uuid>` only (preview + join flow). */
export function isSafeFriendlyInviteRedirectPath(path: string): boolean {
  if (!isSafePathPrefix(path)) return false;
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 3) return false;
  if (parts[0] !== "friendly" || parts[1] !== "invite" || !parts[2]) return false;
  return UUID_RE.test(parts[2]);
}

/** Deep link to a league session after sign-in (e.g. from `/game/<id>`). */
export function isSafeLeagueSessionRedirectPath(path: string): boolean {
  if (!isSafePathPrefix(path)) return false;
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 4) return false;
  if (parts[0] !== "leagues" || parts[2] !== "sessions" || !parts[1] || !parts[3]) return false;
  return UUID_RE.test(parts[1]) && UUID_RE.test(parts[3]);
}

/**
 * Same-origin paths allowed as `redirect_url` after sign-in / sign-up / onboarding.
 * Covers league join, friendly invite, and league session deep links.
 */
export function isSafePostAuthRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  return (
    isSafeJoinRedirectPath(path) ||
    isSafeFriendlyInviteRedirectPath(path) ||
    isSafeLeagueSessionRedirectPath(path)
  );
}

export function joinPathFromLeagueCode(code: string): `/join/${string}` {
  return `/join/${normalizeLeagueCode(code)}`;
}

/** League code or legacy invite UUID after `/join/`. */
export function joinSlugFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "join" || !parts[1]) return null;
  return parts[1];
}

export function leagueCodeFromJoinPath(path: string): string | null {
  const slug = joinSlugFromPath(path);
  if (!slug) return null;
  if (isValidLeagueInviteCode(slug)) return normalizeLeagueCode(slug);
  return null;
}

/** Legacy bookmark: full UUID in path. */
export function inviteUuidFromJoinPath(path: string): string | null {
  const slug = joinSlugFromPath(path);
  if (!slug || !UUID_RE.test(slug)) return null;
  return slug;
}
