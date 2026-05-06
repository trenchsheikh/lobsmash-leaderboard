"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Props = {
  overview: React.ReactNode;
  mastery: React.ReactNode;
  recap: React.ReactNode;
  defaultTab?: "overview" | "mastery" | "recap";
};

/**
 * Sticky tab bar (Overview / Mastery / Recap) below the rank hero. Identical
 * interaction on mobile and desktop per the answered design choice.
 */
export function ProfileTabs({ overview, mastery, recap, defaultTab = "overview" }: Props) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <div
        className={cn(
          "sticky top-2 z-10 -mx-1 mb-2 flex justify-center px-1",
          "sm:static sm:mb-0 sm:px-0",
        )}
      >
        <TabsList
          className={cn(
            "w-full max-w-md justify-stretch gap-1 rounded-full border-white/40 bg-card/90 p-1 shadow-md backdrop-blur-xl",
            "dark:border-white/15 sm:rounded-full",
          )}
        >
          <TabsTrigger
            value="overview"
            className="flex-1 rounded-full text-xs uppercase tracking-[0.12em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:text-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="mastery"
            className="flex-1 rounded-full text-xs uppercase tracking-[0.12em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:text-sm"
          >
            Mastery
          </TabsTrigger>
          <TabsTrigger
            value="recap"
            className="flex-1 rounded-full text-xs uppercase tracking-[0.12em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:text-sm"
          >
            Recap
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-3 flex flex-col gap-3 sm:gap-4">
        {overview}
      </TabsContent>
      <TabsContent value="mastery" className="mt-3 flex flex-col gap-3 sm:gap-4">
        {mastery}
      </TabsContent>
      <TabsContent value="recap" className="mt-3 flex flex-col gap-3 sm:gap-4">
        {recap}
      </TabsContent>
    </Tabs>
  );
}
