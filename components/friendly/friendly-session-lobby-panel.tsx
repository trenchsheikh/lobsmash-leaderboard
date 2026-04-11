"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { swapFriendlyRosterSlots } from "@/app/actions/friendly-sessions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InviteLinkShareButton } from "@/components/invite-link-share-button";
import {
  FriendlySessionCard,
  type FriendlySlotDisplay,
} from "@/components/friendly/friendly-session-card";
import { FriendlyPickupResults } from "@/components/friendly/friendly-pickup-results";

type Props = {
  sessionId: string;
  title: string | null;
  startsAt: string | null;
  capacity: number;
  status: string;
  matchKind: "friendly" | "competitive";
  ratingBandLabel: string | null;
  teamA: FriendlySlotDisplay[];
  teamB: FriendlySlotDisplay[];
  isCreator: boolean;
  creatorUserId: string;
  currentUserId: string;
  inviteUrl: string;
  skillRatingAppliedAt: string | null;
  leftPlayerIds: string[];
  rightPlayerIds: string[];
  rosterFull: boolean;
  competitiveApprovalUserIds: string[];
  rosterUserIds: string[];
  initialGames: Array<{
    court_number: number;
    team_a_players: string[];
    team_b_players: string[];
    team_a_score: number;
    team_b_score: number;
    winner: string;
  }>;
};

export function FriendlySessionLobbyPanel({
  sessionId,
  title,
  startsAt,
  capacity,
  status,
  matchKind,
  ratingBandLabel,
  teamA,
  teamB,
  isCreator,
  creatorUserId,
  currentUserId,
  inviteUrl,
  skillRatingAppliedAt,
  leftPlayerIds,
  rightPlayerIds,
  rosterFull,
  competitiveApprovalUserIds,
  rosterUserIds,
  initialGames,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [swapMode, setSwapMode] = useState(false);
  const [selected, setSelected] = useState<[number | null, number | null]>([null, null]);

  const filledSlotUserIds = new Set(
    [...teamA, ...teamB].map((s) => s.userId).filter(Boolean) as string[],
  );
  const canSwap = filledSlotUserIds.has(currentUserId) && status === "open";

  function onSlotClick(slotIndex: number) {
    if (!swapMode) return;
    const slot = [...teamA, ...teamB].find((s) => s.slotIndex === slotIndex);
    if (!slot?.userId) return;

    setSelected((prev) => {
      const [a, b] = prev;
      if (a === null) return [slotIndex, null];
      if (b === null && slotIndex !== a) return [a, slotIndex];
      if (slotIndex === a || slotIndex === b) return [null, null];
      return [slotIndex, null];
    });
  }

  function doSwap() {
    const [a, b] = selected;
    if (a == null || b == null) return;
    startTransition(async () => {
      const res = await swapFriendlyRosterSlots(sessionId, a, b);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Swapped");
      setSelected([null, null]);
      setSwapMode(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {isCreator ? (
        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Invite link</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this link so players can request to join. Approve requests from your dashboard.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-border/80 bg-background px-2 py-1.5 text-xs">
              {inviteUrl}
            </code>
            <InviteLinkShareButton url={inviteUrl} label="Share" />
          </div>
        </div>
      ) : null}

      <FriendlySessionCard
        title={title}
        startsAt={startsAt}
        capacity={capacity}
        status={status}
        ratingBandLabel={ratingBandLabel}
        teamA={teamA}
        teamB={teamB}
        selectedSlots={selected}
        swapMode={swapMode && canSwap}
        onSlotClick={onSlotClick}
      />

      <FriendlyPickupResults
        sessionId={sessionId}
        matchKind={matchKind}
        status={status}
        capacity={capacity}
        leftPlayerIds={leftPlayerIds}
        rightPlayerIds={rightPlayerIds}
        rosterFull={rosterFull}
        isCreator={isCreator}
        creatorUserId={creatorUserId}
        currentUserId={currentUserId}
        skillRatingAppliedAt={skillRatingAppliedAt}
        competitiveApprovalUserIds={competitiveApprovalUserIds}
        rosterUserIds={rosterUserIds}
        initialGames={initialGames}
      />

      <div className="flex flex-wrap items-center gap-3">
        {canSwap ? (
          <>
            <Button
              type="button"
              variant={swapMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setSwapMode((v) => !v);
                setSelected([null, null]);
              }}
            >
              {swapMode ? "Cancel swap" : "Swap positions"}
            </Button>
            {swapMode ? (
              <Button
                type="button"
                size="sm"
                disabled={selected[0] == null || selected[1] == null || pending}
                onClick={() => doSwap()}
              >
                {pending ? "Swapping…" : "Confirm swap"}
              </Button>
            ) : null}
          </>
        ) : null}
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
