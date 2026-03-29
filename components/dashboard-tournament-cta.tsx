"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardTournamentCta() {
  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <Button
        type="button"
        disabled
        aria-disabled
        title="Coming soon"
        className={cn(
          "h-9 border border-neutral-900/15 bg-[#DFFF00] font-semibold text-neutral-900 shadow-sm",
          "hover:bg-[#DFFF00] disabled:opacity-60",
        )}
      >
        Create a tournament
      </Button>
      <span className="text-center text-xs text-muted-foreground sm:text-right">Coming soon</span>
    </div>
  );
}
