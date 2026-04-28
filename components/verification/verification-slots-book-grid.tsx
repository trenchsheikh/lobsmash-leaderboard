"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { bookVerificationSlot } from "@/app/actions/verification";
import {
  formatVerificationDuration,
  formatVerificationSlotRange,
} from "@/lib/verification-slot-display";
import { DemoCoachVerificationProfileDialog } from "@/components/verification/demo-coach-verification-profile-dialog";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Timer } from "lucide-react";
import { isDemoVerificationId } from "@/lib/verification-mocks";
import { cn } from "@/lib/utils";

export type BookableSlot = {
  id: string;
  coach_user_id: string;
  venue: string;
  starts_at: string;
  duration_minutes: number;
  notes: string | null;
  coach: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  /** Optional CTA label (e.g. demo highlight for a featured slot). */
  bookButtonLabel?: string;
};

type Props = {
  slots: BookableSlot[];
  currentUserId: string;
  pendingCoachIds: string[];
  /** When true, show a short notice that sample London sessions are included. */
  showDemoStrip?: boolean;
  /** Demo slots already “booked” in this session (parent state). */
  mockBookedSlotIds: Set<string>;
  /** After a successful mock book — adds a row under Your requests. */
  onMockBookSuccess?: (slot: BookableSlot) => void;
};

export function VerificationSlotsBookGrid({
  slots,
  currentUserId,
  pendingCoachIds,
  showDemoStrip,
  mockBookedSlotIds,
  onMockBookSuccess,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sorted = useMemo(
    () => [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [slots],
  );

  function book(slot: BookableSlot) {
    setMsg(null);
    setBookingId(slot.id);
    start(async () => {
      const r = await bookVerificationSlot(slot.id);
      setBookingId(null);
      if ("error" in r) {
        setMsg(r.error ?? "Could not book.");
        return;
      }
      if ("mock" in r && r.mock) {
        onMockBookSuccess?.(slot);
        setMsg(
          "Demo booking done — in production this would notify your coach. Nothing was saved to the server.",
        );
      } else {
        setMsg(
          "You’re booked. Tap the It’s booked button on your request, then use the session portal for coach ratings and verification.",
        );
      }
      router.refresh();
    });
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-14 text-center">
        <p className="font-heading text-base font-semibold text-foreground">No open sessions right now</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Approved coaches publish times and venues here. Check back soon, or ask your coach to add
          a session.
        </p>
      </div>
    );
  }

  const hasDemoSlots = sorted.some((s) => isDemoVerificationId(s.id));

  return (
    <div className="flex flex-col gap-4">
      {showDemoStrip && hasDemoSlots ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Two sample London padel sessions — you can <span className="font-medium text-foreground">book them in demo</span>{" "}
          (nothing hits the database). After you book, a row appears under{" "}
          <span className="font-medium text-foreground">Your requests</span>. Tap a coach for a quick
          card. Use <span className="font-medium text-foreground">How we verify</span> in the header for
          the full process.
        </p>
      ) : null}
      {msg ? (
        <p
          className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {msg}
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {sorted.map((slot) => {
          const c = slot.coach;
          const name = c?.name?.trim() || "Coach";
          const username = c?.username?.trim() ?? null;
          const isSelf = slot.coach_user_id === currentUserId;
          const hasPendingWithCoach = pendingCoachIds.includes(slot.coach_user_id);
          const { dateLine, timeLine } = formatVerificationSlotRange(
            slot.starts_at,
            slot.duration_minutes,
          );
          const dur = formatVerificationDuration(slot.duration_minutes);
          const busy = pending && bookingId === slot.id;
          const isDemo = isDemoVerificationId(slot.id);
          const demoBookedHere = isDemo && mockBookedSlotIds.has(slot.id);

          return (
            <li
              key={slot.id}
              className={cn(
                "flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
                "motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200",
                "hover:border-primary/30 hover:shadow-md motion-reduce:hover:transform-none",
                isDemo && "border-dashed bg-muted/20",
              )}
            >
              <div className="flex items-start gap-3 border-b border-border pb-3">
                {isDemo ? (
                  <DemoCoachVerificationProfileDialog
                    coachUserId={slot.coach_user_id}
                    displayName={name}
                    username={username}
                    avatarUrl={c?.avatar_url ?? null}
                  />
                ) : (
                  <>
                    <UserAvatarDisplay
                      name={name}
                      username={username}
                      avatarUrl={c?.avatar_url ?? null}
                      className="size-12 shrink-0 ring-2 ring-primary/20"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading font-semibold text-foreground">{name}</p>
                      {username ? (
                        <p className="truncate font-mono text-xs text-muted-foreground">@{username}</p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2.5 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="leading-snug text-foreground">{slot.venue}</span>
                </div>
                <div className="flex gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 leading-snug">
                    <span className="block text-foreground">{dateLine}</span>
                    <span className="text-[13px] text-muted-foreground">{timeLine}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Timer className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-foreground">{dur} session</span>
                </div>
                {slot.notes ? (
                  <p className="border-t border-border pt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {slot.notes}
                  </p>
                ) : null}
              </div>
              <div className="mt-4">
                {isDemo && demoBookedHere ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Booked (demo) — see Your requests below. Refresh the page to reset the demo.
                  </p>
                ) : isSelf ? (
                  <p className="text-center text-xs text-muted-foreground">This is your listing</p>
                ) : hasPendingWithCoach && !demoBookedHere ? (
                  <p className="text-center text-xs text-amber-800 dark:text-amber-200">
                    You already have a pending request with this coach
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant={slot.bookButtonLabel ? "default" : isDemo ? "outline" : "default"}
                    disabled={pending}
                    onClick={() => book(slot)}
                    className={cn(
                      "h-11 min-h-[44px] w-full",
                      slot.bookButtonLabel && "text-base font-semibold shadow-sm",
                    )}
                  >
                    {busy
                      ? "Booking…"
                      : (slot.bookButtonLabel ??
                          (isDemo ? "Book this session (demo)" : "Book this session"))}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
