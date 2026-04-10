/** First whitespace-delimited token for pair labels (e.g. "Sarah Chen" → "Sarah"). */
export function displayFirstName(fullName: string): string {
  const t = fullName?.trim() ?? "";
  if (!t) return "Player";
  const first = t.split(/\s+/)[0];
  return first || "Player";
}
