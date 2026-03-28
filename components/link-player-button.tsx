"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { linkMemberPlayer } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";

export function LinkPlayerButton({
  leagueId,
  targetUserId,
}: {
  leagueId: string;
  targetUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await linkMemberPlayer(leagueId, targetUserId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Player linked");
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" disabled={pending} onClick={onClick}>
      Link player to roster
    </Button>
  );
}
