/**
 * Rich Web Share / clipboard copy for league join links (`/join/<code>`).
 */

export type LeagueInviteRosterLine = {
  /** e.g. `Ada Lovelace (@ada)` or `Guest player` */
  display: string;
  /** Playtomic-style level from global skill, or null */
  levelLabel: string | null;
};

export function shareTitleForLeagueInvite(leagueName: string): string {
  const t = leagueName.trim() || "League";
  return `LobSmash league — ${t}`;
}

export function buildLeagueInviteShareBody(input: {
  leagueName: string;
  formatLabel: string;
  refCode: string;
  /** Roster players with optional global rating line */
  rosterLines?: LeagueInviteRosterLine[];
  /** Dashboard: pending join row vs normal member */
  context?: "member_share" | "pending_share";
}): string {
  const name = input.leagueName.trim() || "League";
  const headline = name.toUpperCase();
  const lines: string[] = [];

  lines.push(`🏆 LOBSMASH LEAGUE — ${headline}`);
  lines.push(`🏷️ ${input.formatLabel.trim()}`);
  lines.push(`🔑 Code: ${input.refCode.trim()}`);
  lines.push("");

  if (input.context === "pending_share") {
    lines.push("⏳ You have a pending join request for this league.");
    lines.push("");
  }

  const roster = input.rosterLines?.filter((r) => r.display.trim()) ?? [];
  if (roster.length > 0) {
    lines.push("📋 Roster (global level)");
    for (const r of roster) {
      const lv = r.levelLabel?.trim();
      const rating = lv ? ` (${lv})` : "";
      lines.push(`✅ ${r.display.trim()}${rating}`);
    }
    lines.push("");
  }

  lines.push("New players request to join on LobSmash — an organiser approves.");
  lines.push("");
  lines.push("Tap the link to open the invite 👇");

  return lines.join("\n");
}
