"use client";

import { useCallback, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildShareText(input: {
  location: string;
  time: string;
  level: string;
  /** Roster line after 👥, e.g. `3/4 players`. */
  players: string;
}): string {
  return [
    "🎾 LobSmash Game",
    "",
    `📍 ${input.location}`,
    `🕒 ${input.time}`,
    `🏆 ${input.level}`,
    `👥 ${input.players}`,
    "",
    "Tap to join 👇",
  ].join("\n");
}

function gameShareUrl(gameId: string): string {
  const envBase =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") : undefined;
  const base =
    envBase ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/game/${gameId}`;
}

export type ShareButtonProps = {
  gameId: string;
  location: string;
  time: string;
  level: string;
  /** Roster fraction + label, e.g. `3/4 players` (see plan: string props). */
  players: string;
  className?: string;
  /** Show a secondary WhatsApp button. */
  showWhatsApp?: boolean;
};

export type GameShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Programmatic share (Web Share → clipboard); same behavior as ShareButton. */
export async function runGameShare(props: ShareButtonProps): Promise<GameShareResult> {
  const url = gameShareUrl(props.gameId);
  const text = buildShareText(props);
  const title = "LobSmash Game";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function ShareButton({
  gameId,
  location,
  time,
  level,
  players,
  className,
  showWhatsApp = true,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    const url = gameShareUrl(gameId);
    const text = buildShareText({ location, time, level, players });
    const title = "LobSmash Game";

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      /* user cancel or share failed — try clipboard */
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  }, [gameId, location, time, level, players]);

  const openWhatsApp = useCallback(() => {
    const url = gameShareUrl(gameId);
    const text = buildShareText({ location, time, level, players });
    try {
      const href = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`;
      window.open(href, "_blank", "noopener,noreferrer");
    } catch {
      /* silent */
    }
  }, [gameId, location, time, level, players]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-1.5"
        onClick={() => void share()}
      >
        <Share2 className="size-4" aria-hidden />
        {copied ? "Copied!" : "Share"}
      </Button>
      {showWhatsApp ? (
        <Button type="button" variant="outline" size="sm" onClick={openWhatsApp}>
          WhatsApp
        </Button>
      ) : null}
    </div>
  );
}
