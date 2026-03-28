/** Two-letter initials for avatar fallbacks. */
export function userInitials(name: string | null | undefined, username: string | null | undefined) {
  const s = name?.trim() || username?.trim() || "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}
