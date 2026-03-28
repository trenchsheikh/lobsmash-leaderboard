"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";

export type InputMode = "full" | "champ_court_only";

async function requireLeagueAdmin(
  supabase: Awaited<ReturnType<typeof requireOnboarded>>["supabase"],
  leagueId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data.role !== "owner" && data.role !== "admin")) return null;
  return data.role as string;
}

export async function createSessionDraft(
  leagueId: string,
  input: {
    date: string;
    numCourts: number;
    inputMode: InputMode;
  },
  options?: { revalidate?: boolean },
) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, leagueId, user.id))) {
    return { error: "Not allowed." };
  }

  const dateRaw = input.date.trim();
  if (!dateRaw) return { error: "Date is required." };

  const n = Number(input.numCourts);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    return { error: "Number of courts must be 1–12." };
  }
  if (input.inputMode !== "full" && input.inputMode !== "champ_court_only") {
    return { error: "Invalid input mode." };
  }

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("id")
    .eq("id", leagueId)
    .maybeSingle();

  if (lErr || !league) return { error: "League not found." };

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      league_id: leagueId,
      created_by: user.id,
      date: dateRaw,
      status: "draft",
      num_courts: n,
      input_mode: input.inputMode,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const sessionId = data.id as string;

  if (options?.revalidate !== false) {
    revalidatePath(`/leagues/${leagueId}`);
  }
  return { sessionId };
}

export async function updateSessionDraftMeta(
  leagueId: string,
  sessionId: string,
  input: {
    date: string;
    numCourts: number;
    inputMode: InputMode;
  },
) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, leagueId, user.id))) {
    return { error: "Not allowed." };
  }

  const dateRaw = input.date.trim();
  if (!dateRaw) return { error: "Date is required." };

  const n = Number(input.numCourts);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    return { error: "Number of courts must be 1–12." };
  }
  if (input.inputMode !== "full" && input.inputMode !== "champ_court_only") {
    return { error: "Invalid input mode." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session || session.league_id !== leagueId) {
    return { error: "Session not found." };
  }
  if (session.status === "completed") {
    return { error: "Cannot edit a completed session." };
  }

  const { error: uErr } = await supabase
    .from("sessions")
    .update({
      date: dateRaw,
      num_courts: n,
      input_mode: input.inputMode,
    })
    .eq("id", sessionId)
    .eq("league_id", leagueId);

  if (uErr) return { error: uErr.message };

  revalidatePath(`/leagues/${leagueId}/sessions/${sessionId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true as const };
}

export async function upsertSessionTeams(
  leagueId: string,
  sessionId: string,
  teams: { playerA: string; playerB: string }[],
) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, leagueId, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session || session.league_id !== leagueId) {
    return { error: "Session not found." };
  }
  if (session.status === "completed") {
    return { error: "Cannot edit teams on a completed session." };
  }

  const seen = new Set<string>();
  for (const t of teams) {
    if (t.playerA === t.playerB) return { error: "A team cannot have the same player twice." };
    for (const p of [t.playerA, t.playerB]) {
      if (seen.has(p)) return { error: "Each player can only be on one team." };
      seen.add(p);
    }
  }

  const { data: roster } = await supabase
    .from("league_players")
    .select("player_id")
    .eq("league_id", leagueId);

  const rosterIds = new Set((roster ?? []).map((r) => r.player_id as string));
  for (const t of teams) {
    if (!rosterIds.has(t.playerA) || !rosterIds.has(t.playerB)) {
      return { error: "All players must be on the league roster." };
    }
  }

  await supabase.from("session_teams").delete().eq("session_id", sessionId);

  if (teams.length > 0) {
    const { error: insErr } = await supabase.from("session_teams").insert(
      teams.map((t, i) => ({
        session_id: sessionId,
        sort_order: i,
        player_a: t.playerA,
        player_b: t.playerB,
      })),
    );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath(`/leagues/${leagueId}/sessions/${sessionId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true as const };
}

export type GameRowInput = {
  courtNumber: number;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
  teamAScore: number;
  teamBScore: number;
  winner: "team_a" | "team_b";
};

export type SessionWizardMeta = {
  numCourts: number;
  inputMode: InputMode;
};

export async function replaceSessionGames(
  leagueId: string,
  sessionId: string,
  games: GameRowInput[],
  meta: SessionWizardMeta,
) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, leagueId, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session || session.league_id !== leagueId) {
    return { error: "Session not found." };
  }
  if (session.status === "completed") {
    return { error: "Cannot edit games on a completed session." };
  }

  const rosterIds = new Set<string>();
  const { data: roster } = await supabase
    .from("league_players")
    .select("player_id")
    .eq("league_id", leagueId);
  for (const r of roster ?? []) rosterIds.add(r.player_id as string);

  const courtsWithAtLeastOneGame = new Set<number>();
  for (const g of games) {
    if (!Number.isInteger(g.courtNumber) || g.courtNumber < 1) {
      return { error: "Invalid court number." };
    }

    const a = g.teamAPlayers;
    const b = g.teamBPlayers;
    if (a.length !== 2 || b.length !== 2) {
      return { error: "Each team must have exactly two players." };
    }
    const all = [...a, ...b];
    const uniq = new Set(all);
    if (uniq.size !== 4) return { error: "Duplicate players on a court." };
    for (const id of all) {
      if (!rosterIds.has(id)) return { error: "Player not on league roster." };
    }

    if (g.winner !== "team_a" && g.winner !== "team_b") {
      return { error: "Invalid winner." };
    }
    const { teamAScore: sa, teamBScore: sb } = g;
    if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) {
      return { error: "Scores must be non-negative integers." };
    }
    if (sa === sb) return { error: "Scores cannot be tied." };
    if (g.winner === "team_a" && sa <= sb) return { error: "Winner does not match scores." };
    if (g.winner === "team_b" && sb <= sa) return { error: "Winner does not match scores." };
    courtsWithAtLeastOneGame.add(g.courtNumber);
  }

  const mode = meta.inputMode;
  const numCourts = meta.numCourts;

  if (mode === "champ_court_only") {
    if (games.length === 0) {
      return { error: "Add at least one game." };
    }
    for (const g of games) {
      if (g.courtNumber !== 1) {
        return { error: "Championship mode only records games on court 1." };
      }
    }
  } else {
    if (games.length === 0) {
      return { error: "Add at least one game." };
    }
    for (const g of games) {
      if (g.courtNumber > numCourts) {
        return { error: `Court number must be between 1 and ${numCourts}.` };
      }
    }
    for (let c = 1; c <= numCourts; c++) {
      if (!courtsWithAtLeastOneGame.has(c)) {
        return { error: `Add at least one result for court ${c} (you can add extra games on any court).` };
      }
    }
  }

  await supabase.from("games").delete().eq("session_id", sessionId);

  if (games.length > 0) {
    const { error: insErr } = await supabase.from("games").insert(
      games.map((g) => ({
        session_id: sessionId,
        court_number: g.courtNumber,
        team_a_players: g.teamAPlayers,
        team_b_players: g.teamBPlayers,
        team_a_score: g.teamAScore,
        team_b_score: g.teamBScore,
        winner: g.winner,
      })),
    );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath(`/leagues/${leagueId}/sessions/${sessionId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true as const };
}

export async function completeSession(
  leagueId: string,
  sessionId: string,
  meta?: SessionWizardMeta,
) {
  const { supabase, user } = await requireOnboarded();
  if (!(await requireLeagueAdmin(supabase, leagueId, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session || session.league_id !== leagueId) {
    return { error: "Session not found." };
  }
  if (session.status === "completed") {
    return { error: "Session is already completed." };
  }

  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("court_number")
    .eq("session_id", sessionId);

  if (gErr) return { error: gErr.message };

  const courtSet = new Set((games ?? []).map((g) => g.court_number as number));

  if (meta) {
    if (meta.inputMode === "champ_court_only") {
      if (!courtSet.has(1)) {
        return { error: "Add a result for court 1 before completing." };
      }
    } else {
      for (let c = 1; c <= meta.numCourts; c++) {
        if (!courtSet.has(c)) {
          return { error: `Court ${c} is missing a result.` };
        }
      }
    }
  } else {
    if (courtSet.size === 0) {
      return { error: "Add at least one game before completing." };
    }
    const maxC = Math.max(...courtSet);
    for (let c = 1; c <= maxC; c++) {
      if (!courtSet.has(c)) {
        return { error: `Court ${c} is missing a result.` };
      }
    }
  }

  const { error: uErr } = await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId)
    .eq("league_id", leagueId);

  if (uErr) return { error: uErr.message };

  revalidatePath(`/leagues/${leagueId}/sessions/${sessionId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true as const };
}
