"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/lib/button-variants";
import { CancelRequestButton } from "@/components/verification/cancel-request-button";
import {
  PlayerVerificationStatsPanel,
  buildDefaultAttributeScores,
} from "@/components/verification/player-verification-stats-panel";
import {
  VerificationSlotsBookGrid,
  type BookableSlot,
} from "@/components/verification/verification-slots-book-grid";
import { Button } from "@/components/ui/button";
import {
  readDemoFeedbackMap,
  removeDemoFeedbackSlot,
  VERIFICATION_DEMO_FEEDBACK_EVENT,
  VERIFICATION_DEMO_FEEDBACK_STORAGE_KEY,
  type VerificationDemoFeedbackEventDetail,
  type VerificationDemoFeedbackMap,
} from "@/lib/verification-demo-feedback";
import { isDemoVerificationId, isSimulatedDemoRequestId } from "@/lib/verification-mocks";
import { cn } from "@/lib/utils";

export type ServerVerificationRequest = {
  id: string;
  status: string;
  coach_user_id: string;
  created_at: string;
  /** Set when the player booked a published coach slot (or demo sim row). */
  slot_id?: string | null;
};

type SimulatedRequest = {
  id: string;
  slotId: string;
  status: "pending";
  coach_user_id: string;
  created_at: string;
};

type Props = {
  bookableSlots: BookableSlot[];
  currentUserId: string;
  serverPendingCoachIds: string[];
  showDemoStrip?: boolean;
  myRequests: ServerVerificationRequest[];
  coachNames: Record<string, { name: string | null; username: string | null }>;
  isApprovedCoach: boolean;
};

export function VerificationPlayerFlow({
  bookableSlots,
  currentUserId,
  serverPendingCoachIds,
  showDemoStrip,
  myRequests,
  coachNames,
  isApprovedCoach,
}: Props) {
  const [simulatedRequests, setSimulatedRequests] = useState<SimulatedRequest[]>([]);
  const [demoFeedbackMap, setDemoFeedbackMap] = useState<VerificationDemoFeedbackMap>({});

  useEffect(() => {
    const sync = () => setDemoFeedbackMap(readDemoFeedbackMap());
    sync();
    const onFeedback = (e: Event) => {
      const d = (e as CustomEvent<VerificationDemoFeedbackEventDetail>).detail;
      if (!d) return;
      if ("type" in d && d.type === "removed") {
        setDemoFeedbackMap((m) => {
          const next = { ...m };
          delete next[d.slotId];
          return next;
        });
        return;
      }
      if ("slotId" in d && "scores" in d && "notes" in d) {
        setDemoFeedbackMap((m) => ({ ...m, [d.slotId]: d }));
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === VERIFICATION_DEMO_FEEDBACK_STORAGE_KEY) sync();
    };
    window.addEventListener(VERIFICATION_DEMO_FEEDBACK_EVENT, onFeedback);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(VERIFICATION_DEMO_FEEDBACK_EVENT, onFeedback);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const mockBookedSlotIds = useMemo(
    () => new Set(simulatedRequests.map((r) => r.slotId)),
    [simulatedRequests],
  );

  const pendingCoachIds = useMemo(() => {
    const fromSim = simulatedRequests.map((r) => r.coach_user_id);
    return [...new Set([...serverPendingCoachIds, ...fromSim])];
  }, [serverPendingCoachIds, simulatedRequests]);

  const displayRequests = useMemo(() => {
    const simRows: ServerVerificationRequest[] = simulatedRequests.map((s) => ({
      id: s.id,
      status: s.status,
      coach_user_id: s.coach_user_id,
      created_at: s.created_at,
      slot_id: s.slotId,
    }));
    return [...simRows, ...myRequests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [simulatedRequests, myRequests]);

  function onMockBookSuccess(slot: BookableSlot) {
    setSimulatedRequests((prev) => {
      if (prev.some((r) => r.slotId === slot.id)) return prev;
      return [
        ...prev,
        {
          id: `demo-sim-req-${slot.id}-${Date.now()}`,
          slotId: slot.id,
          status: "pending",
          coach_user_id: slot.coach_user_id,
          created_at: new Date().toISOString(),
        },
      ];
    });
  }

  function removeSimulatedRequest(id: string) {
    setSimulatedRequests((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row?.slotId) removeDemoFeedbackSlot(row.slotId);
      return prev.filter((r) => r.id !== id);
    });
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Bookable sessions
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Only open slots—nothing another player has already booked. Pick a time and venue that
              work for you.
            </p>
          </div>
          {isApprovedCoach ? (
            <Link
              href="/verification/inbox"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 min-h-[44px]")}
            >
              Coach inbox
            </Link>
          ) : null}
        </div>
        <VerificationSlotsBookGrid
          slots={bookableSlots}
          currentUserId={currentUserId}
          pendingCoachIds={pendingCoachIds}
          showDemoStrip={showDemoStrip}
          mockBookedSlotIds={mockBookedSlotIds}
          onMockBookSuccess={onMockBookSuccess}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Your requests
        </h2>
        <ul className="flex flex-col gap-2">
          {displayRequests.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
              No requests yet. Choose an open session above.
            </li>
          ) : (
            displayRequests.map((r) => {
              const label = coachNames[r.coach_user_id as string];
              const title =
                label?.name?.trim() ||
                (label?.username ? `@${label.username}` : "Coach");
              const isSimulated = isSimulatedDemoRequestId(r.id as string);
              const isLegacyDemo = isDemoVerificationId(r.id as string);
              const showPreviewBadge = isSimulated || isLegacyDemo;
              const sessionBooked = r.status === "pending" && Boolean(r.slot_id);
              const portalHref = isSimulated
                ? `/verification/dev-session?coachId=${encodeURIComponent(r.coach_user_id)}&slotId=${encodeURIComponent(r.slot_id ?? "")}`
                : `/verification/session/${r.id}`;
              const slotKey = (r.slot_id as string | null | undefined) ?? null;
              const demoFb =
                isSimulated && slotKey ? (demoFeedbackMap[slotKey] ?? null) : null;
              return (
                <li
                  key={r.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/5",
                    showPreviewBadge && "border-dashed bg-muted/25",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{title}</p>
                      {showPreviewBadge ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Demo
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sessionBooked
                        ? "Session booked — open the portal for next steps."
                        : r.status === "pending"
                          ? "Waiting for coach"
                          : r.status === "submitted"
                            ? "Completed"
                            : "Cancelled"}{" "}
                      · {new Date(r.created_at as string).toLocaleString()}
                    </p>
                    {demoFb ? (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Coach feedback received (demo) — see below.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {sessionBooked ? (
                      <Link
                        href={portalHref}
                        className={cn(
                          buttonVariants({ variant: "default", size: "sm" }),
                          "h-9 min-h-9 rounded-full px-4 text-xs font-medium sm:text-sm",
                        )}
                      >
                        It&apos;s booked
                      </Link>
                    ) : (
                      <span
                        className={
                          r.status === "pending"
                            ? "rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100"
                            : r.status === "submitted"
                              ? "rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
                              : "rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        }
                      >
                        {r.status}
                      </span>
                    )}
                    {r.status === "pending" && isSimulated ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={() => removeSimulatedRequest(r.id as string)}
                      >
                        Dismiss
                      </Button>
                    ) : r.status === "pending" && !isSimulated && !isLegacyDemo ? (
                      <CancelRequestButton requestId={r.id as string} />
                    ) : null}
                  </div>
                  </div>
                  {demoFb ? (
                    <div className="border-t border-border/60 pt-3">
                      <PlayerVerificationStatsPanel
                        title="Coach feedback (demo)"
                        description="From the demo session portal — not saved to the database."
                        scores={buildDefaultAttributeScores(demoFb.scores)}
                        notes={demoFb.notes}
                        compact
                      />
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </>
  );
}
