"use client";

import { useState } from "react";
import { ChevronRight, PlusCircle } from "lucide-react";
import { CreateLeagueForm } from "@/components/create-league-form";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const glassCard =
  "border border-border bg-card shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-card/90";

export function DashboardCreateLeagueSection() {
  const [sheetOpen, setSheetOpen] = useState(false);

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
              <PlusCircle className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Create a league
              </span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </CardHeader>
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
                New league
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8 pt-6">
            <CreateLeagueForm variant="sheet" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
