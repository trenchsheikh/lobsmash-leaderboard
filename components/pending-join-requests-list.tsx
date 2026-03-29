"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptJoinRequest, declineJoinRequest } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { UserAvatarDisplay } from "@/components/user-avatar-display";

export type PendingJoinRequestRow = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Props = {
  requests: PendingJoinRequestRow[];
};

export function PendingJoinRequestsList({ requests }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onAccept(id: string) {
    setBusyId(id);
    const res = await acceptJoinRequest(id);
    setBusyId(null);
    if (res && "error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Member added");
    router.refresh();
  }

  async function onDecline(id: string) {
    setBusyId(id);
    const res = await declineJoinRequest(id);
    setBusyId(null);
    if (res && "error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Request declined");
    router.refresh();
  }

  if (requests.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/15 px-3 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatarDisplay
              name={r.name}
              username={r.username}
              avatarUrl={r.avatar_url}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium">
                {r.username ? `@${r.username}` : "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{r.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyId !== null}
              onClick={() => void onDecline(r.id)}
            >
              Decline
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busyId !== null}
              onClick={() => void onAccept(r.id)}
            >
              Accept
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
