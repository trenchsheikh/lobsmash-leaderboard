"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteGame } from "@/app/actions/games";
import { Button } from "@/components/ui/button";

export function DeleteGameButton({
  leagueId,
  sessionId,
  gameId,
}: {
  leagueId: string;
  sessionId: string;
  gameId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await deleteGame(leagueId, sessionId, gameId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Game removed");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onClick}>
      Remove
    </Button>
  );
}
