"use client";

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

function sealBlobPath(cx: number, cy: number, rOuter: number, rInner: number, bumps: number) {
  const n = bumps * 2;
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

function SealIcon({
  verified,
  size,
  className,
}: {
  verified: boolean;
  size: "sm" | "md";
  className?: string;
}) {
  const vb = 40;
  const cx = vb / 2;
  const cy = vb / 2;
  const outer = 14.2;
  const inner = 11.6;
  const bumps = 14;
  const d = sealBlobPath(cx, cy, outer, inner, bumps);
  const dim = size === "sm" ? 22 : 26;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${vb} ${vb}`}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d={d}
        fill={verified ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={verified ? 0 : 1.1}
        className={cn(
          verified ? "text-primary" : "text-muted-foreground/70",
        )}
      />
      <path
        d="M15.2 20.4l2.6 2.6 5.4-6.2"
        fill="none"
        stroke={verified ? "#ffffff" : "currentColor"}
        strokeWidth={verified ? 1.55 : 1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={verified ? undefined : "text-muted-foreground/55"}
      />
    </svg>
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
  const textSm = size === "sm" ? "text-[10px]" : "text-[11px]";

  const infoCardClass =
    "border border-[#0b3d8d] bg-[#0B4FAE] text-white shadow-xl ring-1 ring-black/20 sm:max-w-md";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded-lg py-0.5 text-left",
          "transition-opacity hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={verified ? "Coach verification details" : "Coach verification"}
      >
        <SealIcon verified={verified} size={size} />
        <span className="flex min-w-0 flex-col leading-tight">
          {verified ? (
            <>
              <span
                className={cn(
                  "font-medium text-foreground group-hover:underline",
                  size === "sm" ? "text-xs" : "text-sm",
                )}
              >
                verified
              </span>
              <span className={cn("text-muted-foreground", textSm)}>details</span>
            </>
          ) : (
            <span className={cn("text-muted-foreground", textSm)}>
              {viewerIsSubject ? "get verified" : "not verified"}
            </span>
          )}
        </span>
      </button>

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
