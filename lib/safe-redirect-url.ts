import {
  isValidLeagueInviteCode,
  normalizeLeagueCode,
} from "@/lib/league-code";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Same-origin path allowed after auth/onboarding when joining a league.
 * Uses `/join/<league reference code>` (8 chars). Legacy `/join/<uuid>` still parses for redirects only.
 */
export function isSafeJoinRedirectPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/")) return false;
  if (path.includes("//") || path.includes("\\")) return false;
  const firstSegment = path.split("/").filter(Boolean)[0];
  if (firstSegment !== "join") return false;
  const slug = path.split("/").filter(Boolean)[1];
  if (!slug) return false;
  return isValidLeagueInviteCode(slug) || UUID_RE.test(slug);
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
