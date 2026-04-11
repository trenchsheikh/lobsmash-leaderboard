"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { createFriendlySession, type PickupMatchKind } from "@/app/actions/friendly-sessions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PendingFriendlyJoinRequestsList,
  type PendingFriendlyRequestRow,
} from "@/components/pending-friendly-join-requests-list";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const glassCard =
  "border border-border bg-card shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-card/90";

export type FriendlySessionSummary = {
  id: string;
  invite_token: string;
  capacity: number;
  title: string | null;
  starts_at: string | null;
  status: string;
  match_kind: string;
};

type Props = {
  pendingRequests: PendingFriendlyRequestRow[];
};

export function DashboardFriendlySessionSection({
  pendingRequests,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [matchKind, setMatchKind] = useState<PickupMatchKind>("friendly");

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (startsAt.trim() !== "") {
      const d = new Date(startsAt);
      if (!Number.isFinite(d.getTime())) {
        toast.error("Invalid start time.");
        return;
      }
    }
    startTransition(async () => {
      const res = await createFriendlySession({
        capacity: 4,
        title: title.trim() || undefined,
        startsAt: startsAt.trim() || null,
        matchKind,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("inviteToken" in res && res.inviteToken) {
        toast.success("Open session created");
        setSheetOpen(false);
        setTitle("");
        setStartsAt("");
        setMatchKind("friendly");
        await Promise.resolve(router.refresh());
      }
    });
  }

  return (
    <>
      <Card className={cn(glassCard, "overflow-hidden")}>
        <CardHeader className="p-0">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-t-xl px-6 py-5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <UsersRound className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Open session
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </CardHeader>
        {pendingRequests.length > 0 ? (
          <CardContent className="border-t border-border/40 px-6 py-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Pending join requests</p>
              <PendingFriendlyJoinRequestsList requests={pendingRequests} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          showCloseButton
          className="flex w-full max-w-full flex-col gap-0 overflow-hidden border-border/60 p-0 shadow-2xl sm:max-w-lg"
        >
          <div className="relative shrink-0 border-b border-border/50 bg-gradient-to-br from-primary/[0.12] via-primary/[0.04] to-transparent px-6 pt-7 pb-5">
            <div
              className="pointer-events-none absolute -right-20 -top-20 size-40 rounded-full bg-primary/[0.07] blur-2xl"
              aria-hidden
            />
            <SheetHeader className="relative gap-2 space-y-0 p-0">
              <SheetTitle className="font-heading text-xl font-semibold tracking-tight text-foreground">
                New open session
              </SheetTitle>
            </SheetHeader>
          </div>

          <form
            onSubmit={onCreate}
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-6 pb-8 pt-6"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                How should it count?
              </p>
              <RadioGroup
                value={matchKind}
                onValueChange={(v) => setMatchKind(v as PickupMatchKind)}
                className="grid gap-3"
              >
                <Label
                  htmlFor="dash-open-f"
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all",
                    matchKind === "friendly"
                      ? "border-primary/45 bg-primary/[0.07] shadow-sm ring-1 ring-primary/20"
                      : "border-border/70 bg-muted/20 hover:border-primary/25 hover:bg-muted/35",
                  )}
                >
                  <RadioGroupItem value="friendly" id="dash-open-f" className="shrink-0" />
                  <span className="font-medium text-foreground">Friendly</span>
                </Label>
                <Label
                  htmlFor="dash-open-c"
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all",
                    matchKind === "competitive"
                      ? "border-primary/45 bg-primary/[0.07] shadow-sm ring-1 ring-primary/20"
                      : "border-border/70 bg-muted/20 hover:border-primary/25 hover:bg-muted/35",
                  )}
                >
                  <RadioGroupItem value="competitive" id="dash-open-c" className="shrink-0" />
                  <span className="font-medium text-foreground">Competitive</span>
                </Label>
              </RadioGroup>
            </div>

            <div className="mt-7 space-y-5 rounded-2xl border border-border/50 bg-muted/25 p-5 dark:bg-muted/15">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <UsersRound className="size-3.5 opacity-80" aria-hidden />
                Session details
              </p>

              <p className="text-sm text-muted-foreground">
                Fixed at <span className="font-medium text-foreground">4 players</span> (2 vs 2). You can create
                with just yourself—invite up to three others until the roster is full.
              </p>

              <div className="space-y-2">
                <Label htmlFor="open-title" className="text-foreground">
                  Title <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="open-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Saturday hit at the club"
                  autoComplete="off"
                  className="h-11 rounded-xl border-border/80 bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="open-start" className="flex items-center gap-2 text-foreground">
                  <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
                  Start time <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="open-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  step={60}
                  className="h-11 rounded-xl border-border/80 bg-background"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-border/40 pt-6">
              <Button
                type="submit"
                disabled={pending}
                size="lg"
                className="h-12 w-full rounded-xl text-base font-semibold shadow-md transition hover:opacity-[0.98]"
              >
                {pending ? "Creating…" : "Create open session"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
