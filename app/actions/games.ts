"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  applySkillRatingAfterCompletedEdit,
  reverseSkillRatingIfCompleted,
} from "@/lib/session-skill-rating";

function parseUuidList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createGame(leagueId: string, sessionId: string, formData: FormData) {
  const { supabase } = await requireOnboarded();

  const courtNumber = Number(formData.get("court_number"));
  const teamA = parseUuidList(String(formData.get("team_a_players") ?? ""));
  const teamB = parseUuidList(String(formData.get("team_b_players") ?? ""));
  const teamAScore = Number(formData.get("team_a_score"));
  const teamBScore = Number(formData.get("team_b_score"));
  const winner = String(formData.get("winner") ?? "").trim() as "team_a" | "team_b";

  if (!Number.isInteger(courtNumber) || courtNumber < 1) {
    return { error: "Court number must be a positive integer." };
  }
  if (teamA.length !== 2 || teamB.length !== 2) {
    return { error: "Each team must have exactly two players (padel 2v2)." };
  }
  if (winner !== "team_a" && winner !== "team_b") {
    return { error: "Winner must be team_a or team_b." };
  }
  if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore) || teamAScore < 0 || teamBScore < 0) {
    return { error: "Scores must be non-negative integers." };
  }
  if (teamAScore === teamBScore) {
    return { error: "Scores cannot be tied." };
  }
  if (winner === "team_a" && teamAScore <= teamBScore) {
    return { error: "Winner does not match scores." };
  }
  if (winner === "team_b" && teamBScore <= teamAScore) {
    return { error: "Winner does not match scores." };
  }

  const teamBSet = new Set(teamB);
  for (const id of teamA) {
    if (teamBSet.has(id)) return { error: "A player cannot be on both teams." };
  }

  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sid)
    .single();

  if (sErr || !session || String(session.league_id).toLowerCase() !== lid) {
    return { error: "Session does not belong to this league." };
  }

  const wasCompleted = session.status === "completed";
  const revErr = await reverseSkillRatingIfCompleted(supabase, sid, wasCompleted);
  if (revErr) return { error: revErr };

  const { data: existingGames, error: gErr } = await supabase
    .from("games")
    .select("court_number, team_a_players, team_b_players")
    .eq("session_id", sid);

  if (gErr) return { error: gErr.message };

  const used = new Set<string>();
  for (const g of existingGames ?? []) {
    for (const id of g.team_a_players ?? []) used.add(id);
    for (const id of g.team_b_players ?? []) used.add(id);
  }
  for (const id of teamA) {
    if (used.has(id)) return { error: "A player is already assigned to another court in this session." };
  }
  for (const id of teamB) {
    if (used.has(id)) return { error: "A player is already assigned to another court in this session." };
  }

  const leaguePlayerIds = new Set<string>();
  const { data: lpRows, error: lpErr } = await supabase
    .from("league_players")
    .select("player_id")
    .eq("league_id", lid);

  if (lpErr) return { error: lpErr.message };
  for (const row of lpRows ?? []) leaguePlayerIds.add(row.player_id as string);

  for (const id of [...teamA, ...teamB]) {
    if (!leaguePlayerIds.has(id)) {
      return { error: `Player ${id} is not in this league roster.` };
    }
  }

  const { error } = await supabase.from("games").insert({
    session_id: sid,
    court_number: courtNumber,
    team_a_players: teamA,
    team_b_players: teamB,
    team_a_score: teamAScore,
    team_b_score: teamBScore,
    winner,
  });

  if (error) {
    if (error.code === "23505") return { error: "Duplicate game constraint." };
    return { error: error.message };
  }

  const appErr = await applySkillRatingAfterCompletedEdit(supabase, sid, wasCompleted);
  if (appErr) return { error: appErr };

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
  return { ok: true };
}

export async function deleteGame(leagueId: string, sessionId: string, gameId: string) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", lid)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { error: "Not allowed." };
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("league_id, status")
    .eq("id", sid)
    .single();

  if (!session || String(session.league_id).toLowerCase() !== lid) {
    return { error: "Invalid session." };
  }

  const { data: gameRow, error: gErr } = await supabase
    .from("games")
    .select("id, session_id")
    .eq("id", gameId)
    .maybeSingle();

  if (gErr || !gameRow || String(gameRow.session_id) !== sid) {
    return { error: "Game not found." };
  }

  const wasCompleted = session.status === "completed";
  const revErr = await reverseSkillRatingIfCompleted(supabase, sid, wasCompleted);
  if (revErr) return { error: revErr };

  const { error } = await supabase.from("games").delete().eq("id", gameId);

  if (error) return { error: error.message };

  const appErr = await applySkillRatingAfterCompletedEdit(supabase, sid, wasCompleted);
  if (appErr) return { error: appErr };

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
  return { ok: true };
}
