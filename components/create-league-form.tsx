"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createLeague } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isLeagueFormat, type LeagueFormat } from "@/lib/league-format";

type CreateLeagueFormProps = {
  /** Wider inputs and primary CTA tuned for dashboard sheet */
  variant?: "default" | "sheet";
};

export function CreateLeagueForm({ variant = "default" }: CreateLeagueFormProps) {
  const router = useRouter();
  const [selectedFormat, setSelectedFormat] = useState<LeagueFormat>("summit");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createLeague(formData);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("leagueId" in res && res.leagueId) {
      toast.success("League created");
      router.push(`/leagues/${res.leagueId}`);
      router.refresh();
    }
  }

  const sheet = variant === "sheet";

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-4", sheet && "gap-5")}>
      <div className="space-y-2">
        <Label htmlFor="league-name">League name</Label>
        <Input
          id="league-name"
          name="name"
          required
          placeholder="Thursday Night Smash"
          className={cn(
            "transition-colors duration-200",
            sheet && "h-11 rounded-xl border-border/80",
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="league-format">Format</Label>
        <select
          id="league-format"
          name="format"
          required
          value={selectedFormat}
          onChange={(e) => {
            const v = e.target.value;
            if (isLeagueFormat(v)) setSelectedFormat(v);
          }}
          className={cn(
            "flex w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            sheet ? "h-11 rounded-xl border-border/80" : "h-10 rounded-md",
          )}
        >
          <option value="summit">Summit</option>
          <option value="americano">Americano</option>
          <option value="round_robin">Round Robin</option>
          <option value="mexicano">Mexicano</option>
        </select>
      </div>
      <Button
        type="submit"
        className={cn(sheet && "h-12 w-full rounded-xl text-base font-semibold shadow-md")}
        size={sheet ? "lg" : "default"}
      >
        Create league
      </Button>
    </form>
  );
}
