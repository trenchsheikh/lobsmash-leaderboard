"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function VerificationBadgeImage({
  verified,
  size,
  className,
}: {
  verified: boolean;
  size: "sm" | "md";
  className?: string;
}) {
  const dim = size === "sm" ? 16 : 20;
  const src = verified ? "/verified.png" : "/unverified.png";
  const alt = verified ? "Verified" : "Unverified";
  return (
    <Image
      src={src}
      alt={alt}
      width={dim}
      height={dim}
      className={cn("shrink-0 select-none", className)}
      priority={false}
    />
  );
}

export type ProfileVerificationSealProps = {
  /** When true, viewer is the profile owner (show get verified + link). */
  viewerIsSubject: boolean;
  verified: boolean;
  verifiedAtIso?: string | null;
  coachDisplayName?: string | null;
  venue?: string | null;
  size?: "sm" | "md";
  className?: string;
};

function formatVerifiedDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ProfileVerificationSeal({
  viewerIsSubject,
  verified,
  verifiedAtIso,
  coachDisplayName,
  venue,
  size = "md",
  className,
}: ProfileVerificationSealProps) {
  const [open, setOpen] = useState(false);
  const coach = coachDisplayName?.trim() || "Coach";
  const venueLine = venue?.trim() || null;

  const infoCardClass =
    "border border-[#0b3d8d] bg-[#0B4FAE] text-white shadow-xl ring-1 ring-black/20 sm:max-w-md";

  return (
    <>
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        <VerificationBadgeImage verified={verified} size={size} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold shadow-sm transition-all",
            "hover:brightness-105 active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            verified
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground/80 ring-1 ring-border/70 hover:bg-muted/80",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={
            verified
              ? "Coach verification details"
              : viewerIsSubject
                ? "Get verified by a coach"
                : "Coach verification"
          }
        >
          {verified ? "Verified" : viewerIsSubject ? "Get verified" : "Unverified"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className={cn(
            infoCardClass,
            "gap-0 overflow-hidden p-0 text-white",
            "[&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/15",
          )}
        >
          {verified ? (
            <>
              <DialogHeader className="gap-1 border-b border-white/15 px-5 py-4 pr-12">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A9D236]">
                  Coach verification
                </p>
                <DialogTitle className="font-heading text-lg font-semibold text-white">
                  Verified profile
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-white/90">
                  This player&apos;s attributes were confirmed by an approved coach after live play.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 px-5 py-4 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A9D236]/90">
                    Verified on
                  </p>
                  <p className="mt-0.5 text-white">{formatVerifiedDate(verifiedAtIso)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A9D236]/90">
                    By coach
                  </p>
                  <p className="mt-0.5 text-white">{coach}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A9D236]/90">
                    Venue / session
                  </p>
                  <p className="mt-0.5 text-white/95">{venueLine ?? "—"}</p>
                </div>
              </div>
            </>
          ) : viewerIsSubject ? (
            <>
              <DialogHeader className="gap-1 border-b border-white/15 px-5 py-4 pr-12">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A9D236]">
                  Coach verification
                </p>
                <DialogTitle className="font-heading text-lg font-semibold text-white">
                  get verified
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-white/90">
                  Book an approved coach from the Verification section. They rate your attributes
                  after watching you play, then your profile shows this badge.
                </DialogDescription>
              </DialogHeader>
              <div className="px-5 py-4">
                <Link
                  href="/verification"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-[#A9D236] px-5 text-sm font-semibold text-[#0B4FAE] transition-colors hover:bg-[#bce24d]"
                >
                  Open Verification
                </Link>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="gap-1 border-b border-white/15 px-5 py-4 pr-12">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A9D236]">
                  Coach verification
                </p>
                <DialogTitle className="font-heading text-lg font-semibold text-white">
                  not verified yet
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-white/90">
                  This player has not completed coach-backed verification. Stats you see here are
                  still self-reported and from league play.
                </DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
