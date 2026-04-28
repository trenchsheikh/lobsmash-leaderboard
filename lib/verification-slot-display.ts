/** Format duration for verification slot cards (e.g. "1 hr", "1 hr 30 min"). */
export function formatVerificationDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (!Number.isFinite(m) || m < 1) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return h === 1 ? "1 hr" : `${h} hr`;
  return `${h} hr ${r} min`;
}

/** Localised date + time range for a slot. */
export function formatVerificationSlotRange(
  startsAtIso: string,
  durationMinutes: number,
  locale?: string,
): { dateLine: string; timeLine: string } {
  const start = new Date(startsAtIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  if (Number.isNaN(start.getTime())) {
    return { dateLine: "—", timeLine: "—" };
  }
  const loc = locale ?? undefined;
  const dateLine = start.toLocaleDateString(loc, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const opt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const timeLine = `${start.toLocaleTimeString(loc, opt)} – ${end.toLocaleTimeString(loc, opt)}`;
  return { dateLine, timeLine };
}
