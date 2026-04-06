"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * #1 leaderboard frame: gold laurel wreath (`/winner.png`) behind a circular PFP
 * placed in the wreath’s inner opening via proportional insets.
 */
export function WinnerAvatarFrame({
  children,
  className,
  variant = "single",
  frameSize = "compact",
}: {
  children: React.ReactNode;
  className?: string;
  /** `pair` = wider container for two avatars side by side. */
  variant?: "single" | "pair";
  /** `spotlight` = larger wreath for podium `lg` avatars; `compact` = leaderboard table rows. */
  frameSize?: "compact" | "spotlight";
}) {
  const sizeClasses =
    frameSize === "spotlight"
      ? variant === "pair"
        ? "h-[4.75rem] w-[9rem] sm:h-20 sm:w-[9.75rem]"
        : "h-28 w-28 sm:h-32 sm:w-32"
      : variant === "pair"
        ? "h-[3.25rem] w-[6.25rem] sm:h-14 sm:w-[6.75rem]"
        : "h-11 w-11 sm:h-12 sm:w-12";

  const imgSizes =
    frameSize === "spotlight"
      ? variant === "pair"
        ? "156px"
        : "128px"
      : variant === "pair"
        ? "108px"
        : "48px";

  /** Pull the PFP toward the wreath’s inner opening (symmetric art: equal horizontal inset). */
  const avatarSlotClass =
    variant === "pair"
      ? frameSize === "spotlight"
        ? "inset-x-[9%] inset-y-[14%]"
        : "inset-x-[7%] inset-y-[12%]"
      : frameSize === "spotlight"
        ? "inset-[17%]"
        : "inset-[19%]";

  return (
    <span
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center",
        sizeClasses,
        className,
      )}
    >
      <Image
        src="/winner.png"
        alt=""
        fill
        className="pointer-events-none z-0 object-contain object-center p-0.5 select-none"
        sizes={imgSizes}
        aria-hidden
        draggable={false}
      />
      <span
        className={cn(
          "absolute z-[1] flex items-center justify-center",
          avatarSlotClass,
        )}
      >
        <span className="aspect-square h-full max-h-full w-full min-h-0 min-w-0 overflow-hidden rounded-full bg-background/90 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)] ring-1 ring-amber-500/50 dark:bg-background/85 dark:ring-amber-400/40">
          <span className="flex h-full w-full items-center justify-center [&_[data-slot=avatar]]:size-full [&_[data-slot=avatar]]:max-h-full [&_[data-slot=avatar]]:max-w-full [&_[data-slot=avatar]]:rounded-full">
            {children}
          </span>
        </span>
      </span>
    </span>
  );
}
