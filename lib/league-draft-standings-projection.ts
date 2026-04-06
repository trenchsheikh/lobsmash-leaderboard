import type { LeagueFormat } from "@/lib/league-format";
import {
  sortLeaderboard,
  sortLeaderboardChampionshipPlayers,
  sortPairChampionship,
  type LeaderboardRow,
  type PairChampionshipRow,
} from "@/lib/leaderboard";

export type DraftSessionMeta = {
  id: string;
  input_mode: string | null;
  created_at: string;
};

export type GameRow = {
  session_id: string;
  court_number: number;
  team_a_players: string[];
  team_b_players: string[];
  team_a_score: number;
  team_b_score: number;
  winner: "team_a" | "team_b";
};

export type Court1PairWinRow = {
  session_id: string;
  player_low: string;
  player_high: string;
  wins: number;
};

export type PlayerDraftDelta = {
  total_games: number;
  total_wins: number;
  court1_wins: number;
  total_points: number;
  /** Distinct draft sessions (full mode) this player appeared in. */
  sessions_full: Set<string>;
  /** Distinct draft sessions (champ mode) this player had court-1 data in. */
  sessions_champ: Set<string>;
};

function emptyDelta(): PlayerDraftDelta {
  return {
    total_games: 0,
    total_wins: 0,
    court1_wins: 0,
    total_points: 0,
    sessions_full: new Set(),
    sessions_champ: new Set(),
  };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * Aggregate per-player and per-pair contributions from draft sessions only,
 * mirroring `recalculate_player_stats_for_league` / pair championship stats.
 */
export function computeDraftDeltas(args: {
  draftSessions: DraftSessionMeta[];
  games: GameRow[];
  court1Wins: Court1PairWinRow[];
}): {
  byPlayer: Map<string, PlayerDraftDelta>;
  pairWins: Map<string, { wins: number; sessions: Set<string> }>;
} {
  const draftIds = new Set(args.draftSessions.map((s) => s.id));
  const byPlayer = new Map<string, PlayerDraftDelta>();
  const pairWins = new Map<string, { wins: number; sessions: Set<string> }>();

  function bump(pid: string): PlayerDraftDelta {
    let d = byPlayer.get(pid);
    if (!d) {
      d = emptyDelta();
      byPlayer.set(pid, d);
    }
    return d;
  }

  const inputMode = (id: string) =>
    args.draftSessions.find((s) => s.id === id)?.input_mode ?? "full";

  for (const g of args.games) {
    if (!draftIds.has(g.session_id)) continue;
    if (inputMode(g.session_id) === "champ_court_only") continue;

    const cn = g.court_number;
    const teams: [string[], string[]] = [g.team_a_players ?? [], g.team_b_players ?? []];
    const winIdx = g.winner === "team_a" ? 0 : 1;

    for (const pid of teams[0]) {
      const d = bump(pid);
      d.total_games += 1;
      d.total_points += winIdx === 0 ? g.team_a_score : g.team_b_score;
      d.sessions_full.add(g.session_id);
      if (winIdx === 0) {
        d.total_wins += 1;
        if (cn === 1) d.court1_wins += 1;
      }
    }
    for (const pid of teams[1]) {
      const d = bump(pid);
      d.total_games += 1;
      d.total_points += winIdx === 1 ? g.team_b_score : g.team_a_score;
      d.sessions_full.add(g.session_id);
      if (winIdx === 1) {
        d.total_wins += 1;
        if (cn === 1) d.court1_wins += 1;
      }
    }
  }

  for (const sc of args.court1Wins) {
    if (!draftIds.has(sc.session_id)) continue;
    if (inputMode(sc.session_id) !== "champ_court_only") continue;

    const low = sc.player_low;
    const high = sc.player_high;
    const w = Math.max(0, sc.wins | 0);
    if (w <= 0) continue;

    const pk = pairKey(low, high);
    let pr = pairWins.get(pk);
    if (!pr) {
      pr = { wins: 0, sessions: new Set() };
      pairWins.set(pk, pr);
    }
    pr.wins += w;
    pr.sessions.add(sc.session_id);

    for (const pid of [low, high]) {
      const d = bump(pid);
      d.total_games += w;
      d.total_wins += w;
      d.court1_wins += w;
      d.sessions_champ.add(sc.session_id);
    }
  }

  return { byPlayer, pairWins };
}

export function mergeLeaderboardWithDraft(args: {
  official: LeaderboardRow[];
  byPlayer: Map<string, PlayerDraftDelta>;
  format: LeagueFormat;
  /** Names/avatars for players who may only appear in draft rows. */
  rosterByPlayerId?: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
}): LeaderboardRow[] {
  const byId = new Map(args.official.map((r) => [r.player_id, { ...r }]));

  for (const [pid, d] of args.byPlayer) {
    const base = byId.get(pid);
    const roster = args.rosterByPlayerId?.[pid];
    const merged: LeaderboardRow = {
      player_id: pid,
      name: base?.name ?? roster?.name ?? "Player",
      username: base?.username ?? roster?.username ?? null,
      avatar_url: base?.avatar_url ?? roster?.avatar_url ?? null,
      total_games: (base?.total_games ?? 0) + d.total_games,
      total_wins: (base?.total_wins ?? 0) + d.total_wins,
      court1_wins: (base?.court1_wins ?? 0) + d.court1_wins,
      total_points: (base?.total_points ?? 0) + d.total_points,
      sessions_played:
        (base?.sessions_played ?? 0) + d.sessions_full.size + d.sessions_champ.size,
    };
    byId.set(pid, merged);
  }

  const rows = [...byId.values()];
  return args.format === "summit"
    ? sortLeaderboardChampionshipPlayers(rows)
    : sortLeaderboard(args.format, rows);
}

export function mergePairLeaderboardWithDraft(args: {
  official: PairChampionshipRow[];
  pairDraft: Map<string, { wins: number; sessions: Set<string> }>;
  pairPlayerMetaById: Record<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >;
}): PairChampionshipRow[] {
  const byKey = new Map<string, PairChampionshipRow>();

  for (const r of args.official) {
    byKey.set(pairKey(r.player_low, r.player_high), { ...r });
  }

  for (const [pk, pr] of args.pairDraft) {
    const [pl, ph] = pk.split("\0");
    const n1 = args.pairPlayerMetaById[pl]?.name ?? "Player";
    const n2 = args.pairPlayerMetaById[ph]?.name ?? "Player";
    const names = [n1, n2].sort((a, b) => a.localeCompare(b));
    const label = `${names[0]} & ${names[1]}`;
    const cur = byKey.get(pk);
    const merged: PairChampionshipRow = {
      player_low: pl,
      player_high: ph,
      label,
      championship_wins: (cur?.championship_wins ?? 0) + pr.wins,
      sessions_played: (cur?.sessions_played ?? 0) + pr.sessions.size,
    };
    byKey.set(pk, merged);
  }

  return sortPairChampionship([...byKey.values()]);
}
