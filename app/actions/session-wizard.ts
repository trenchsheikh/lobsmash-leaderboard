"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import { isLeagueFormat, sessionInputModeForFormat } from "@/lib/league-format";
import {
  applySkillRatingAfterCompletedEdit,
  reverseSkillRatingIfCompleted,
} from "@/lib/session-skill-rating";
import { MAX_SESSION_COURTS, MIN_SESSION_COURTS } from "@/lib/session-courts";

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
  if (!Number.isInteger(n) || n < MIN_SESSION_COURTS || n > MAX_SESSION_COURTS) {
    return { error: `Number of courts must be ${MIN_SESSION_COURTS}–${MAX_SESSION_COURTS}.` };
  }

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("id, format")
    .eq("id", leagueId)
    .maybeSingle();

  if (lErr || !league) return { error: "League not found." };

  const formatRaw = String(league.format ?? "");
  if (!isLeagueFormat(formatRaw)) {
    return { error: "Invalid league format." };
  }
  const inputMode = sessionInputModeForFormat(formatRaw);

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      league_id: leagueId,
      created_by: user.id,
      date: dateRaw,
      status: "draft",
      num_courts: n,
      input_mode: inputMode as InputMode,
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

/** Payload from SessionCreateWizard for first persist (no session row yet). */
export type SaveNewSessionDraftPayload = {
  date: string;
  numCourts: number;
  teams: { playerA: string; playerB: string }[];
  /** Full-session mode: game rows; skipped if validation fails (session + teams still saved). */
  games: GameRowInput[] | null;
  /** Champ mode: court-1 win counts per pair; skipped if validation fails. */
  court1Rows: Court1PairWinInput[] | null;
};

/**
 * First-time save from the new-session wizard: creates the draft row, then teams and optional results.
 * Returns `sessionId` so the client can navigate to the edit page. Games/champ rows are best-effort after teams.
 */
export async function saveNewSessionDraft(
  leagueId: string,
  payload: SaveNewSessionDraftPayload,
): Promise<{ sessionId: string } | { error: string }> {
  const lid = leagueId.trim().toLowerCase();

  const created = await createSessionDraft(
    lid,
    {
      date: payload.date.trim(),
      numCourts: payload.numCourts,
    },
    { revalidate: false },
  );

  if ("error" in created && created.error) {
    return { error: created.error };
  }

  if (!("sessionId" in created) || typeof created.sessionId !== "string") {
    return { error: "Could not create session." };
  }

  const sid = created.sessionId.trim().toLowerCase();

  const { supabase } = await requireOnboarded();
  const { data: sessionRow, error: modeErr } = await supabase
    .from("sessions")
    .select("input_mode")
    .eq("id", sid)
    .maybeSingle();

  if (modeErr || !sessionRow) {
    return { error: "Could not load new session after create." };
  }

  const mode = String(sessionRow.input_mode ?? "");

  if (payload.teams.length > 0) {
    const teamRes = await upsertSessionTeams(lid, sid, payload.teams);
    if ("error" in teamRes && teamRes.error) {
      return { error: teamRes.error };
    }
  }

  if (mode === "champ_court_only" && payload.court1Rows && payload.court1Rows.length > 0) {
    const cRes = await replaceSessionCourt1PairWins(lid, sid, payload.court1Rows);
    if ("error" in cRes && cRes.error) {
      /* session + teams already persisted; user can fix results on edit */
    }
  } else if (mode !== "champ_court_only" && payload.games && payload.games.length > 0) {
    const gRes = await replaceSessionGames(lid, sid, payload.games, {
      numCourts: payload.numCourts,
    });
    if ("error" in gRes && gRes.error) {
      /* partial: draft + teams may exist */
    }
  }

  revalidatePath(`/leagues/${lid}`);
  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  return { sessionId: sid };
}

export async function updateSessionDraftMeta(
  leagueId: string,
  sessionId: string,
  input: {
    date: string;
    numCourts: number;
  },
) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();
  if (!(await requireLeagueAdmin(supabase, lid, user.id))) {
    return { error: "Not allowed." };
  }

  const dateRaw = input.date.trim();
  if (!dateRaw) return { error: "Date is required." };

  const n = Number(input.numCourts);
  if (!Number.isInteger(n) || n < MIN_SESSION_COURTS || n > MAX_SESSION_COURTS) {
    return { error: `Number of courts must be ${MIN_SESSION_COURTS}–${MAX_SESSION_COURTS}.` };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sid)
    .maybeSingle();

  if (
    sErr ||
    !session ||
    String(session.league_id).toLowerCase() !== lid
  ) {
    return { error: "Session not found." };
  }

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("format")
    .eq("id", lid)
    .maybeSingle();

  if (lErr || !league) return { error: "League not found." };
  const formatRaw = String(league.format ?? "");
  if (!isLeagueFormat(formatRaw)) {
    return { error: "Invalid league format." };
  }
  const inputMode = sessionInputModeForFormat(formatRaw);

  const { error: uErr } = await supabase
    .from("sessions")
    .update({
      date: dateRaw,
      num_courts: n,
      input_mode: inputMode as InputMode,
    })
    .eq("id", sid)
    .eq("league_id", lid);

  if (uErr) return { error: uErr.message };

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
  return { ok: true as const };
}

export async function deleteSessionDraft(leagueId: string, sessionId: string) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();
  if (!(await requireLeagueAdmin(supabase, lid, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sid)
    .maybeSingle();

  if (
    sErr ||
    !session ||
    String(session.league_id).toLowerCase() !== lid
  ) {
    return { error: "Session not found." };
  }
  if (session.status !== "draft") {
    return { error: "Only draft sessions can be deleted." };
  }

  const { error: dErr } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sid)
    .eq("league_id", lid);

  if (dErr) return { error: dErr.message };

  revalidatePath(`/leagues/${lid}`);
  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  return { ok: true as const };
}

export async function upsertSessionTeams(
  leagueId: string,
  sessionId: string,
  teams: { playerA: string; playerB: string }[],
) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();
  if (!(await requireLeagueAdmin(supabase, lid, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status")
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !session || String(session.league_id).toLowerCase() !== lid) {
    return { error: "Session not found." };
  }

  const wasCompleted = session.status === "completed";

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
    .eq("league_id", lid);

  const rosterIds = new Set((roster ?? []).map((r) => r.player_id as string));
  for (const t of teams) {
    if (!rosterIds.has(t.playerA) || !rosterIds.has(t.playerB)) {
      return { error: "All players must be on the league roster." };
    }
  }

  const revErr = await reverseSkillRatingIfCompleted(supabase, sid, wasCompleted);
  if (revErr) return { error: revErr };

  await supabase.from("session_teams").delete().eq("session_id", sid);
  await supabase.from("session_court1_pair_wins").delete().eq("session_id", sid);

  if (teams.length > 0) {
    const { error: insErr } = await supabase.from("session_teams").insert(
      teams.map((t, i) => ({
        session_id: sid,
        sort_order: i,
        player_a: t.playerA,
        player_b: t.playerB,
      })),
    );
    if (insErr) return { error: insErr.message };
  }

  const appErr = await applySkillRatingAfterCompletedEdit(supabase, sid, wasCompleted);
  if (appErr) return { error: appErr };

  const { error: syncNErr } = await supabase.rpc("sync_session_partner_notifications", {
    p_session_id: sid,
  });
  if (syncNErr) {
    console.error("sync_session_partner_notifications", syncNErr.message);
  }

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
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
};

export type Court1PairWinInput = {
  playerA: string;
  playerB: string;
  wins: number;
};

function canonicalPairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function replaceSessionCourt1PairWins(
  leagueId: string,
  sessionId: string,
  rows: Court1PairWinInput[],
) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();
  if (!(await requireLeagueAdmin(supabase, lid, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status, input_mode")
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !session || String(session.league_id).toLowerCase() !== lid) {
    return { error: "Session not found." };
  }
  if (session.input_mode !== "champ_court_only") {
    return { error: "Court 1 win counts apply to Championship court only sessions." };
  }

  const wasCompleted = session.status === "completed";

  const { data: teamRows, error: tErr } = await supabase
    .from("session_teams")
    .select("player_a, player_b")
    .eq("session_id", sid);

  if (tErr) return { error: tErr.message };

  const allowed = new Set<string>();
  for (const r of teamRows ?? []) {
    const [lo, hi] = canonicalPairIds(r.player_a as string, r.player_b as string);
    allowed.add(`${lo}\0${hi}`);
  }

  const rosterIds = new Set<string>();
  const { data: roster } = await supabase
    .from("league_players")
    .select("player_id")
    .eq("league_id", lid);
  for (const r of roster ?? []) rosterIds.add(r.player_id as string);

  for (const row of rows) {
    if (row.playerA === row.playerB) return { error: "A team cannot have the same player twice." };
    if (!rosterIds.has(row.playerA) || !rosterIds.has(row.playerB)) {
      return { error: "Player not on league roster." };
    }
    const [lo, hi] = canonicalPairIds(row.playerA, row.playerB);
    if (!allowed.has(`${lo}\0${hi}`)) {
      return { error: "Each row must match a saved team from this session." };
    }
    const w = row.wins;
    if (!Number.isInteger(w) || w < 0 || w > 999) {
      return { error: "Wins on court 1 must be an integer from 0 to 999." };
    }
  }

  const revErr = await reverseSkillRatingIfCompleted(supabase, sid, wasCompleted);
  if (revErr) return { error: revErr };

  await supabase.from("games").delete().eq("session_id", sid);
  await supabase.from("session_court1_pair_wins").delete().eq("session_id", sid);

  const toInsert = rows
    .map((row) => {
      const [player_low, player_high] = canonicalPairIds(row.playerA, row.playerB);
      return { session_id: sid, player_low, player_high, wins: row.wins };
    })
    .filter((r) => r.wins > 0);

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("session_court1_pair_wins").insert(toInsert);
    if (insErr) return { error: insErr.message };
  }

  const appErr = await applySkillRatingAfterCompletedEdit(supabase, sid, wasCompleted);
  if (appErr) return { error: appErr };

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
  return { ok: true as const };
}

export async function replaceSessionGames(
  leagueId: string,
  sessionId: string,
  games: GameRowInput[],
  meta: SessionWizardMeta,
) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();
  if (!(await requireLeagueAdmin(supabase, lid, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status, input_mode")
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !session || String(session.league_id).toLowerCase() !== lid) {
    return { error: "Session not found." };
  }
  if (session.input_mode === "champ_court_only") {
    return {
      error:
        "This session uses Championship court only — enter wins on court 1 per team (no game scores).",
    };
  }

  const wasCompleted = session.status === "completed";

  const rosterIds = new Set<string>();
  const { data: roster } = await supabase
    .from("league_players")
    .select("player_id")
    .eq("league_id", lid);
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

  const numCourts = meta.numCourts;

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

  const revErr = await reverseSkillRatingIfCompleted(supabase, sid, wasCompleted);
  if (revErr) return { error: revErr };

  await supabase.from("session_court1_pair_wins").delete().eq("session_id", sid);
  await supabase.from("games").delete().eq("session_id", sid);

  if (games.length > 0) {
    const { error: insErr } = await supabase.from("games").insert(
      games.map((g) => ({
        session_id: sid,
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

  const appErr = await applySkillRatingAfterCompletedEdit(supabase, sid, wasCompleted);
  if (appErr) return { error: appErr };

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
  return { ok: true as const };
}

export async function completeSession(
  leagueId: string,
  sessionId: string,
  meta?: SessionWizardMeta,
) {
  const { supabase, user } = await requireOnboarded();
  const lid = leagueId.trim().toLowerCase();
  const sid = sessionId.trim().toLowerCase();
  if (!(await requireLeagueAdmin(supabase, lid, user.id))) {
    return { error: "Not allowed." };
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, league_id, status, input_mode, num_courts")
    .eq("id", sid)
    .maybeSingle();

  if (sErr || !session || String(session.league_id).toLowerCase() !== lid) {
    return { error: "Session not found." };
  }
  if (session.status === "completed") {
    return { error: "Session is already completed." };
  }

  const sessionMode = session.input_mode as InputMode;
  const numCourts = meta?.numCourts ?? (session.num_courts as number) ?? 1;

  if (sessionMode === "champ_court_only") {
    const { data: c1Rows, error: c1Err } = await supabase
      .from("session_court1_pair_wins")
      .select("wins")
      .eq("session_id", sid);

    if (c1Err) return { error: c1Err.message };

    const total = (c1Rows ?? []).reduce((acc, r) => acc + (r.wins as number), 0);
    if (total <= 0) {
      return { error: "Enter at least one win on court 1 for a team before completing." };
    }
  } else {
    const { data: games, error: gErr } = await supabase
      .from("games")
      .select("court_number")
      .eq("session_id", sid);

    if (gErr) return { error: gErr.message };

    const courtSet = new Set((games ?? []).map((g) => g.court_number as number));

    if (meta) {
      for (let c = 1; c <= numCourts; c++) {
        if (!courtSet.has(c)) {
          return { error: `Court ${c} is missing a result.` };
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
  }

  const { error: uErr } = await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sid)
    .eq("league_id", lid);

  if (uErr) return { error: uErr.message };

  revalidatePath(`/leagues/${lid}/sessions/${sid}`);
  revalidatePath(`/leagues/${lid}`);
  return { ok: true as const };
}
