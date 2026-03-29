"use client";

import { useState, useTransition } from "react";
import { beginNewSessionDraft } from "@/app/actions/session-wizard";
import { Button } from "@/components/ui/button";

export function BeginSessionWizardButton({ leagueId }: { leagueId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="button"
        disabled={pending}
        className="w-fit"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await beginNewSessionDraft(leagueId);
            if (res?.error) setError(res.error);
          });
        }}
      >
        {pending ? "Starting…" : "Start session wizard"}
      </Button>
    </div>
  );
}
