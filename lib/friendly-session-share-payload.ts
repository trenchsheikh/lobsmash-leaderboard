import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOpenMatchShareBody,
  shareTitleForOpenMatch,
  type OpenMatchShareSlotLine,
} from "@/lib/open-match-share-text";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";

export type FriendlySessionShareMeta = {
  id: string;
  title: string | null;
  starts_at: string | null;
  match_kind: string;
  capacity: number;
};

/**
 * Build share title + multiline body for Web Share (roster, levels, schedule) for one or more sessions.
 */
export async function getFriendlySessionSharePayloads(
  supabase: SupabaseClient,
  sessions: FriendlySessionShareMeta[],
): Promise<Map<string, { shareTitle: string; shareText: string }>> {
  const out = new Map<string, { shareTitle: string; shareText: string }>();
  if (sessions.length === 0) return out;

  const sessionIds = sessions.map((s) => s.id);

  const { data: rosterRows } = await supabase
    .from("friendly_session_roster")
    .select("session_id, user_id, slot_index")
    .in("session_id", sessionIds)
    .order("slot_index", { ascending: true });

  const roster = rosterRows ?? [];
  const userIds = [...new Set(roster.map((r) => r.user_id as string))];

  let userRows: { id: string; name: string | null; username: string | null }[] = [];
  if (userIds.length > 0) {
    const { data } = await supabase.from("users").select("id, name, username").in("id", userIds);
    userRows = data ?? [];
  }

  let playerByUserId = new Map<string, string>();
  let skillByPlayerId = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: playerRows } = await supabase
      .from("players")
      .select("id, user_id")
      .in("user_id", userIds);
    playerByUserId = new Map(
      (playerRows ?? []).map((p) => [p.user_id as string, p.id as string]),
    );
    const playerIds = [...playerByUserId.values()];
    if (playerIds.length > 0) {
      const { data: ratingRows } = await supabase
        .from("player_ratings")
        .select("player_id, skill")
        .in("player_id", playerIds);
      skillByPlayerId = new Map(
        (ratingRows ?? []).map((row) => [row.player_id as string, row.skill as number]),
      );
    }
  }

  const userById = new Map(userRows.map((u) => [u.id as string, u]));

  for (const s of sessions) {
    const capacity = s.capacity;
    const sessionRoster = roster.filter((r) => (r.session_id as string) === s.id);
    const slotByIndex = new Map<number, (typeof roster)[0]>();
    for (const row of sessionRoster) {
      slotByIndex.set(row.slot_index as number, row);
    }

    const skillsNumeric: number[] = [];
    const slots: OpenMatchShareSlotLine[] = [];

    for (let i = 0; i < capacity; i++) {
      const row = slotByIndex.get(i);
      if (!row) {
        slots.push({ isEmpty: true, displayName: null, ratingLabel: null });
        continue;
      }
      const uid = row.user_id as string;
      const u = userById.get(uid);
      const pid = playerByUserId.get(uid);
      const sk = pid ? skillByPlayerId.get(pid) : undefined;
      const skill = typeof sk === "number" && Number.isFinite(sk) ? sk : DEFAULT_SKILL;
      skillsNumeric.push(skill);
      const nm = u?.name?.trim();
      const un = u?.username?.trim();
      let displayName: string;
      if (nm && un) displayName = `${nm} (@${un})`;
      else if (un) displayName = `@${un}`;
      else displayName = nm || "Player";
      slots.push({
        isEmpty: false,
        displayName,
        ratingLabel: formatDisplayLevel(skill),
      });
    }

    let ratingBandLabel: string | null = null;
    if (skillsNumeric.length >= 2) {
      const mn = Math.min(...skillsNumeric);
      const mx = Math.max(...skillsNumeric);
      ratingBandLabel = `${formatDisplayLevel(mn)} – ${formatDisplayLevel(mx)}`;
    } else if (skillsNumeric.length === 1) {
      ratingBandLabel = formatDisplayLevel(skillsNumeric[0]!);
    }

    const mk = s.match_kind === "competitive" ? "competitive" : "friendly";
    const shareText = buildOpenMatchShareBody({
      title: s.title,
      matchKind: mk,
      startsAt: s.starts_at,
      ratingBandLabel,
      capacity,
      slots,
    });
    const shareTitle = shareTitleForOpenMatch(s.title, mk);
    out.set(s.id, { shareTitle, shareText });
  }

  return out;
}
