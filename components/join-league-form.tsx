"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { joinLeagueByCode } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinLeagueForm() {
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await joinLeagueByCode(formData);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("leagueId" in res && res.leagueId) {
      toast.success("Join request sent");
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="join-code">League code</Label>
        <Input
          id="join-code"
          name="code"
          required
          placeholder="ABCD1234"
          className="font-mono uppercase transition-colors duration-200"
        />
      </div>
      <Button type="submit">Request to join</Button>
    </form>
  );
}
