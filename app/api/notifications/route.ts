import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayAndTomorrowYmd(): { today: string; tomorrow: string } {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { today: utcYmd(today), tomorrow: utcYmd(tomorrow) };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: friendshipRows, error: fErr } = await supabase
    .from("friendships")
    .select("id, user_a, user_b, requested_by, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (fErr) {
    console.error("notifications GET friendships", fErr.message);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }

  const incomingFriendships = (friendshipRows ?? []).filter(
    (f) => f.requested_by !== userId && (f.user_a === userId || f.user_b === userId),
  );

  const peerIds = [...new Set(incomingFriendships.map((f) => (f.user_a === userId ? f.user_b : f.user_a)))];

  let peerById = new Map<
    string,
    { id: string; username: string | null; name: string | null; avatar_url: string | null }
  >();
  if (peerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, name, avatar_url")
      .in("id", peerIds);
    for (const u of users ?? []) {
      peerById.set(u.id as string, {
        id: u.id as string,
        username: u.username as string | null,
        name: u.name as string | null,
        avatar_url: (u.avatar_url as string | null | undefined) ?? null,
      });
    }
  }

  const friends = incomingFriendships.map((f) => {
    const peerId = f.user_a === userId ? f.user_b : f.user_a;
    const peer = peerById.get(peerId) ?? {
      id: peerId,
      username: null,
      name: null,
      avatar_url: null,
    };
    return {
      kind: "friend" as const,
      friendshipId: f.id as string,
      createdAt: f.created_at as string,
      peer,
    };
  });

  const { data: notifRows, error: nErr } = await supabase
    .from("user_notifications")
    .select("id, type, payload, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (nErr) {
    console.error("notifications GET user_notifications", nErr.message);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }

  const sessionPartner = (notifRows ?? []).map((row) => ({
    kind: "session_partner" as const,
    id: row.id as string,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
    payload: row.payload as Record<string, unknown>,
  }));

  const { data: playerRow } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const playerId = playerRow?.id as string | undefined;

  let reminders: {
    kind: "reminder";
    key: string;
    sessionId: string;
    leagueId: string;
    leagueName: string;
    sessionDate: string;
    when: "today" | "tomorrow";
  }[] = [];

  if (playerId) {
    const { data: teamRows, error: tErr } = await supabase
      .from("session_teams")
      .select("session_id")
      .or(`player_a.eq.${playerId},player_b.eq.${playerId}`);

    if (tErr) {
      console.error("notifications GET session_teams", tErr.message);
    } else {
      const sessionIds = [...new Set((teamRows ?? []).map((r) => r.session_id as string))];
      if (sessionIds.length > 0) {
        const { today, tomorrow } = todayAndTomorrowYmd();
        const { data: sessionRows } = await supabase
          .from("sessions")
          .select("id, league_id, date, status, leagues(name)")
          .in("id", sessionIds)
          .eq("status", "draft")
          .in("date", [today, tomorrow]);

        for (const s of sessionRows ?? []) {
          const dateStr = s.date as string;
          const when = dateStr === today ? ("today" as const) : ("tomorrow" as const);
          const rawLeague = s.leagues as { name?: string } | { name?: string }[] | null | undefined;
          const league = Array.isArray(rawLeague) ? rawLeague[0] : rawLeague;
          reminders.push({
            kind: "reminder",
            key: `reminder:${s.id as string}:${dateStr}`,
            sessionId: s.id as string,
            leagueId: String(s.league_id).toLowerCase(),
            leagueName: typeof league?.name === "string" ? league.name : "League",
            sessionDate: dateStr,
            when,
          });
        }
      }
    }
  }

  const unreadSessionPartner = sessionPartner.filter((n) => n.readAt == null).length;
  const badgeCount = friends.length + unreadSessionPartner + reminders.length;

  return NextResponse.json({
    friends,
    sessionPartner,
    reminders,
    badgeCount,
  });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const cleanIds = ids.filter((id): id is string => typeof id === "string" && uuidRe.test(id));
  if (cleanIds.length === 0) {
    return NextResponse.json({ error: "No valid ids" }, { status: 400 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: now })
    .in("id", cleanIds.slice(0, 50))
    .is("read_at", null);

  if (error) {
    console.error("notifications PATCH", error.message);
    return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
