"use client";

import { useId, useState } from "react";
import { ChevronDown, PlusCircle } from "lucide-react";
import { CreateLeagueForm } from "@/components/create-league-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const glassCard =
  "border border-white/30 bg-card/80 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-card/75";

export function DashboardCreateLeagueSection() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card className={cn(glassCard, "overflow-hidden")}>
      <CardHeader className="p-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-t-xl px-6 py-5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <PlusCircle className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Create a league
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </CardHeader>
      {open ? (
        <CardContent id={panelId} className="border-t border-border/40 px-6 pt-5 pb-6">
          <CardDescription className="mb-4 text-pretty text-foreground/85">
            Name, format, and a reference code. Share the invite link from the league page once it
            is created.
          </CardDescription>
          <CreateLeagueForm />
        </CardContent>
      ) : null}
    </Card>
  );
}
