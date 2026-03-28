"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createLeague } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateLeagueForm() {
  const router = useRouter();

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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="league-name">League name</Label>
        <Input
          id="league-name"
          name="name"
          required
          placeholder="Thursday Night Smash"
          className="transition-colors duration-200"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="league-format">Format</Label>
        <select
          id="league-format"
          name="format"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="king_of_court">King of Court</option>
          <option value="americano">Americano</option>
        </select>
      </div>
      <Button type="submit">Create league</Button>
    </form>
  );
}
