"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeSession } from "@/app/actions/sessions";
import { Button } from "@/components/ui/button";

export function CompleteSessionButton({
  leagueId,
  sessionId,
}: {
  leagueId: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await completeSession(leagueId, sessionId);
          if ("error" in res && res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Session completed");
          router.refresh();
        });
      }}
    >
      {pending ? "Completing…" : "Complete session"}
    </Button>
  );
}
