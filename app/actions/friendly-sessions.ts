"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export type PickupMatchKind = "friendly" | "competitive";

function parseOptionalStartsAtIso(raw: string | null | undefined): { ok: true; iso: string | null } | { ok: false; error: string } {
  if (raw == null || String(raw).trim() === "") return { ok: true, iso: null };
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) {
    return { ok: false, error: "Invalid start time." };
  }
  return { ok: true, iso: d.toISOString() };
}

export async function createFriendlySession(input: {
  /** Open matches are fixed at 4 players (2v2). */
  capacity?: 4;
  title?: string;
  /** ISO string or empty for null */
  startsAt?: string | null;
  /** Pickup: friendly skips global skill; competitive applies rating when completed with games. */
  matchKind?: PickupMatchKind;
}) {
  const { supabase } = await requireOnboarded();
  const parsed = parseOptionalStartsAtIso(input.startsAt);
  if (!parsed.ok) return { error: parsed.error };
  const startsAt = parsed.iso;

  const mk = input.matchKind === "competitive" ? "competitive" : "friendly";

  const cap = input.capacity ?? 4;
  if (cap !== 4) {
    return { error: "Open sessions use a fixed roster of 4 players." };
  }

  const { data, error } = await supabase.rpc("create_friendly_session", {
    p_capacity: cap,
    p_title: input.title?.trim() ?? null,
    p_starts_at: startsAt,
    p_match_kind: mk,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("username required")) {
      return { error: "Set a unique username on your profile first." };
    }
    if (msg.includes("onboarding")) return { error: "Finish onboarding before creating a friendly session." };
    if (msg.includes("invalid capacity")) return { error: "Capacity must be 4 for open sessions." };
    return { error: msg };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const sessionId = row?.session_id as string | undefined;
  const inviteToken = row?.invite_token as string | undefined;
  if (!sessionId || !inviteToken) return { error: "Could not create session." };

  revalidatePath("/dashboard", "page");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/", "layout");
  return { sessionId, inviteToken };
}

export async function requestJoinFriendlySession(inviteToken: string) {
  const { supabase } = await requireOnboarded();
  const token = inviteToken.trim();
  if (!token) return { error: "Invalid invite." };

  const { data, error } = await supabase.rpc("request_join_friendly_session", {
    p_invite_token: token,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("invalid invite")) return { error: "This invite link is not valid." };
    if (msg.includes("not open")) return { error: "This session is no longer open." };
    if (msg.includes("full")) return { error: "This session is full." };
    if (msg.includes("already in session")) return { error: "You are already in this session." };
    if (msg.includes("request already pending")) return { error: "You already have a pending request." };
    if (msg.includes("username required")) {
      return { error: "Set a unique username on your profile before requesting to join." };
    }
    if (msg.includes("onboarding")) return { error: "Finish onboarding before joining." };
    return { error: msg };
  }

  const sessionId = data as string;
  revalidatePath("/dashboard");
  revalidatePath(`/friendly/invite/${token}`);
  revalidatePath(`/friendly/${sessionId}`);
  return { sessionId };
}

export async function acceptFriendlyJoinRequest(requestId: string) {
  const { supabase } = await requireOnboarded();

  const { data: reqRow, error: qErr } = await supabase
    .from("friendly_session_join_requests")
    .select("session_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (qErr) return { error: qErr.message };
  if (!reqRow || reqRow.status !== "pending") return { error: "Request not found." };

  const sessionId = reqRow.session_id as string;

  const { error } = await supabase.rpc("accept_friendly_join_request", {
    p_request_id: requestId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/friendly/${sessionId}`);
  return { ok: true as const };
}

export async function declineFriendlyJoinRequest(requestId: string) {
  const { supabase } = await requireOnboarded();

  const { data: reqRow, error: qErr } = await supabase
    .from("friendly_session_join_requests")
    .select("session_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (qErr) return { error: qErr.message };
  if (!reqRow || reqRow.status !== "pending") return { error: "Request not found." };

  const sessionId = reqRow.session_id as string;

  const { error } = await supabase.rpc("decline_friendly_join_request", {
    p_request_id: requestId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/friendly/${sessionId}`);
  return { ok: true as const };
}

export async function swapFriendlyRosterSlots(
  sessionId: string,
  slotA: number,
  slotB: number,
) {
  const { supabase } = await requireOnboarded();

  const { error } = await supabase.rpc("swap_friendly_roster_slots", {
    p_session_id: sessionId,
    p_slot_a: slotA,
    p_slot_b: slotB,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("not allowed")) return { error: "You must be in the session to swap slots." };
    if (msg.includes("empty slot")) return { error: "Pick two filled slots to swap." };
    return { error: msg };
  }

  revalidatePath(`/friendly/${sessionId}`);
  return { ok: true as const };
}

export async function cancelFriendlySession(sessionId: string) {
  const { supabase } = await requireOnboarded();

  const { error } = await supabase.rpc("cancel_friendly_session", {
    p_session_id: sessionId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/friendly/${sessionId}`);
  return { ok: true as const };
}

export type FriendlyGameRowInput = {
  courtNumber: number;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
  teamAScore: number;
  teamBScore: number;
  winner: "team_a" | "team_b";
};

/** Replace all games for an open pickup session. Competitive: organiser only; clears score approvals when games change. */
export async function replaceFriendlySessionGames(
  sessionId: string,
  games: FriendlyGameRowInput[],
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireOnboarded();
  const sid = sessionId.trim().toLowerCase();

  const { data: fs, error: fsErr } = await supabase
    .from("friendly_sessions")
    .select("id, status, capacity, match_kind, creator_user_id")
    .eq("id", sid)
    .maybeSingle();

  if (fsErr || !fs) return { error: "Session not found." };
  if (String(fs.status) !== "open") return { error: "Session is not open." };

  const mk = String((fs as { match_kind?: string }).match_kind ?? "friendly");
  const cre = (fs as { creator_user_id?: string }).creator_user_id;
  if (mk === "competitive" && cre !== user.id) {
    return { error: "Only the organiser can enter or change competitive scores." };
  }

  const { data: roster } = await supabase
    .from("friendly_session_roster")
    .select("user_id, slot_index")
    .eq("session_id", sid);

  const rosterPlayerIds = new Set<string>();
  const userIdsOnRoster = new Set<string>();
  for (const r of roster ?? []) {
    userIdsOnRoster.add(r.user_id as string);
  }

  const uidList = [...userIdsOnRoster];
  const { data: players } =
    uidList.length > 0
      ? await supabase.from("players").select("id, user_id").in("user_id", uidList)
      : { data: [] as { id: string; user_id: string | null }[] };

  const playerIdByUserId = new Map<string, string>();
  for (const p of players ?? []) {
    if (p.user_id) playerIdByUserId.set(p.user_id as string, p.id as string);
  }
  for (const uid of userIdsOnRoster) {
    const pid = playerIdByUserId.get(uid);
    if (pid) rosterPlayerIds.add(pid);
  }

  const onRoster = userIdsOnRoster.has(user.id);
  if (cre !== user.id && !onRoster) return { error: "Not allowed." };

  for (const g of games) {
    const all = [...g.teamAPlayers, ...g.teamBPlayers];
    if (all.length !== 4) return { error: "Each game needs two pairs (four players)." };
    if (new Set(all).size !== 4) return { error: "Players in a game must be distinct." };
    for (const pid of all) {
      if (!rosterPlayerIds.has(pid)) return { error: "All players must be on the session roster." };
    }
    const w = g.winner === "team_a" ? g.teamAScore > g.teamBScore : g.teamBScore > g.teamAScore;
    if (!w) return { error: "Winner must match scores." };
  }

  const { error: delErr } = await supabase
    .from("friendly_session_games")
    .delete()
    .eq("friendly_session_id", sid);
  if (delErr) return { error: delErr.message };

  if (mk === "competitive") {
    const { error: apprErr } = await supabase
      .from("friendly_session_competitive_approvals")
      .delete()
      .eq("session_id", sid);
    if (apprErr) return { error: apprErr.message };
  }

  if (games.length === 0) {
    revalidatePath(`/friendly/${sid}`);
    return { ok: true as const };
  }

  const insertRows = games.map((g) => ({
    friendly_session_id: sid,
    court_number: g.courtNumber,
    team_a_players: g.teamAPlayers,
    team_b_players: g.teamBPlayers,
    team_a_score: g.teamAScore,
    team_b_score: g.teamBScore,
    winner: g.winner,
  }));

  const { error: insErr } = await supabase.from("friendly_session_games").insert(insertRows);
  if (insErr) return { error: insErr.message };

  revalidatePath(`/friendly/${sid}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function approveFriendlyCompetitiveScores(
  sessionId: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireOnboarded();
  const sid = sessionId.trim().toLowerCase();

  const { data: fs, error: fsErr } = await supabase
    .from("friendly_sessions")
    .select("id, status, match_kind, creator_user_id")
    .eq("id", sid)
    .maybeSingle();

  if (fsErr || !fs) return { error: "Session not found." };
  if (String(fs.status) !== "open") return { error: "Session is not open." };
  if (String((fs as { match_kind?: string }).match_kind) !== "competitive") {
    return { error: "Approvals apply to competitive sessions only." };
  }
  if ((fs as { creator_user_id?: string }).creator_user_id === user.id) {
    return { error: "The organiser does not need to approve their own scores." };
  }

  const { count: gameCount, error: gErr } = await supabase
    .from("friendly_session_games")
    .select("id", { count: "exact", head: true })
    .eq("friendly_session_id", sid);
  if (gErr) return { error: gErr.message };
  if (!gameCount || gameCount < 1) {
    return { error: "The organiser must save results before you can approve." };
  }

  const { error } = await supabase.from("friendly_session_competitive_approvals").upsert(
    {
      session_id: sid,
      user_id: user.id,
      approved_at: new Date().toISOString(),
    },
    { onConflict: "session_id,user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath(`/friendly/${sid}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function completeFriendlyPickupSession(
  sessionId: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requireOnboarded();
  const sid = sessionId.trim().toLowerCase();

  const { error } = await supabase.rpc("complete_friendly_pickup_session", {
    p_session_id: sid,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("not allowed")) return { error: "Only the organiser can complete the session." };
    if (msg.includes("roster not full")) return { error: "Fill every slot before completing." };
    if (msg.includes("add game")) return { error: "Add at least one game result first." };
    if (msg.includes("approve")) return { error: "Every other player must approve the results before completing." };
    if (msg.includes("not open")) return { error: "Session is not open." };
    return { error: msg };
  }

  revalidatePath(`/friendly/${sid}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}
