"use client";

import { cn } from "@/lib/utils";

/** Gold laurel-style frame for #1 standings (light/dark safe). */
export function WinnerAvatarFrame({
  children,
  className,
  variant = "single",
}: {
  children: React.ReactNode;
  className?: string;
  /** `pair` = slightly wider ring for two avatars side by side. */
  variant?: "single" | "pair";
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        variant === "pair" ? "p-1" : "p-0.5",
        className,
      )}
    >
      <span
        className="absolute inset-0 rounded-full border-2 border-amber-500/85 shadow-[0_0_0_1px_rgba(251,191,36,0.35)] dark:border-amber-400/75 dark:shadow-[0_0_0_1px_rgba(251,191,36,0.2)]"
        aria-hidden
      />
      <LaurelGlyph className="pointer-events-none absolute -left-1.5 top-1/2 z-[1] h-8 w-4 -translate-y-1/2 text-amber-600/90 dark:text-amber-400/90" />
      <LaurelGlyph className="pointer-events-none absolute -right-1.5 top-1/2 z-[1] h-8 w-4 -translate-y-1/2 scale-x-[-1] text-amber-600/90 dark:text-amber-400/90" />
      <span className="relative z-[2]">{children}</span>
    </span>
  );
}

function LaurelGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M8 2c-1.2 2.1-3 4.8-3 8.2 0 2.8 1.2 5 2.5 6.5C5.8 17 4 15.2 4 12.5 4 9.8 6 7 8 5.5c2 1.5 4 4.3 4 7 0 2.7-1.8 4.5-3.5 5.2C9.8 21 11 18.8 11 16c0-3.4-1.8-6.1-3-8.2z"
        fill="currentColor"
        opacity={0.85}
      />
      <path
        d="M8 30c1.2-2.1 3-4.8 3-8.2 0-2.8-1.2-5-2.5-6.5 1.7 1.5 3.5 3.3 3.5 6 0 2.7-2 5.5-4 7-2-1.5-4-4.3-4-7 0-2.7 1.8-4.5 3.5-5.2C6.2 23 5 25.2 5 28c0 3.4 1.8 6.1 3 8.2z"
        fill="currentColor"
        opacity={0.85}
      />
    </svg>
  );
}
