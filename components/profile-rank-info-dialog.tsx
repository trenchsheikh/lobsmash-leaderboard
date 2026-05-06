"use client";

import Image from "next/image";
import { Info } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RANK_TIERS } from "@/lib/player-rank";
import { cn } from "@/lib/utils";

type Props = {
  /** Currently active tier id, used to highlight the row in the legend. */
  currentTierId: string;
  className?: string;
};

/**
 * Small "i" circle button next to the tier label that opens a dialog
 * explaining the ranking system and showing all five badges with their
 * skill thresholds. Highlights the player's current tier.
 */
export function ProfileRankInfoDialog({ currentTierId, className }: Props) {
  const [open, setOpen] = useState(false);

  // Render badges from highest to lowest so Icon sits on top of the list.
  const ordered = [...RANK_TIERS].filter((t) => t.imageSrc !== null).reverse();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="How ranking works"
            title="How ranking works"
            className={cn(
              "size-7 rounded-full text-white/70 hover:bg-white/15 hover:text-white",
              className,
            )}
          >
            <Info className="size-4" aria-hidden />
          </Button>
        }
      />
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Ranks</DialogTitle>
          <DialogDescription className="sr-only">
            Skill rating thresholds for each rank.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-1 grid gap-2">
          {ordered.map((tier) => {
            const isCurrent = tier.id === currentTierId;
            const range =
              tier.id === "icon"
                ? `${tier.minSkill}+`
                : (() => {
                    const idx = RANK_TIERS.findIndex((t) => t.id === tier.id);
                    const next = RANK_TIERS[idx + 1];
                    return next
                      ? `${tier.minSkill}–${next.minSkill - 1}`
                      : `${tier.minSkill}+`;
                  })();
            return (
              <li
                key={tier.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
                  isCurrent
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                    : "border-border/60 bg-muted/30",
                )}
                aria-current={isCurrent ? "true" : undefined}
              >
                {tier.imageSrc ? (
                  <div
                    className={cn(
                      "relative flex size-14 shrink-0 items-center justify-center rounded-xl p-1.5",
                      "bg-gradient-to-br from-muted/60 to-muted/20",
                      "ring-1 ring-border/60",
                      "shadow-sm",
                      isCurrent &&
                        "ring-primary/50 shadow-[0_4px_18px_-6px_color-mix(in_srgb,var(--brand-lime)_60%,transparent)]",
                    )}
                  >
                    <Image
                      src={tier.imageSrc}
                      alt={tier.label}
                      width={256}
                      height={256}
                      sizes="56px"
                      priority
                      className="relative size-full select-none object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "bg-clip-text font-heading text-sm font-extrabold tracking-tight text-transparent",
                        tier.shinyClass,
                      )}
                    >
                      {tier.label}
                    </p>
                    {isCurrent ? (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-primary">
                        You
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
                    {range}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
