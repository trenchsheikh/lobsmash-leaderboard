"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { acceptFriendRequest, declineOrCancelFriendRequest } from "@/app/actions/friends";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { cn } from "@/lib/utils";

type FriendFeedItem = {
  kind: "friend";
  friendshipId: string;
  createdAt: string;
  peer: {
    id: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
};

type SessionPartnerFeedItem = {
  kind: "session_partner";
  id: string;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

type ReminderFeedItem = {
  kind: "reminder";
  key: string;
  sessionId: string;
  leagueId: string;
  leagueName: string;
  sessionDate: string;
  when: "today" | "tomorrow";
};

type NotificationsResponse = {
  friends: FriendFeedItem[];
  sessionPartner: SessionPartnerFeedItem[];
  reminders: ReminderFeedItem[];
  badgeCount: number;
};

function payloadStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

const DISMISSED_REMINDER_KEYS_LS = "lobsmah-dismissed-session-reminders";

function loadDismissedReminderKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_REMINDER_KEYS_LS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [pendingFriend, startFriend] = useTransition();
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissedReminderKeys(loadDismissedReminderKeys());
  }, []);

  useEffect(() => {
    if (!data) return;
    const valid = new Set(data.reminders.map((r) => r.key));
    setDismissedReminderKeys((prev) => {
      const next = new Set([...prev].filter((k) => valid.has(k)));
      if (next.size === prev.size) return prev;
      try {
        localStorage.setItem(DISMISSED_REMINDER_KEYS_LS, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [data]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as NotificationsResponse;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!open) return;
    void loadFeed();
  }, [open, loadFeed]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* best-effort */
    }
  }

  async function onViewSession(notificationId: string | null, path: string) {
    if (notificationId) await markRead([notificationId]);
    setOpen(false);
    router.push(path);
    router.refresh();
    void loadFeed();
  }

  function dismissReminder(key: string) {
    setDismissedReminderKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(DISMISSED_REMINDER_KEYS_LS, JSON.stringify([...next]));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }

  async function dismissSessionPartnerNotification(id: string) {
    await markRead([id]);
    void loadFeed();
  }

  const friends = data?.friends ?? [];
  const sessionPartnerUnread = useMemo(
    () => (data?.sessionPartner ?? []).filter((n) => n.readAt == null),
    [data?.sessionPartner],
  );
  const remindersAll = data?.reminders ?? [];
  const visibleReminders = useMemo(
    () => remindersAll.filter((r) => !dismissedReminderKeys.has(r.key)),
    [remindersAll, dismissedReminderKeys],
  );
  const hasAny =
    friends.length > 0 || sessionPartnerUnread.length > 0 || visibleReminders.length > 0;
  const displayBadgeCount =
    friends.length + sessionPartnerUnread.length + visibleReminders.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative shrink-0",
        )}
        aria-label="Notifications"
      >
        <Bell className="size-5" aria-hidden />
        {data != null && displayBadgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {displayBadgeCount > 99 ? "99+" : displayBadgeCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-1.5rem,22rem)] min-w-[min(100vw-1.5rem,22rem)] p-0"
      >
        <div className="border-b border-border/80 px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <ScrollArea className="max-h-[min(360px,70dvh)]">
          <div className="p-2">
            {loading && !data ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : !hasAny ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              <div className="flex flex-col gap-4">
                {friends.length > 0 ? (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2 py-1.5">Friend requests</DropdownMenuLabel>
                    <ul className="flex flex-col gap-2">
                      {friends.map((f) => (
                        <li
                          key={f.friendshipId}
                          className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/25 px-2 py-2"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <UserAvatarDisplay
                              name={f.peer.name}
                              username={f.peer.username}
                              avatarUrl={f.peer.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {f.peer.name?.trim() ||
                                  (f.peer.username ? `@${f.peer.username}` : "User")}
                              </p>
                              {f.peer.username ? (
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                  @{f.peer.username}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="default"
                              className="size-8"
                              disabled={pendingFriend}
                              aria-label="Accept friend request"
                              onClick={() => {
                                startFriend(async () => {
                                  const res = await acceptFriendRequest(f.friendshipId);
                                  if ("error" in res && res.error) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  toast.success("You’re now friends");
                                  router.refresh();
                                  void loadFeed();
                                });
                              }}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-8"
                              disabled={pendingFriend}
                              aria-label="Decline friend request"
                              onClick={() => {
                                startFriend(async () => {
                                  const res = await declineOrCancelFriendRequest(f.friendshipId);
                                  if ("error" in res && res.error) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  toast.success("Request declined");
                                  router.refresh();
                                  void loadFeed();
                                });
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </DropdownMenuGroup>
                ) : null}

                {friends.length > 0 && (sessionPartnerUnread.length > 0 || visibleReminders.length > 0) ? (
                  <DropdownMenuSeparator className="my-0" />
                ) : null}

                {sessionPartnerUnread.length > 0 ? (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2 py-1.5">Sessions</DropdownMenuLabel>
                    <ul className="flex flex-col gap-2">
                      {sessionPartnerUnread.map((n) => {
                        const p = n.payload;
                        const sessionId = payloadStr(p.session_id);
                        const leagueId = payloadStr(p.league_id);
                        const partnerName = payloadStr(p.partner_name) ?? "Your partner";
                        const leagueName = payloadStr(p.league_name);
                        const sessionDate = payloadStr(p.session_date);
                        const href =
                          sessionId && leagueId
                            ? `/leagues/${leagueId}/sessions/${sessionId}`
                            : null;
                        return (
                          <li
                            key={n.id}
                            className="relative rounded-lg border border-border/60 bg-primary/5 py-2 pl-2 pr-9"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0.5 top-0.5 size-7 text-muted-foreground hover:text-foreground"
                              aria-label="Dismiss notification"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                void dismissSessionPartnerNotification(n.id);
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                            <p className="text-sm font-medium leading-snug">
                              Partner: {partnerName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {[leagueName, sessionDate].filter(Boolean).join(" · ")}
                            </p>
                            {href ? (
                              <Button
                                type="button"
                                variant="link"
                                className="mt-1 h-auto p-0 text-xs font-medium"
                                onClick={() => onViewSession(n.id, href)}
                              >
                                <ExternalLink className="mr-1 size-3.5" />
                                View session
                              </Button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </DropdownMenuGroup>
                ) : null}

                {sessionPartnerUnread.length > 0 && visibleReminders.length > 0 ? (
                  <DropdownMenuSeparator className="my-0" />
                ) : null}

                {visibleReminders.length > 0 ? (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2 py-1.5">Reminders</DropdownMenuLabel>
                    <ul className="flex flex-col gap-2">
                      {visibleReminders.map((r) => {
                        const href = `/leagues/${r.leagueId}/sessions/${r.sessionId}`;
                        const whenLabel = r.when === "today" ? "Today" : "Tomorrow";
                        return (
                          <li
                            key={r.key}
                            className="relative rounded-lg border border-border/60 bg-muted/25 py-2 pl-2 pr-9"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0.5 top-0.5 size-7 text-muted-foreground hover:text-foreground"
                              aria-label="Dismiss reminder"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissReminder(r.key);
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                            <p className="text-sm font-medium">{whenLabel}: session</p>
                            <p className="text-xs text-muted-foreground">
                              {r.leagueName} · {r.sessionDate}
                            </p>
                            <Button
                              type="button"
                              variant="link"
                              className="mt-1 h-auto p-0 text-xs font-medium"
                              onClick={() => onViewSession(null, href)}
                            >
                              <ExternalLink className="mr-1 size-3.5" />
                              View session
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </DropdownMenuGroup>
                ) : null}
              </div>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
