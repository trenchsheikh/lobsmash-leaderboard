export type FriendUserBrief = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url?: string | null;
};

export type FriendshipListItem = {
  id: string;
  status: "pending" | "accepted";
  requested_by: string;
  user_a: string;
  user_b: string;
  created_at: string;
  peer: FriendUserBrief;
};
