"use server";

import { refresh, revalidatePath, revalidateTag } from "next/cache";
import { friendsPageDataTag } from "@/lib/cache-tags";
import { requireOnboarded } from "@/lib/auth/profile";
import type { FriendUserBrief } from "@/lib/friends-types";
import { normalizeUsername } from "@/lib/username";

export type { FriendUserBrief, FriendshipListItem } from "@/lib/friends-types";

function canonicalPair(me: string, other: string): [string, string] {
  return me < other ? [me, other] : [other, me];
}

function revalidateFriendsForUsers(...userIds: string[]) {
  revalidatePath("/friends");
  for (const id of new Set(userIds)) {
    revalidateTag(friendsPageDataTag(id), "max");
  }
  refresh();
}

export async function searchUsersForFriendship(query: string) {
  const { supabase } = await requireOnboarded();
  const q = normalizeUsername(String(query)).replace(/[%_]/g, "");
  if (q.length < 2) return { users: [] as FriendUserBrief[] };

  const { data, error } = await supabase.rpc("search_users_for_friendship", {
    p_query: q,
  });

  if (error) return { error: error.message, users: [] as FriendUserBrief[] };
  const rows = (data ?? []) as {
    id: string;
    username: string;
    name: string | null;
    avatar_url: string | null;
  }[];
  return {
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      name: r.name,
      avatar_url: r.avatar_url,
    })),
  };
}

export async function sendFriendRequestByUsername(usernameRaw: string) {
  const { supabase, user } = await requireOnboarded();
  const username = normalizeUsername(usernameRaw.replace(/^@/, ""));
  if (username.length < 3) return { error: "Enter a valid username." };

  const { data: targetId, error: rErr } = await supabase.rpc(
    "user_id_by_username",
    { p_username: username },
  );

  if (rErr) return { error: rErr.message };
  const target = typeof targetId === "string" ? targetId : null;
  if (!target) return { error: "No user found with that username." };
  if (target === user.id) return { error: "You cannot add yourself." };

  const [user_a, user_b] = canonicalPair(user.id, target);

  const { error } = await supabase.from("friendships").insert({
    user_a,
    user_b,
    requested_by: user.id,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A request or friendship already exists with this person." };
    }
    return { error: error.message };
  }

  revalidateFriendsForUsers(user.id, target);
  return { ok: true };
}

export async function sendFriendRequestToUserId(targetId: string) {
  const { supabase, user } = await requireOnboarded();
  if (targetId === user.id) return { error: "You cannot add yourself." };

  const [user_a, user_b] = canonicalPair(user.id, targetId);

  const { error } = await supabase.from("friendships").insert({
    user_a,
    user_b,
    requested_by: user.id,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A request or friendship already exists with this person." };
    }
    return { error: error.message };
  }

  revalidateFriendsForUsers(user.id, targetId);
  return { ok: true };
}

export async function acceptFriendRequest(friendshipId: string) {
  const { supabase } = await requireOnboarded();

  const { data: row, error: selErr } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .eq("id", friendshipId)
    .maybeSingle();

  if (selErr) return { error: selErr.message };
  if (!row) return { error: "Request not found." };

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidateFriendsForUsers(row.user_a as string, row.user_b as string);
  return { ok: true };
}

export async function declineOrCancelFriendRequest(friendshipId: string) {
  const { supabase } = await requireOnboarded();

  const { data: row, error: selErr } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .eq("id", friendshipId)
    .maybeSingle();

  if (selErr) return { error: selErr.message };
  if (!row) return { error: "Request not found." };

  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

  if (error) return { error: error.message };

  revalidateFriendsForUsers(row.user_a as string, row.user_b as string);
  return { ok: true };
}

export async function removeFriend(friendshipId: string) {
  return declineOrCancelFriendRequest(friendshipId);
}
