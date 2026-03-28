import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const THROTTLE_MS = 60 * 60 * 1000; // at most one write per user per hour

/** True when optional migration 20250329100000_user_last_seen.sql is not applied yet. */
function isMissingLastSeenColumns(e: { message?: string; code?: string }): boolean {
  const m = (e.message ?? "").toLowerCase();
  return (
    m.includes("schema cache") ||
    (m.includes("could not find") && m.includes("column")) ||
    m.includes("last_seen") ||
    e.code === "PGRST204"
  );
}

function clientIpFromHeaders(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() ?? null;
}

/** Updates last_seen_ip / last_seen_at for the signed-in user (throttled). Silently no-ops if migration not applied or no IP. */
export async function maybeRecordLastSeenIp(): Promise<void> {
  try {
    const { userId } = await auth();
    if (!userId) return;

    const h = await headers();
    const ip = clientIpFromHeaders(h);
    if (!ip) return;

    const supabase = await createClient();
    const { data: row, error: selectErr } = await supabase
      .from("users")
      .select("last_seen_at")
      .eq("id", userId)
      .maybeSingle();

    if (selectErr) {
      if (isMissingLastSeenColumns(selectErr)) return;
      if (process.env.NODE_ENV === "development") {
        console.warn("maybeRecordLastSeenIp select", selectErr.message);
      }
      return;
    }

    const last = row?.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    if (last && Date.now() - last < THROTTLE_MS) return;

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        last_seen_ip: ip,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateErr) {
      if (isMissingLastSeenColumns(updateErr)) return;
      if (process.env.NODE_ENV === "development") {
        console.warn("maybeRecordLastSeenIp update", updateErr.message);
      }
    }
  } catch {
    // headers/auth unavailable or transient failure — optional feature
  }
}
