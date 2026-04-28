"use client";

import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDemoCoachVerificationProfile } from "@/lib/verification-mocks";
import { cn } from "@/lib/utils";
import { BadgeCheck, Check } from "lucide-react";

type Props = {
  coachUserId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

export function DemoCoachVerificationProfileDialog({
  coachUserId,
  displayName,
  username,
  avatarUrl,
}: Props) {
  const profile = getDemoCoachVerificationProfile(coachUserId);

  if (!profile) {
    return (
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <UserAvatarDisplay
          name={displayName}
          username={username}
          avatarUrl={avatarUrl}
          className="size-12 shrink-0 ring-2 ring-primary/20"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading font-semibold text-foreground">{displayName}</p>
          {username ? (
            <p className="truncate font-mono text-xs text-muted-foreground">@{username}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "group flex w-full min-w-0 items-start gap-3 rounded-lg border border-transparent p-1 text-left outline-none transition-colors",
              "hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <UserAvatarDisplay
              name={displayName}
              username={username}
              avatarUrl={avatarUrl}
              className="size-12 shrink-0 ring-2 ring-primary/20"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-heading font-semibold text-foreground">{displayName}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Preview
                </span>
              </div>
              {username ? (
                <p className="truncate font-mono text-xs text-muted-foreground">@{username}</p>
              ) : null}
              <p className="mt-1 text-[11px] font-medium text-primary group-hover:underline">
                Tap for a quick vibe check
              </p>
            </div>
          </button>
        }
      />
      <DialogContent
        showCloseButton
        className="max-h-[min(88dvh,calc(100dvh-2rem))] max-w-[min(calc(100vw-2rem),24rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="max-h-[min(88dvh,calc(100dvh-2rem))] overflow-y-auto">
          <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <UserAvatarDisplay
                name={displayName}
                username={username}
                avatarUrl={avatarUrl}
                className="size-14 shrink-0 ring-2 ring-primary/25"
              />
              <div className="min-w-0 flex-1">
                <DialogHeader className="gap-1 text-left">
                  <DialogTitle className="font-heading text-lg leading-snug">{displayName}</DialogTitle>
                  {username ? (
                    <p className="font-mono text-xs text-muted-foreground">@{username}</p>
                  ) : null}
                  <DialogDescription className="text-sm font-normal leading-snug text-foreground/90">
                    {profile.tagline}
                  </DialogDescription>
                </DialogHeader>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
                  <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
                  LobSmash verification coach (preview)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{profile.vibe}</p>
            <p className="text-sm italic leading-relaxed text-foreground/85">{profile.localPatch}</p>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preview credentials (illustrative)
              </p>
              <ul className="flex flex-col gap-2.5">
                {profile.credentials.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm leading-snug text-foreground">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden
                      strokeWidth={2.5}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-center text-[11px] leading-snug text-muted-foreground">
              Labels are demo-only — always check a coach&apos;s real qualifications yourself. Use{" "}
              <span className="font-medium text-foreground">How we verify</span> above for the full
              LobSmash + LTA picture.
            </p>

            <DialogClose
              render={
                <Button type="button" variant="outline" className="w-full">
                  Close
                </Button>
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
