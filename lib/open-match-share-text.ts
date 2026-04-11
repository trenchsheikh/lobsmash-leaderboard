/** Roster slot shape (matches FriendlySlotDisplay fields we need). */
export type OpenMatchShareSlotSource = {
  slotIndex: number;
  userId: string | null;
  name: string | null;
  username: string | null;
  displayLevel: string | null;
};

/** Date/time line for share copy (locale-aware). */
export function formatOpenMatchWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const datePart = d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

export type OpenMatchShareSlotLine = {
  isEmpty: boolean;
  /** Visible name, e.g. full name or @username */
  displayName: string | null;
  /** Playtomic-style level string, e.g. "3.5" */
  ratingLabel: string | null;
};

export type BuildOpenMatchShareBodyInput = {
  title: string | null;
  matchKind: "friendly" | "competitive";
  startsAt: string | null;
  /** e.g. "1.2 – 3.4" from roster skill spread */
  ratingBandLabel: string | null;
  capacity: number;
  /** One entry per slot index 0..capacity-1 */
  slots: OpenMatchShareSlotLine[];
};

/**
 * Multiline body for Web Share / clipboard (Playtomic-style; no venue — we use LobSmash fields).
 */
export function buildOpenMatchShareBody(input: BuildOpenMatchShareBodyInput): string {
  const headline = (input.title?.trim() || "Open match").toUpperCase();
  const kind =
    input.matchKind === "competitive" ? "COMPETITIVE PICKUP" : "FRIENDLY · 2v2";
  const lines: string[] = [];

  lines.push(`🎾 LOBSMASH — ${headline}`);
  lines.push(`🏷️ ${kind}`);
  lines.push("");

  const when = formatOpenMatchWhen(input.startsAt);
  if (when) {
    lines.push(`📅 ${when}`);
  } else {
    lines.push("📅 Time TBC");
  }

  if (input.ratingBandLabel?.trim()) {
    lines.push(`📊 Level ${input.ratingBandLabel.trim()}`);
  } else {
    lines.push("📊 Level — (join to fill)");
  }

  const filled = input.slots.filter((s) => !s.isEmpty).length;
  lines.push(`👥 ${filled}/${input.capacity} players`);
  lines.push("");

  const half = input.capacity / 2;
  for (let t = 0; t < 2; t++) {
    const label = t === 0 ? "🅰️ Team A" : "🅱️ Team B";
    lines.push(label);
    const start = t === 0 ? 0 : half;
    const end = t === 0 ? half : input.capacity;
    for (let i = start; i < end; i++) {
      const slot = input.slots[i];
      if (!slot) {
        lines.push("⚪ —");
        continue;
      }
      if (slot.isEmpty || !slot.displayName?.trim()) {
        lines.push("⚪ Open slot");
      } else {
        const name = slot.displayName.trim();
        const r = slot.ratingLabel?.trim();
        const rating = r ? ` (${r})` : "";
        lines.push(`✅ ${name}${rating}`);
      }
    }
    if (t === 0) lines.push("");
  }

  lines.push("");
  lines.push("Tap the link to request to join 👇");

  return lines.join("\n");
}

export function orderedSlotsFromFriendlyTeams(
  teamA: OpenMatchShareSlotSource[],
  teamB: OpenMatchShareSlotSource[],
): OpenMatchShareSlotLine[] {
  const ordered = [...teamA, ...teamB].sort((a, b) => a.slotIndex - b.slotIndex);
  return ordered.map((slot) => {
    if (!slot.userId) {
      return { isEmpty: true, displayName: null, ratingLabel: null };
    }
    const nm = slot.name?.trim();
    const un = slot.username?.trim();
    let displayName: string;
    if (nm && un) displayName = `${nm} (@${un})`;
    else if (un) displayName = `@${un}`;
    else displayName = nm || "Player";
    return {
      isEmpty: false,
      displayName,
      ratingLabel: slot.displayLevel,
    };
  });
}

export function shareTitleForOpenMatch(title: string | null, matchKind: "friendly" | "competitive"): string {
  const t = title?.trim() || "Open match";
  const tag = matchKind === "competitive" ? "Competitive" : "Friendly";
  return `LobSmash · ${t} (${tag})`;
}
