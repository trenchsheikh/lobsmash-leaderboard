"use client";

import { useState } from "react";
import { ChevronDown, UserCircle, UserPlus } from "lucide-react";
import { AddMemberForm } from "@/components/add-member-form";
import { GuestPlayerForm } from "@/components/guest-player-form";
import { buttonVariants } from "@/lib/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Panel = "member" | "guest";

export function LeagueAddRosterDropdown({
  leagueId,
  onNavigateToPeopleTab,
}: {
  leagueId: string;
  /** When set, used after a guest is saved: next “Add guest player” opens the People tab. */
  onNavigateToPeopleTab?: () => void;
}) {
  const [panel, setPanel] = useState<Panel>("member");
  /** After a successful guest add, next dropdown click on “Add guest player” goes to People. */
  const [guestJustAdded, setGuestJustAdded] = useState(false);

  function onGuestAdded() {
    setGuestJustAdded(true);
  }

  function onChooseGuestPanel() {
    if (guestJustAdded && onNavigateToPeopleTab) {
      onNavigateToPeopleTab();
      setGuestJustAdded(false);
    }
    setPanel("guest");
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>Add to roster</CardTitle>
          <CardDescription>
            Invite members or add a guest for one-off fill-ins. Use the menu to switch between the two
            flows.
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "shrink-0 gap-2 self-start",
            )}
            aria-label="Choose how to add to roster"
          >
            {panel === "member" ? "Add members" : "Add guest player"}
            <ChevronDown className="size-4 opacity-70" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Roster actions
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setPanel("member")}
                className={cn(panel === "member" && "bg-accent/80")}
              >
                <UserPlus className="size-4" aria-hidden />
                Add members
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPanel("guest")}
                className={cn(panel === "guest" && "bg-accent/80")}
              >
                <UserCircle className="size-4" aria-hidden />
                Add guest player
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        {panel === "member" ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Invite by exact username, search players you share a league with, or pick someone from
              your other leagues.
            </p>
            <AddMemberForm leagueId={leagueId} />
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Guests are not linked to a login; ideal for one-off fill-ins.
            </p>
            <GuestPlayerForm leagueId={leagueId} onGuestAdded={onGuestAdded} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
