"use client";

import { useTransition } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { getLeagueSessionSharePayload } from "@/app/actions/session-wizard";
import {
  formatSessionLevelRange,
  formatSessionWhenPlain,
} from "@/lib/league-session-share-text";
import { runGameShare } from "@/components/share-button";
import { Button } from "@/components/ui/button";

type Props = {
  leagueId: string;
  sessionId: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function LeagueSessionShareButton({
  leagueId,
  sessionId,
  className,
  size = "default",
  variant = "outline",
}: Props) {
  const [pending, startTransition] = useTransition();

  function onShare() {
    startTransition(async () => {
      const res = await getLeagueSessionSharePayload(leagueId, sessionId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const d = res.data;
      const cap = Math.max(0, d.numCourts * 4);
      const filled = d.playerIdsInOrder.length;
      const outcome = await runGameShare({
        gameId: sessionId,
        location: d.location?.trim() || "—",
        time: formatSessionWhenPlain({
          sessionDate: d.sessionDate,
          scheduledAt: d.scheduledAt,
          durationMinutes: d.durationMinutes,
        }),
        level: formatSessionLevelRange(d.skillsByPlayerId, d.playerIdsInOrder),
        players: `${filled}/${cap} players`,
      });
      if (outcome === "copied") {
        toast.success("Copied match details");
      } else if (outcome === "failed") {
        toast.error("Could not share");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => onShare()}
    >
      <Share2 className="size-4" aria-hidden />
      {pending ? "Sharing…" : "Share match"}
    </Button>
  );
}
