export type LeagueFormat = "king_of_court" | "americano";

export type LeaderboardRow = {
  player_id: string;
  name: string;
  total_games: number;
  total_wins: number;
  court1_wins: number;
  total_points: number;
};

/** Deterministic ordering: KoC prioritizes court 1 wins; Americano prioritizes total points. */
export function sortLeaderboard(
  format: LeagueFormat,
  rows: LeaderboardRow[],
): LeaderboardRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (format === "king_of_court") {
      if (b.court1_wins !== a.court1_wins) return b.court1_wins - a.court1_wins;
      if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
      if (b.total_games !== a.total_games) return b.total_games - a.total_games;
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
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
