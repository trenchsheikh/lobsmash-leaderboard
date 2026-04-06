import type { LeagueFormat } from "@/lib/league-format";

export type { LeagueFormat };

export type LeaderboardRow = {
  player_id: string;
  name: string;
  /** From linked `users` row when present. */
  username?: string | null;
  avatar_url?: string | null;
  total_games: number;
  total_wins: number;
  court1_wins: number;
  total_points: number;
  /** Distinct completed sessions the player participated in (full scoring and/or champ court). */
  sessions_played: number;
};

/** Pair wins from completed sessions in Championship court only mode (DB: pair_championship_stats). */
export type PairChampionshipRow = {
  player_low: string;
  player_high: string;
  label: string;
  championship_wins: number;
  /** Completed champ sessions where this pair had a row (played together). */
  sessions_played: number;
};

export function sortPairChampionship(rows: PairChampionshipRow[]): PairChampionshipRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (b.championship_wins !== a.championship_wins) {
      return b.championship_wins - a.championship_wins;
    }
    if (b.sessions_played !== a.sessions_played) return b.sessions_played - a.sessions_played;
    return a.label.localeCompare(b.label);
  });
  return copy;
}

/** Championship-court leagues: total wins, then sessions played, then name. */
export function sortLeaderboardChampionshipPlayers(rows: LeaderboardRow[]): LeaderboardRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
    if (b.sessions_played !== a.sessions_played) return b.sessions_played - a.sessions_played;
    return a.name.localeCompare(b.name);
  });
  return copy;
}

/** Deterministic ordering: Summit uses wins and sessions; other formats prioritize total points. */
export function sortLeaderboard(
  format: LeagueFormat,
  rows: LeaderboardRow[],
): LeaderboardRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (format === "summit") {
      if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
      if (b.sessions_played !== a.sessions_played) return b.sessions_played - a.sessions_played;
      return a.name.localeCompare(b.name);
    }
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
    if (b.total_games !== a.total_games) return b.total_games - a.total_games;
    if (b.court1_wins !== a.court1_wins) return b.court1_wins - a.court1_wins;
    return a.name.localeCompare(b.name);
  });
  return copy;
}
