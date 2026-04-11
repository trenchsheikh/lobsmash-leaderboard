"use client";

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_TITLE = "Join my LobSmash open match";
const DEFAULT_TEXT = "Tap the link to request to join this open match.";

type Size = "default" | "sm" | "lg" | "icon";
type Variant = "default" | "outline" | "secondary" | "ghost";

export async function shareOrCopyInviteUrl(input: {
  url: string;
  title?: string;
  text?: string;
}): Promise<"shared" | "copied" | "aborted" | "failed"> {
  const title = input.title ?? DEFAULT_TITLE;
  const text = input.text ?? DEFAULT_TEXT;
  const shareData: ShareData = { title, text, url: input.url };

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const canTry =
      typeof navigator.canShare !== "function" || navigator.canShare(shareData);
    if (canTry) {
      try {
        await navigator.share(shareData);
        return "shared";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return "aborted";
        }
        /* share failed — try clipboard */
      }
    }
  }

  try {
    await navigator.clipboard.writeText(input.url);
    return "copied";
  } catch {
    return "failed";
  }
}

type Props = {
  url: string;
  shareTitle?: string;
  shareText?: string;
  label?: string;
  className?: string;
  size?: Size;
  variant?: Variant;
};

export function InviteLinkShareButton({
  url,
  shareTitle,
  shareText,
  label = "Share",
  className,
  size = "sm",
  variant = "outline",
}: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const result = await shareOrCopyInviteUrl({
      url,
      title: shareTitle,
      text: shareText,
    });
    if (result === "copied") {
      setCopied(true);
      toast.success("Copied");
      window.setTimeout(() => setCopied(false), 2000);
    } else if (result === "failed") {
      toast.error("Could not share or copy");
    }
  }, [url, shareTitle, shareText]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={() => void onClick()}
    >
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Share2 className="size-4" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
