import { DEFAULT_SKILL, formatDisplayLevel, skillForPlayer } from "@/lib/rating";

export type MatchKind = "competitive" | "friendly";

export type LeagueSessionShareInput = {
  matchKind: MatchKind;
  /** YYYY-MM-DD from session.date */
  sessionDate: string;
  /** ISO string or null */
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  restrictionNote: string | null;
  numCourts: number;
  skillsByPlayerId: Record<string, number>;
  /** Player ids in lineup order (up to numCourts * 4) */
  playerIdsInOrder: string[];
  playerDisplayNameById: Record<string, string>;
  sessionUrl: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** For `<input type="datetime-local" />` from DB `timestamptz`. */
export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local value "YYYY-MM-DDTHH:mm" -> local Date */
export function parseDatetimeLocalValue(value: string): Date | null {
  const t = value.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

type WhenFields = Pick<
  LeagueSessionShareInput,
  "sessionDate" | "scheduledAt" | "durationMinutes"
>;

/** Plain date/time line for ShareButton `time` (no leading emoji). */
export function formatSessionWhenPlain(input: WhenFields): string {
  const dur =
    input.durationMinutes != null && input.durationMinutes > 0
      ? ` (${input.durationMinutes}min)`
      : "";

  const raw = input.scheduledAt?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
      const dayNum = d.getDate();
      const month = d.toLocaleDateString(undefined, { month: "long" });
      const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      return `${weekday} ${dayNum} ${month}, ${time}${dur}`;
    }
  }

  const dateOnly = input.sessionDate.trim();
  if (dateOnly) {
    const parts = dateOnly.split("-").map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const y = parts[0]!;
      const mo = parts[1]!;
      const da = parts[2]!;
      const dd = new Date(y, mo - 1, da);
      const weekday = dd.toLocaleDateString(undefined, { weekday: "long" });
      const month = dd.toLocaleDateString(undefined, { month: "long" });
      return `${weekday} ${da} ${month}${dur}`;
    }
  }
  return `Session${dur}`;
}

function formatCalendarLine(input: LeagueSessionShareInput): string {
  return `📅 ${formatSessionWhenPlain(input)}`;
}

/** Skill range for roster players (ShareButton `level`). */
export function formatSessionLevelRange(
  skillsByPlayerId: Record<string, number>,
  playerIds: string[],
): string {
  const skills = playerIds
    .map((id) => skillsByPlayerId[id])
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  const vals = skills.length > 0 ? skills : [DEFAULT_SKILL];
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  if (mn === mx) return formatDisplayLevel(mn);
  return `${formatDisplayLevel(mn)} - ${formatDisplayLevel(mx)}`;
}

/**
 * Playtomic-style multi-line message for WhatsApp / clipboard.
 */
export function buildLeagueSessionShareText(input: LeagueSessionShareInput): string {
  const lines: string[] = [];

  lines.push(formatCalendarLine(input));

  if (input.location?.trim()) {
    lines.push(`📍 ${input.location.trim()}`);
  }

  lines.push(`📊 Level ${formatSessionLevelRange(input.skillsByPlayerId, input.playerIdsInOrder)}`);

  if (input.restrictionNote?.trim()) {
    lines.push(`🚻 ${input.restrictionNote.trim()}`);
  }

  const cap = Math.max(0, input.numCourts * 4);

  for (let i = 0; i < cap; i++) {
    const id = input.playerIdsInOrder[i];
    if (id) {
      const name = input.playerDisplayNameById[id]?.trim() || "Player";
      const sk = formatDisplayLevel(skillForPlayer(id, input.skillsByPlayerId));
      lines.push(`✅ ${name} (${sk})`);
    } else {
      lines.push("⚪ ??");
    }
  }

  lines.push("");
  lines.push(input.sessionUrl.trim());

  const kind =
    input.matchKind === "friendly"
      ? "Friendly — global skill rating not affected."
      : "Competitive — global skill rating applies when completed.";
  lines.push("");
  lines.push(kind);

  return lines.join("\n");
}
