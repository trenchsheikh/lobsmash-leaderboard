"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PROFILE_ATTRIBUTE_OPTIONS } from "@/lib/onboarding-options";
import { cn } from "@/lib/utils";
import { ExternalLink, Info } from "lucide-react";

const LTA_PADEL_QUALIFICATIONS_URL =
  "https://www.lta.org.uk/roles-and-venues/coaches/qualifications/lta-padel-coaching/";

const attributeList = PROFILE_ATTRIBUTE_OPTIONS.map((o) => o.label).join(", ");

export function HowWeVerifyDialog({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-9 min-h-9 shrink-0 gap-1.5 whitespace-nowrap sm:h-8 sm:min-h-8", className)}
          >
            <Info className="size-4" aria-hidden />
            How we verify
          </Button>
        }
      />
      <DialogContent className="max-h-[min(88dvh,calc(100dvh-2rem))] max-w-[min(calc(100vw-2rem),28rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="max-h-[min(88dvh,calc(100dvh-2rem))] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <DialogHeader className="text-left">
            <DialogTitle className="font-heading text-lg sm:text-xl">How coach verification works</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              Straightforward: you play once with an approved coach on LobSmash, they rate what they
              saw, and your profile can show you&apos;re coach-backed—not a mystery test in an app.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Your flow
              </h3>
              <ol className="list-decimal space-y-2 pl-4 marker:text-primary">
                <li>
                  <span className="text-foreground">Book</span> an open slot (venue + time on the card).
                </li>
                <li>
                  <span className="text-foreground">Play</span> that session for real—verification is based on
                  live padel, not a form you fill in alone.
                </li>
                <li>
                  Afterward, your coach submits ratings from their{" "}
                  <span className="text-foreground">Verification inbox</span> on LobSmash.
                </li>
                <li>
                  When that&apos;s done, your profile can show{" "}
                  <span className="text-foreground">coach-verified</span> with the attributes they logged.
                </li>
              </ol>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                What coaches rate
              </h3>
              <p>
                They score six play attributes from{" "}
                <span className="font-medium text-foreground">1–8</span> after watching you:{" "}
                <span className="text-foreground/90">{attributeList}</span>. Those numbers feed your
                coach-backed stats on LobSmash.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-muted/35 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                UK padel coaching context
              </h3>
              <p className="mb-2">
                In the UK, padel coaching is usually tied to the{" "}
                <span className="font-medium text-foreground">LTA</span> pathway. The common regulated
                starting point for <span className="font-medium text-foreground">group padel coaching</span>{" "}
                is the{" "}
                <span className="font-medium text-foreground">LTA Padel Instructor (Level 2)</span>{" "}
                qualification—think structured course work, safeguarding expectations, and (toward
                assessment) things like first aid as part of that world—not a random weekend ticket.
              </p>
              <p className="mb-2">
                <span className="font-medium text-foreground">LobSmash is separate:</span> we still approve
                coaches on our platform before they can list verification slots here, so you get both a
                real session <em>and</em> a product-side check—not only a line on someone&apos;s CV.
              </p>
              <a
                href={LTA_PADEL_QUALIFICATIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                LTA padel coaching qualifications
                <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
              </a>
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
            <DialogClose
              render={
                <Button type="button" variant="default" className="w-full">
                  Got it
                </Button>
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
