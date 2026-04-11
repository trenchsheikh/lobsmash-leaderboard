"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { cancelFriendlySession } from "@/app/actions/friendly-sessions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CancelOpenSessionButton({
  sessionId,
  size = "sm",
  variant = "outline",
  className,
}: {
  sessionId: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onConfirm() {
    start(async () => {
      const res = await cancelFriendlySession(sessionId);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Open session cancelled");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this open match?</DialogTitle>
            <DialogDescription>
              The lobby closes for everyone. Players can no longer join with your invite link. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? "Cancelling…" : "Cancel open match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
