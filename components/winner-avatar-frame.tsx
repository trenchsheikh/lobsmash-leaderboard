"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * #1 leaderboard frame: gold laurel wreath asset (`/winner.png`) behind the avatar(s).
 * Use a PNG with transparency for the area outside the wreath; replace the file if a checkerboard appears.
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
        className="pointer-events-none object-contain p-0.5 select-none"
        sizes={imgSizes}
        aria-hidden
        draggable={false}
      />
      <span className="relative z-[1] flex items-center justify-center">{children}</span>
    </span>
  );
}
