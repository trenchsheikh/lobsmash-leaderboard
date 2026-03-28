"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle enter animation on client navigations (stable React has no ViewTransition export).
 * Pairs with `experimental.viewTransition` + CSS in globals for browsers that support it.
 */
export function MainRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className={cn(
        "main-route-shell",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 motion-safe:slide-in-from-bottom-1",
        "motion-reduce:animate-none motion-reduce:duration-0",
      )}
    >
      {children}
    </div>
  );
}
