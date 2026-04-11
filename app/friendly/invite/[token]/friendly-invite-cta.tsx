"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { requestJoinFriendlySession } from "@/app/actions/friendly-sessions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  inviteToken: string;
  sessionId: string;
  loginHref: string;
  signUpHref: string;
  onboardingHref: string;
  onboarded: boolean;
  signedIn: boolean;
  isCreator: boolean;
  isOnRoster: boolean;
  hasPendingRequest: boolean;
  isFull: boolean;
  isOpen: boolean;
};

export function FriendlyInviteCta({
  inviteToken,
  sessionId,
  loginHref,
  signUpHref,
  onboardingHref,
  onboarded,
  signedIn,
  isCreator,
  isOnRoster,
  hasPendingRequest,
  isFull,
  isOpen,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!isOpen) {
    return (
      <Button disabled className="w-full min-h-11 cursor-not-allowed rounded-xl font-semibold sm:min-h-10 sm:w-auto">
        Session closed
      </Button>
    );
  }

  if (isCreator || isOnRoster) {
    return (
      <Link
        href={`/friendly/${sessionId}`}
        className={cn(
          buttonVariants({ size: "default" }),
          "flex w-full min-h-11 items-center justify-center rounded-xl font-semibold sm:min-h-10 sm:w-auto",
        )}
      >
        Open session
      </Link>
    );
  }

  if (isFull) {
    return (
      <Button disabled className="w-full min-h-11 cursor-not-allowed rounded-xl font-semibold sm:min-h-10 sm:w-auto">
        Session full
      </Button>
    );
  }

  if (hasPendingRequest) {
    return (
      <Button
        disabled
        className="w-full min-h-11 cursor-not-allowed rounded-xl font-semibold sm:min-h-10 sm:w-auto"
      >
        Request pending
      </Button>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
        <Link
          href={loginHref}
          className={cn(
            buttonVariants({ size: "lg" }),
            "flex w-full min-h-11 items-center justify-center rounded-xl font-semibold sm:w-auto sm:min-h-10",
          )}
        >
          Sign in to request
        </Link>
        <Link
          href={signUpHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "flex w-full min-h-11 items-center justify-center rounded-xl font-semibold sm:w-auto sm:min-h-10",
          )}
        >
          Create account
        </Link>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <Link
        href={onboardingHref}
        className={cn(
          buttonVariants({ size: "default" }),
          "flex w-full min-h-11 items-center justify-center rounded-xl font-semibold sm:w-auto sm:min-h-10",
        )}
      >
        Complete profile to request
      </Link>
    );
  }

  return (
    <Button
      type="button"
      disabled={pending}
      className="min-h-11 w-full rounded-xl font-semibold shadow-sm sm:min-h-10 sm:w-auto"
      onClick={() => {
        startTransition(async () => {
          const res = await requestJoinFriendlySession(inviteToken);
          if ("error" in res && res.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Join request sent");
          router.refresh();
        });
      }}
    >
      {pending ? "Sending…" : "Request to join"}
    </Button>
  );
}
