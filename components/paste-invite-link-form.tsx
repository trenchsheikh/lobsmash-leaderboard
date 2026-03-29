"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import {
  isValidLeagueInviteCode,
  normalizeLeagueCode,
} from "@/lib/league-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UUID_STANDALONE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Path segment after /join/ or pasted 8-char code / legacy UUID. */
function extractJoinSlug(raw: string): string | null {
  const t = raw.trim();
  const fromPath = t.match(/\/join\/([^/?#]+)/i)?.[1];
  if (fromPath) {
    const seg = decodeURIComponent(fromPath).trim();
    if (isValidLeagueInviteCode(seg)) return normalizeLeagueCode(seg);
    if (UUID_STANDALONE.test(seg)) return seg;
    return null;
  }
  if (isValidLeagueInviteCode(t)) return normalizeLeagueCode(t);
  if (UUID_STANDALONE.test(t)) return t;
  return null;
}

export function PasteInviteLinkForm() {
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(
      (e.currentTarget.elements.namedItem("invite") as HTMLInputElement)?.value ?? "",
    );
    if (!raw.trim()) {
      toast.error("Paste an invite link or league code.");
      return;
    }
    const slug = extractJoinSlug(raw);
    if (!slug) {
      toast.error(
        "Could not read that link. Paste the full URL (…/join/CODE) or your 8-character league code.",
      );
      return;
    }
    router.push(`/join/${slug}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="invite-link">Invite link or code</Label>
        <Input
          id="invite-link"
          name="invite"
          placeholder="https://…/join/ABCD2345 or ABCD2345"
          autoComplete="off"
          className="font-mono text-sm"
        />
      </div>
      <Button type="submit" className="gap-2">
        <Link2 className="size-4" aria-hidden />
        Open invite
      </Button>
    </form>
  );
}
