"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateLeagueReferenceCode } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAGUE_CODE_LENGTH } from "@/lib/league-code";

export function UpdateLeagueCodeForm({
  leagueId,
  currentCode,
}: {
  leagueId: string;
  currentCode: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(
      (e.currentTarget.elements.namedItem("code") as HTMLInputElement)?.value ?? "",
    );
    start(async () => {
      const res = await updateLeagueReferenceCode(leagueId, code);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Reference code updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border/80 pt-4">
      <div className="space-y-2">
        <Label htmlFor="reference-code">Custom reference code</Label>
        <Input
          id="reference-code"
          name="code"
          key={currentCode}
          defaultValue={currentCode}
          maxLength={LEAGUE_CODE_LENGTH}
          minLength={LEAGUE_CODE_LENGTH}
          required
          className="font-mono text-sm uppercase"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-muted-foreground text-xs">
          Exactly {LEAGUE_CODE_LENGTH} characters: A–Z except I and O, and digits 2–9 (no 0 or 1). Changing this
          updates your invite link; old links stop working unless another league reuses the code.
        </p>
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save reference code"}
      </Button>
    </form>
  );
}
