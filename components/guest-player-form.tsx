"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createGuestPlayer } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAYSTYLE_OPTIONS, PREFERRED_SIDE_OPTIONS, EXPERIENCE_OPTIONS, STRENGTH_OPTIONS, WEAKNESS_OPTIONS } from "@/lib/onboarding-options";
import { cn } from "@/lib/utils";

export function GuestPlayerForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createGuestPlayer(leagueId, formData);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Guest player added");
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="guest-name">Name</Label>
        <Input id="guest-name" name="name" required placeholder="Guest player" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-playstyle">Playstyle</Label>
        <select
          id="guest-playstyle"
          name="playstyle"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <option value="">—</option>
          {PLAYSTYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Strengths</Label>
        <div className="grid grid-cols-2 gap-2">
          {STRENGTH_OPTIONS.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="strengths"
                value={s.value}
                className="size-4 rounded border-input"
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Weaknesses</Label>
        <div className="grid grid-cols-2 gap-2">
          {WEAKNESS_OPTIONS.map((w) => (
            <label key={w.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="weaknesses"
                value={w.value}
                className="size-4 rounded border-input"
              />
              {w.label}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-side">Preferred side</Label>
        <select
          id="guest-side"
          name="preferred_side"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <option value="">—</option>
          {PREFERRED_SIDE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-exp">Experience</Label>
        <select
          id="guest-exp"
          name="experience_level"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <option value="">—</option>
          {EXPERIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">Add guest</Button>
    </form>
  );
}
