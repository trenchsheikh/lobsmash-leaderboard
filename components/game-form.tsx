"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createGame } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function GameForm({
  leagueId,
  sessionId,
}: {
  leagueId: string;
  sessionId: string;
}) {
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await createGame(leagueId, sessionId, formData);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Game saved");
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="court">Court number</Label>
        <Input id="court" name="court_number" type="number" min={1} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-a">Team A player IDs (UUIDs, comma or space separated)</Label>
        <Textarea id="team-a" name="team_a_players" required rows={2} className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-b">Team B player IDs</Label>
        <Textarea id="team-b" name="team_b_players" required rows={2} className="font-mono text-xs" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="score-a">Team A score</Label>
          <Input id="score-a" name="team_a_score" type="number" min={0} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="score-b">Team B score</Label>
          <Input id="score-b" name="team_b_score" type="number" min={0} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="winner">Winner</Label>
        <select
          id="winner"
          name="winner"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="team_a">Team A</option>
          <option value="team_b">Team B</option>
        </select>
      </div>
      <Button type="submit">Add game</Button>
    </form>
  );
}
