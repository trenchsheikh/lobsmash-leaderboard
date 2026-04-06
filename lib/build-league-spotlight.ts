import type { SpotlightPair, SpotlightPlayer } from "@/components/league/league-spotlight-podium";
import type { LeaderboardRow, PairChampionshipRow } from "@/lib/leaderboard";
import type { LeagueFormat } from "@/lib/league-format";

type RosterInfo = {
  name: string;
  username: string | null;
  avatar_url: string | null;
};

export function buildSpotlightPlayers(
  leaderboard: LeaderboardRow[],
  rosterByPlayerId: Map<string, RosterInfo>,
  leagueFormat: LeagueFormat,
): SpotlightPlayer[] {
  return leaderboard.slice(0, 3).map((row, i) => {
    const r = rosterByPlayerId.get(row.player_id);
    return {
      playerId: row.player_id,
      rank: (i + 1) as 1 | 2 | 3,
      name: r?.name ?? row.name,
      username: row.username ?? r?.username ?? null,
      avatarUrl: row.avatar_url ?? r?.avatar_url ?? null,
      statLeft:
        leagueFormat === "summit"
          ? { label: "Sessions", value: row.sessions_played }
          : { label: "Points", value: row.total_points },
      statRight:
        leagueFormat === "summit"
          ? { label: "Wins", value: row.total_wins }
          : { label: "Games", value: row.total_games },
    };
  });
}

export function buildSpotlightPairs(
  pairLeaderboard: PairChampionshipRow[],
  pairPlayerMetaById: Map<string, RosterInfo> | Record<string, RosterInfo>,
  rosterByPlayerId: Map<string, RosterInfo>,
): SpotlightPair[] {
  const meta = (id: string) =>
    pairPlayerMetaById instanceof Map
      ? pairPlayerMetaById.get(id)
      : pairPlayerMetaById[id];

  return pairLeaderboard.slice(0, 3).map((row, i) => ({
    playerLow: row.player_low,
    playerHigh: row.player_high,
    rank: (i + 1) as 1 | 2 | 3,
    label: row.label,
    p1: {
      playerId: row.player_low,
      name: meta(row.player_low)?.name ?? "Player",
      username: meta(row.player_low)?.username ?? null,
      avatarUrl:
        meta(row.player_low)?.avatar_url ?? rosterByPlayerId.get(row.player_low)?.avatar_url ?? null,
    },
    p2: {
      playerId: row.player_high,
      name: meta(row.player_high)?.name ?? "Player",
      username: meta(row.player_high)?.username ?? null,
      avatarUrl:
        meta(row.player_high)?.avatar_url ?? rosterByPlayerId.get(row.player_high)?.avatar_url ?? null,
    },
    statLeft: { label: "Champ wins", value: row.championship_wins },
    statRight: { label: "Sessions", value: row.sessions_played },
  }));
}
