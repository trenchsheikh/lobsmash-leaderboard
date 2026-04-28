"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelVerificationRequest } from "@/app/actions/verification";
import { Button } from "@/components/ui/button";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        setErr(null);
        start(async () => {
          const r = await cancelVerificationRequest(requestId);
          if ("error" in r) setErr(r.error ?? "Could not cancel.");
          else router.refresh();
        });
      }}
      className="rounded-full text-xs"
    >
      <span title={err ?? undefined}>{pending ? "…" : "Cancel"}</span>
    </Button>
  );
}
