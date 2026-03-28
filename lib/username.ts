/** Stored usernames are lowercase a-z, 0-9, underscore. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsernameFormat(normalized: string): string | null {
  if (normalized.length < 3) return "Username must be at least 3 characters.";
  if (normalized.length > 24) return "Username must be at most 24 characters.";
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Use only lowercase letters, numbers, and underscores (no spaces).";
  }
  return null;
}
