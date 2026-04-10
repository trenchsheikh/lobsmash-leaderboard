import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import { friendsPageDataTag } from "@/lib/cache-tags";
import type { FriendUserBrief, FriendshipListItem } from "@/lib/friends-types";
import { getClerkTokenForSupabase } from "@/lib/supabase/clerk-token";
import { createClientWithToken } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SKILL } from "@/lib/rating";

export type AggregatedFriendStat = {
  player_id: string;
  user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  /** Internal Elo-style skill (for sort / display mapping). */
  skill: number;
  total_games: number;
  total_wins: number;
  court1_wins: number;
  total_points: number;
};

async function loadFriendsPageDataUncached(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  friendships: FriendshipListItem[];
  leaderboard: AggregatedFriendStat[];
}> {

  const { data: rows, error: fErr } = await supabase
    .from("friendships")
    .select("id, user_a, user_b, requested_by, status, created_at")
    .order("created_at", { ascending: false });

  if (fErr || !rows) {
    console.error("friendships load", fErr);
    return { friendships: [], leaderboard: [] };
  }

  const peerIds = rows.map((r) =>
    r.user_a === userId ? r.user_b : r.user_a,
  );
  const uniquePeerIds = [...new Set(peerIds)];

  let userById = new Map<string, FriendUserBrief>();
  if (uniquePeerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, name, avatar_url")
      .in("id", uniquePeerIds);
    for (const u of users ?? []) {
      userById.set(u.id as string, {
        id: u.id as string,
        username: u.username as string | null,
        name: u.name as string | null,
        avatar_url: u.avatar_url as string | null,
      });
    }
  }

  const friendships: FriendshipListItem[] = rows.map((r) => {
    const peerId = r.user_a === userId ? r.user_b : r.user_a;
    const peer =
      userById.get(peerId) ?? {
        id: peerId,
        username: null,
        name: null,
        avatar_url: null,
      };
    return {
      id: r.id as string,
      status: r.status as "pending" | "accepted",
      requested_by: r.requested_by as string,
      user_a: r.user_a as string,
      user_b: r.user_b as string,
      created_at: r.created_at as string,
      peer,
    };
  });

  const acceptedFriendUserIds = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => f.peer.id);

  const leaderboardUserIds = [...new Set([userId, ...acceptedFriendUserIds])];

  const { data: players } = await supabase
    .from("players")
    .select("id, user_id, name, users ( username, avatar_url )")
    .in("user_id", leaderboardUserIds);

  const playerRows = (players ?? []) as unknown as {
    id: string;
    user_id: string;
    name: string;
    users: { username: string | null; avatar_url: string | null } | null;
  }[];

  if (playerRows.length === 0) {
    return { friendships, leaderboard: [] };
  }

  const playerIds = playerRows.map((p) => p.id);

  const { data: statsRows } = await supabase
    .from("player_stats")
    .select("player_id, total_games, total_wins, court1_wins, total_points")
    .in("player_id", playerIds);

  const { data: ratingRows } = await supabase
    .from("player_ratings")
    .select("player_id, skill")
    .in("player_id", playerIds);

  const skillByPlayerId = new Map<string, number>();
  for (const r of ratingRows ?? []) {
    skillByPlayerId.set(r.player_id as string, r.skill as number);
  }

  const agg = new Map<
    string,
    {
      total_games: number;
      total_wins: number;
      court1_wins: number;
      total_points: number;
    }
  >();

  for (const p of playerRows) {
    agg.set(p.id, {
      total_games: 0,
      total_wins: 0,
      court1_wins: 0,
      total_points: 0,
    });
  }

  for (const s of statsRows ?? []) {
    const pid = s.player_id as string;
    const cur = agg.get(pid);
    if (!cur) continue;
    cur.total_games += (s.total_games as number) ?? 0;
    cur.total_wins += (s.total_wins as number) ?? 0;
    cur.court1_wins += (s.court1_wins as number) ?? 0;
    cur.total_points += (s.total_points as number) ?? 0;
  }

  const leaderboard: AggregatedFriendStat[] = playerRows.map((p) => {
    const a = agg.get(p.id)!;
    const un = p.users?.username?.trim() ?? null;
    const av = p.users?.avatar_url?.trim() ?? null;
    return {
      player_id: p.id,
      user_id: p.user_id,
      name: p.name,
      username: un,
      avatar_url: av,
      skill: skillByPlayerId.get(p.id) ?? DEFAULT_SKILL,
      total_games: a.total_games,
      total_wins: a.total_wins,
      court1_wins: a.court1_wins,
      total_points: a.total_points,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.skill !== a.skill) return b.skill - a.skill;
    if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.total_games !== a.total_games) return b.total_games - a.total_games;
    return a.name.localeCompare(b.name);
  });

  return { friendships, leaderboard };
}

/** Cached friends feed + mini leaderboard; invalidated via `friendsPageDataTag` on mutations. */
export async function loadFriendsPageData(): Promise<{
  friendships: FriendshipListItem[];
  leaderboard: AggregatedFriendStat[];
}> {
  const { user } = await requireOnboarded();
  const { getToken } = await auth();
  const token = await getClerkTokenForSupabase(getToken);
  const supabase = createClientWithToken(token);

  return unstable_cache(
    async () => loadFriendsPageDataUncached(supabase, user.id),
    ["friends-page", user.id],
    { tags: [friendsPageDataTag(user.id)], revalidate: 120 },
  )();
}
