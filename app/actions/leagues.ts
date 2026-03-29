"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  generateLeagueCode,
  isValidLeagueInviteCode,
  normalizeLeagueCode,
} from "@/lib/league-code";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/username";
import { isLeagueFormat, sessionInputModeForFormat } from "@/lib/league-format";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export async function createLeague(formData: FormData) {
  const { supabase, user } = await requireOnboarded();
  const name = String(formData.get("name") ?? "").trim();
  const formatRaw = String(formData.get("format") ?? "").trim();

  if (!name || !isLeagueFormat(formatRaw)) {
    return { error: "Invalid league details." };
  }
  const format = formatRaw;

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (pErr || !player) return { error: "Player profile not found." };

  let leagueId: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateLeagueCode();
    const { data: league, error } = await supabase
      .from("leagues")
      .insert({
        name,
        format,
        results_mode: sessionInputModeForFormat(format),
        code,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (!error && league) {
      leagueId = league.id;
      break;
    }
    if (error?.code === "23505") continue;
    lastError = error?.message ?? "Could not create league.";
    break;
  }

  if (!leagueId) return { error: lastError ?? "Could not generate a unique code." };

  const { error: mErr } = await supabase.from("league_members").insert({
    league_id: leagueId,
    user_id: user.id,
    role: "owner",
  });
  if (mErr) return { error: mErr.message };

  const { error: lpErr } = await supabase.from("league_players").insert({
    league_id: leagueId,
    player_id: player.id,
  });
  if (lpErr) return { error: lpErr.message };

  revalidatePath("/dashboard");
  return { leagueId };
}

export async function joinLeagueByCode(formData: FormData) {
  const { supabase } = await requireOnboarded();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter a league code." };

  const { data, error } = await supabase.rpc("join_league_by_code", {
    p_code: code,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("invalid code")) return { error: "Invalid league code." };
    if (msg.includes("already joined")) return { error: "You are already in this league." };
    if (msg.includes("request already pending")) {
      return { error: "You already have a pending request for this league." };
    }
    if (msg.includes("onboarding")) return { error: "Finish onboarding before requesting to join." };
    if (msg.includes("username required")) {
      return { error: "Set a unique username on your profile before requesting to join a league." };
    }
    if (msg.includes("username before joining")) {
      return { error: "Set a unique username on your profile before requesting to join a league." };
    }
    return { error: msg };
  }

  revalidatePath("/dashboard");
  return { leagueId: data as string };
}

export async function requestJoinLeagueByCode(leagueCode: string) {
  const { supabase } = await requireOnboarded();
  const code = leagueCode.trim();
  if (!code) return { error: "Invalid league code." };

  const { data, error } = await supabase.rpc("join_league_by_code", {
    p_code: code,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("invalid code")) return { error: "Invalid league code." };
    if (msg.includes("already joined")) return { error: "You are already in this league." };
    if (msg.includes("request already pending")) {
      return { error: "You already have a pending request for this league." };
    }
    if (msg.includes("onboarding")) return { error: "Finish onboarding before requesting to join." };
    if (msg.includes("username required")) {
      return { error: "Set a unique username on your profile before requesting to join a league." };
    }
    if (msg.includes("username before joining")) {
      return { error: "Set a unique username on your profile before requesting to join a league." };
    }
    return { error: msg };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/join/${code.toUpperCase()}`);
  return { leagueId: data as string };
}

export async function acceptJoinRequest(requestId: string) {
  const { supabase, user } = await requireOnboarded();

  const { data: row, error: qErr } = await supabase
    .from("league_join_requests")
    .select("league_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (qErr) return { error: qErr.message };
  if (!row || row.status !== "pending") return { error: "Request not found." };

  const leagueId = row.league_id as string;
  if (!(await requireLeagueAdmin(supabase, user.id, leagueId))) {
    return { error: "Not allowed." };
  }

  const { error } = await supabase.rpc("accept_join_request", {
    p_request_id: requestId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function declineJoinRequest(requestId: string) {
  const { supabase, user } = await requireOnboarded();

  const { data: row, error: qErr } = await supabase
    .from("league_join_requests")
    .select("league_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (qErr) return { error: qErr.message };
  if (!row || row.status !== "pending") return { error: "Request not found." };

  const leagueId = row.league_id as string;
  if (!(await requireLeagueAdmin(supabase, user.id, leagueId))) {
    return { error: "Not allowed." };
  }

  const { error } = await supabase.rpc("decline_join_request", {
    p_request_id: requestId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function addMemberByUsername(
  leagueId: string,
  formData: FormData,
) {
  const { supabase, user } = await requireOnboarded();

  const { data: me } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    return { error: "Not allowed." };
  }

  const usernameRaw = String(formData.get("username") ?? "").trim();
  const username = normalizeUsername(usernameRaw.replace(/^@/, ""));
  const role = String(formData.get("role") ?? "player").trim() as
    | "admin"
    | "player";

  if (!username) return { error: "Username is required." };
  if (role !== "admin" && role !== "player") return { error: "Invalid role." };

  const { data: targetUser, error: uErr } = await supabase
    .from("users")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (uErr) return { error: uErr.message };
  if (!targetUser) return { error: "No user found with that username." };

  const targetUserId = targetUser.id as string;
  if (targetUserId === user.id) {
    return { error: "Use league settings to change your own access." };
  }

  const { error } = await supabase.from("league_members").insert({
    league_id: leagueId,
    user_id: targetUserId,
    role,
  });

  if (error) {
    if (error.code === "23505") return { error: "That user is already a member." };
    if (error.message.includes("username")) {
      return {
        error:
          "That user must set a username on their profile before they can join a league.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export type LeagueMemberPick = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url?: string | null;
};

async function requireLeagueAdmin(
  supabase: ServerSupabase,
  userId: string,
  leagueId: string,
) {
  const { data: me } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  return (
    me &&
    (me.role === "owner" || me.role === "admin")
  );
}

/** Accepted friends with a username who are not yet members of this league. */
export async function getFriendsForLeagueInvite(leagueId: string) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, user.id, leagueId))) {
    return { error: "Not allowed.", users: [] as LeagueMemberPick[] };
  }

  const { data: rows, error: fErr } = await supabase
    .from("friendships")
    .select("user_a, user_b, status")
    .eq("status", "accepted");

  if (fErr) return { error: fErr.message, users: [] as LeagueMemberPick[] };

  const peerIds = (rows ?? [])
    .filter((r) => r.user_a === user.id || r.user_b === user.id)
    .map((r) => (r.user_a === user.id ? r.user_b : r.user_a) as string);

  const uniquePeers = [...new Set(peerIds)].filter((id) => id !== user.id);

  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  const memberSet = new Set((members ?? []).map((m) => m.user_id as string));

  const eligible = uniquePeers.filter((id) => !memberSet.has(id));
  if (eligible.length === 0) return { users: [] as LeagueMemberPick[] };

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, name, avatar_url")
    .in("id", eligible)
    .not("username", "is", null);

  if (error) return { error: error.message, users: [] as LeagueMemberPick[] };

  const list = (users ?? []).filter((u) => u.username?.trim()) as LeagueMemberPick[];
  list.sort((a, b) => {
    const an = (a.name?.trim() || a.username || "").toLowerCase();
    const bn = (b.name?.trim() || b.username || "").toLowerCase();
    return an.localeCompare(bn);
  });
  return { users: list.slice(0, 40) };
}

/** Users you share another league with, not yet in this league (RLS-visible rows only). */
export async function getSuggestedLeagueMates(leagueId: string) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, user.id, leagueId))) {
    return { error: "Not allowed.", users: [] as LeagueMemberPick[] };
  }

  const { data: myLeagues } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id);
  const leagueIds = (myLeagues ?? []).map((r) => r.league_id as string);
  if (leagueIds.length === 0) return { users: [] as LeagueMemberPick[] };

  const { data: mates } = await supabase
    .from("league_members")
    .select("user_id")
    .in("league_id", leagueIds)
    .neq("user_id", user.id);

  const mateIds = [
    ...new Set((mates ?? []).map((m) => m.user_id as string)),
  ];

  const { data: here } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  const hereSet = new Set((here ?? []).map((m) => m.user_id as string));

  const suggestIds = mateIds.filter((id) => !hereSet.has(id)).slice(0, 80);
  if (suggestIds.length === 0) return { users: [] as LeagueMemberPick[] };

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, name, avatar_url")
    .in("id", suggestIds)
    .not("username", "is", null);

  if (error) return { error: error.message, users: [] as LeagueMemberPick[] };

  const list = (users ?? []).filter((u) => u.username?.trim()) as LeagueMemberPick[];
  return { users: list.slice(0, 12) };
}

/** Search by username among users visible to you via RLS; excludes this league’s members. */
export async function searchUsersForLeague(leagueId: string, query: string) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, user.id, leagueId))) {
    return { error: "Not allowed.", users: [] as LeagueMemberPick[] };
  }

  const raw = normalizeUsername(String(query)).replace(/[%_]/g, "");
  if (raw.length < 2) return { users: [] as LeagueMemberPick[] };

  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  const memberSet = new Set((members ?? []).map((m) => m.user_id as string));

  const { data: users, error } = await supabase
    .from("users")
    .select("id, username, name, avatar_url")
    .ilike("username", `%${raw}%`)
    .limit(30);

  if (error) return { error: error.message, users: [] as LeagueMemberPick[] };

  const filtered = (users ?? []).filter(
    (u) =>
      u.username &&
      u.id !== user.id &&
      !memberSet.has(u.id),
  ) as LeagueMemberPick[];
  return { users: filtered.slice(0, 15) };
}

export async function addMemberByUserId(
  leagueId: string,
  targetUserId: string,
  role: "admin" | "player",
) {
  const { supabase, user } = await requireOnboarded();

  if (!(await requireLeagueAdmin(supabase, user.id, leagueId))) {
    return { error: "Not allowed." };
  }

  if (role !== "admin" && role !== "player") return { error: "Invalid role." };
  if (targetUserId === user.id) {
    return { error: "Use league settings to change your own access." };
  }

  const { error } = await supabase.from("league_members").insert({
    league_id: leagueId,
    user_id: targetUserId,
    role,
  });

  if (error) {
    if (error.code === "23505") return { error: "That user is already a member." };
    if (error.message.includes("username")) {
      return {
        error:
          "That user must set a username on their profile before they can join a league.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function createGuestPlayer(
  leagueId: string,
  formData: FormData,
) {
  const { supabase } = await requireOnboarded();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required." };

  const playstyle = String(formData.get("playstyle") ?? "").trim() || null;
  const preferredSide = String(formData.get("preferred_side") ?? "").trim() || null;
  const experienceLevel = String(formData.get("experience_level") ?? "").trim() || null;

  const strengths = formData.getAll("strengths").map(String);
  const weaknesses = formData.getAll("weaknesses").map(String);

  const { data, error } = await supabase.rpc("create_guest_player", {
    p_league_id: leagueId,
    p_name: name,
    p_playstyle: playstyle,
    p_strengths: strengths,
    p_weaknesses: weaknesses,
    p_preferred_side: preferredSide,
    p_experience_level: experienceLevel,
  });

  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { playerId: data as string };
}

export async function updateMemberRole(
  leagueId: string,
  memberId: string,
  role: "admin" | "player",
) {
  const { supabase, user } = await requireOnboarded();

  const { data: me } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me || me.role !== "owner") {
    return { error: "Only the league owner can change roles." };
  }

  if (role !== "admin" && role !== "player") {
    return { error: "Invalid role." };
  }

  const { data: target } = await supabase
    .from("league_members")
    .select("role, user_id")
    .eq("id", memberId)
    .eq("league_id", leagueId)
    .maybeSingle();

  if (!target) return { error: "Member not found." };
  if (target.role === "owner") return { error: "Cannot change the owner role here." };
  if ((target.user_id as string) === user.id) {
    return { error: "You cannot change your own role." };
  }

  const { error } = await supabase
    .from("league_members")
    .update({ role })
    .eq("id", memberId)
    .eq("league_id", leagueId);

  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function linkMemberPlayer(leagueId: string, targetUserId: string) {
  const { supabase, user } = await requireOnboarded();

  const { data: me } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    return { error: "Not allowed." };
  }

  const { data: targetMember } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!targetMember) return { error: "User is not a member of this league." };

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!player) return { error: "That user has no player profile yet." };

  const { error } = await supabase.from("league_players").insert({
    league_id: leagueId,
    player_id: player.id,
  });

  if (error) {
    if (error.code === "23505") return { error: "Player already linked to this league." };
    return { error: error.message };
  }

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function updateLeagueReferenceCode(leagueId: string, rawCode: string) {
  const { supabase, user } = await requireOnboarded();
  const id = leagueId.trim();
  if (!id) return { error: "Invalid league." };

  const { data: league, error: fetchErr } = await supabase
    .from("leagues")
    .select("id, owner_id, code")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !league) return { error: "League not found." };
  if (league.owner_id !== user.id) {
    return { error: "Only the league owner can change the reference code." };
  }

  if (!isValidLeagueInviteCode(rawCode)) {
    return {
      error:
        "Use exactly 8 characters: letters A–Z except I and O, and digits 2–9 (no 0 or 1).",
    };
  }

  const normalized = normalizeLeagueCode(rawCode);
  const current = String(league.code ?? "").trim().toUpperCase();
  if (normalized === current) {
    return { ok: true };
  }

  const { error } = await supabase.from("leagues").update({ code: normalized }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "That reference code is already taken." };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/leagues/${id}`);
  return { ok: true };
}

export async function deleteLeague(leagueId: string) {
  const { supabase, user } = await requireOnboarded();
  const id = leagueId.trim();
  if (!id) return { error: "Invalid league." };

  const { data: league, error: fetchErr } = await supabase
    .from("leagues")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !league) return { error: "League not found." };
  if (league.owner_id !== user.id) {
    return { error: "Only the league owner can delete this league." };
  }

  const { error } = await supabase.from("leagues").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/leagues/${id}`);
  return { ok: true };
}
