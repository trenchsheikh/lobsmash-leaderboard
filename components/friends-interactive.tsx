"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Search,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  acceptFriendRequest,
  declineOrCancelFriendRequest,
  removeFriend,
  searchUsersForFriendship,
  sendFriendRequestToUserId,
  type FriendUserBrief,
} from "@/app/actions/friends";
import type { FriendshipListItem } from "@/lib/friends-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { cn } from "@/lib/utils";

export function FriendSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<FriendUserBrief[]>([]);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      return;
    }
    start(async () => {
      const res = await searchUsersForFriendship(debounced);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setResults([]);
        return;
      }
      setResults(res.users);
    });
  }, [debounced]);

  async function add(u: FriendUserBrief) {
    setAdding(u.id);
    const res = await sendFriendRequestToUserId(u.id);
    setAdding(null);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Friend request sent");
    setQ("");
    setDebounced("");
    setResults([]);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username…"
          className="pl-9 font-mono text-sm"
          autoComplete="off"
          aria-label="Search users to add as friends"
        />
      </div>
      {pending && debounced.length >= 2 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Searching…
        </p>
      ) : null}
      {debounced.length >= 2 && !pending && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">No users match that search.</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.map((u, i) => (
            <li key={u.id}>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5",
                  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
                )}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatarDisplay
                    name={u.name}
                    username={u.username}
                    avatarUrl={u.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {u.name?.trim() || (u.username ? `@${u.username}` : "User")}
                    </p>
                    {u.username ? (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        @{u.username}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={adding === u.id}
                  onClick={() => add(u)}
                >
                  {adding === u.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Add
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FriendRequestActions({
  friendshipId,
  variant,
}: {
  friendshipId: string;
  variant: "incoming" | "outgoing";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const accept = useCallback(() => {
    start(async () => {
      const res = await acceptFriendRequest(friendshipId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("You’re now friends");
      router.refresh();
    });
  }, [friendshipId, router]);

  const decline = useCallback(() => {
    start(async () => {
      const res = await declineOrCancelFriendRequest(friendshipId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(variant === "outgoing" ? "Request cancelled" : "Request declined");
      router.refresh();
    });
  }, [friendshipId, router, variant]);

  if (variant === "incoming") {
    return (
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          className="gap-1"
          disabled={pending}
          onClick={accept}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={pending}
          onClick={decline}
        >
          <X className="size-4" />
          Decline
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={decline}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : "Cancel request"}
    </Button>
  );
}

export function RemoveFriendButton({ friendshipId }: { friendshipId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="gap-1.5 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await removeFriend(friendshipId);
          if ("error" in res && res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Removed from friends");
          router.refresh();
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UserMinus className="size-4" />
      )}
      Remove
    </Button>
  );
}

export function FriendCard({
  item,
  currentUserId,
}: {
  item: FriendshipListItem;
  currentUserId: string;
}) {
  const isIncoming =
    item.status === "pending" && item.requested_by !== currentUserId;
  const isOutgoing =
    item.status === "pending" && item.requested_by === currentUserId;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatarDisplay
          name={item.peer.name}
          username={item.peer.username}
          avatarUrl={item.peer.avatar_url}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {item.peer.name?.trim() ||
              (item.peer.username ? `@${item.peer.username}` : "User")}
          </p>
          {item.peer.username ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              @{item.peer.username}
            </p>
          ) : null}
          {isOutgoing ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">Pending</p>
          ) : null}
        </div>
      </div>
      {item.status === "pending" && isIncoming ? (
        <FriendRequestActions friendshipId={item.id} variant="incoming" />
      ) : null}
      {item.status === "pending" && isOutgoing ? (
        <FriendRequestActions friendshipId={item.id} variant="outgoing" />
      ) : null}
      {item.status === "accepted" ? (
        <RemoveFriendButton friendshipId={item.id} />
      ) : null}
    </div>
  );
}
