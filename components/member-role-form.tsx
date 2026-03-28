"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { updateMemberRole } from "@/app/actions/leagues";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MemberRoleForm({
  leagueId,
  memberId,
  currentRole,
}: {
  leagueId: string;
  memberId: string;
  currentRole: "owner" | "admin" | "player";
}) {
  const router = useRouter();

  async function setRole(next: "admin" | "player") {
    if (next === currentRole) return;
    const res = await updateMemberRole(leagueId, memberId, next);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Role updated");
    router.refresh();
  }

  if (currentRole === "owner") {
    return <span className="capitalize">{currentRole}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="capitalize">{currentRole}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Change member role"
        >
          <Settings2 className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={currentRole === "admin"}
            onClick={() => setRole("admin")}
          >
            Set admin
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={currentRole === "player"}
            onClick={() => setRole("player")}
          >
            Set player
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
