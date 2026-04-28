"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelCoachVerificationSlot,
  createCoachVerificationSlot,
} from "@/app/actions/verification";
import {
  formatVerificationDuration,
  formatVerificationSlotRange,
} from "@/lib/verification-slot-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, MapPin, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookableSlot } from "@/components/verification/verification-slots-book-grid";

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180] as const;

const nativeSelectClass =
  "h-11 min-h-[44px] w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

type CoachSlot = BookableSlot & { status: string };

type Props = {
  slots: CoachSlot[];
};

function SessionRow({
  s,
  pendingCancel,
  onCancel,
}: {
  s: CoachSlot;
  pendingCancel: boolean;
  onCancel: (id: string) => void;
}) {
  const { dateLine, timeLine } = formatVerificationSlotRange(s.starts_at, s.duration_minutes);
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 ring-1 ring-foreground/5"
    >
      <div className="min-w-0 space-y-1 text-sm">
        <div className="flex items-center gap-1.5 text-foreground">
          <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="font-medium">{s.venue}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span>
            {dateLine} · {timeLine}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Timer className="size-3.5 shrink-0" aria-hidden />
          <span>{formatVerificationDuration(s.duration_minutes)}</span>
        </div>
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
            s.status === "open"
              ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
              : s.status === "booked"
                ? "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                : "bg-muted text-muted-foreground",
          )}
        >
          {s.status}
        </span>
      </div>
      {s.status === "open" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendingCancel}
          onClick={() => onCancel(s.id)}
          className="shrink-0"
        >
          Cancel
        </Button>
      ) : null}
    </li>
  );
}

export function CoachVerificationSlotsPanel({ slots }: Props) {
  const router = useRouter();
  const openSlots = slots.filter((s) => s.status === "open");
  const bookedSlots = slots.filter((s) => s.status === "booked");
  const otherSlots = slots.filter((s) => s.status !== "open" && s.status !== "booked");

  const [venue, setVenue] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState("");
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [listMsg, setListMsg] = useState<string | null>(null);
  const [pendingCreate, startCreate] = useTransition();
  const [pendingCancel, startCancel] = useTransition();

  function createSlot() {
    setFormMsg(null);
    if (!startsLocal) {
      setFormMsg("Choose a start date and time.");
      return;
    }
    const iso = new Date(startsLocal).toISOString();
    startCreate(async () => {
      const r = await createCoachVerificationSlot({
        venue,
        startsAtIso: iso,
        durationMinutes: duration,
        notes: notes || undefined,
      });
      if ("error" in r) {
        setFormMsg(r.error ?? "Could not publish.");
        return;
      }
      setVenue("");
      setStartsLocal("");
      setNotes("");
      setFormMsg("Session published.");
      router.refresh();
    });
  }

  function cancel(id: string) {
    setListMsg(null);
    startCancel(async () => {
      const r = await cancelCoachVerificationSlot(id);
      if ("error" in r) setListMsg(r.error ?? "Could not cancel.");
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Publish a session</CardTitle>
        <CardDescription>
          Players book from the list above. Set where you&apos;ll watch them play and for how long.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="slot-venue">Venue</Label>
            <Textarea
              id="slot-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              rows={2}
              placeholder="Club or court name, area, city"
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-start">Start</Label>
            <Input
              id="slot-start"
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              className="h-11 min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-duration">Duration</Label>
            <div>
              <select
                id="slot-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={nativeSelectClass}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatVerificationDuration(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="slot-notes">Notes (optional)</Label>
            <Input
              id="slot-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Court number, what to bring, etc."
            />
          </div>
        </div>
        {formMsg ? (
          <p className="text-sm text-muted-foreground" role="status">
            {formMsg}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={pendingCreate}
          onClick={createSlot}
          className="h-11 min-h-[44px] w-full sm:w-auto sm:px-8"
        >
          {pendingCreate ? "Publishing…" : "Publish session"}
        </Button>

        <div className="border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-foreground">Your sessions</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Open slots still appear for players to book. Booked slots have a player attached until the
            session is done or cancelled.
          </p>
          {listMsg ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200" role="status">
              {listMsg}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-6">
            <section>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Not booked — bookable
              </h5>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {openSlots.length} open {openSlots.length === 1 ? "slot" : "slots"} on the public list.
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {openSlots.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
                    No open slots. Publish a session above, or every listing is already booked.
                  </li>
                ) : (
                  openSlots.map((s) => (
                    <SessionRow key={s.id} s={s} pendingCancel={pendingCancel} onCancel={cancel} />
                  ))
                )}
              </ul>
            </section>

            <section>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Booked
              </h5>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A player has reserved these; you&apos;ll see them in your inbox when it&apos;s time to
                assess.
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {bookedSlots.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
                    No booked sessions yet.
                  </li>
                ) : (
                  bookedSlots.map((s) => (
                    <SessionRow key={s.id} s={s} pendingCancel={pendingCancel} onCancel={cancel} />
                  ))
                )}
              </ul>
            </section>

            {otherSlots.length > 0 ? (
              <section>
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Other
                </h5>
                <ul className="mt-2 flex flex-col gap-2">
                  {otherSlots.map((s) => (
                    <SessionRow key={s.id} s={s} pendingCancel={pendingCancel} onCancel={cancel} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
