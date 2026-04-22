"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { removeAvatar, uploadAvatar } from "@/app/actions/avatar";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserAvatarDisplay } from "@/components/user-avatar-display";

type Props = {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  /** When false, hide remove (e.g. onboarding before first save). */
  allowRemove?: boolean;
  /** Larger preview and centered layout for onboarding. */
  variant?: "default" | "onboarding" | "onboarding-compact";
};

export function ProfileAvatarField({
  name,
  username,
  avatarUrl,
  allowRemove = true,
  variant = "default",
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [cropObjectUrl, setCropObjectUrl] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    setCropObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearCropObjectUrl() {
    setCropObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function onCroppedFile(file: File) {
    clearCropObjectUrl();
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadAvatar(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Photo updated");
      router.refresh();
    });
  }

  function onRemove() {
    if (!allowRemove && !avatarUrl) return;
    start(async () => {
      const res = await removeAvatar();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Photo removed");
      router.refresh();
    });
  }

  const isOnboarding = variant === "onboarding";
  const isCompact = variant === "onboarding-compact";

  if (isCompact) {
    return (
      <div className="min-w-0 rounded-[12px] border border-[#e4e9f2] bg-[#f3f6fc] p-3 sm:p-4">
        <AvatarCropDialog
          open={cropObjectUrl !== null}
          imageSrc={cropObjectUrl}
          onOpenChange={(open) => {
            if (!open) clearCropObjectUrl();
          }}
          onCropped={onCroppedFile}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          aria-label="Upload profile photo"
          onChange={onFile}
        />
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="shrink-0">
            {avatarUrl ? (
              <UserAvatarDisplay
                name={name}
                username={username}
                avatarUrl={avatarUrl}
                size="lg"
              />
            ) : (
              <div
                className="grid size-[52px] place-items-center rounded-full bg-white ring-1 ring-[#e4e9f2]"
                aria-hidden
              >
                <UserPlus className="size-5 text-[#6f7d91]" strokeWidth={1.75} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[14px] font-semibold text-[#0F1E3F]">
                Profile photo
              </span>
              <span className="text-[13px] font-normal text-[#8491a4]">
                (optional)
              </span>
            </div>
            <p className="mt-0.5 text-[13px] leading-[1.4] text-[#6f7d91]">
              Helps teammates recognise you on court. JPG or PNG, max 5MB.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[12.5px] font-medium text-[#00235B] transition-colors duration-200",
                  "hover:border-[#86E10B] hover:text-[#00235B]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                  "disabled:opacity-60",
                )}
              >
                {pending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Camera className="size-3.5" aria-hidden />
                )}
                {avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {allowRemove && avatarUrl ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={onRemove}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-medium text-[#7a8598] transition-colors duration-200 hover:text-[#c0123a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0123a]/25"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isOnboarding
          ? "min-w-0 rounded-2xl border border-border/80 bg-muted/25 p-4 sm:p-6 md:p-8"
          : undefined
      }
    >
      <AvatarCropDialog
        open={cropObjectUrl !== null}
        imageSrc={cropObjectUrl}
        onOpenChange={(open) => {
          if (!open) clearCropObjectUrl();
        }}
        onCropped={onCroppedFile}
      />
      <div
        className={
          isOnboarding
            ? "flex flex-col items-center gap-6"
            : "flex flex-col items-center gap-4 sm:flex-row sm:items-start"
        }
      >
        <div
          className={
            isOnboarding
              ? "relative shrink-0 rounded-full p-1 ring-2 ring-primary/15 ring-offset-2 ring-offset-background"
              : undefined
          }
        >
          <UserAvatarDisplay
            name={name}
            username={username}
            avatarUrl={avatarUrl}
            size={isOnboarding ? "xl" : "lg"}
          />
        </div>
        <div
          className={
            isOnboarding
              ? "flex w-full min-w-0 max-w-sm flex-col items-center gap-3"
              : "flex flex-col gap-2 sm:pt-1"
          }
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            aria-label="Upload profile photo"
            onChange={onFile}
          />
          <div
            className={
              isOnboarding
                ? "flex w-full flex-col gap-2 sm:flex-row sm:justify-center"
                : "flex flex-wrap justify-center gap-2 sm:justify-start"
            }
          >
            <Button
              type="button"
              variant={isOnboarding ? "default" : "secondary"}
              size={isOnboarding ? "default" : "sm"}
              className={cn("gap-2", isOnboarding && "min-h-10 w-full sm:w-auto")}
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? (
                <Spinner className="size-4" />
              ) : (
                <Camera className="size-4" />
              )}
              {avatarUrl ? "Change photo" : "Add a photo"}
            </Button>
            {allowRemove && avatarUrl ? (
              <Button
                type="button"
                variant="outline"
                size={isOnboarding ? "default" : "sm"}
                className={cn("gap-2", isOnboarding && "min-h-10 w-full sm:w-auto")}
                disabled={pending}
                onClick={onRemove}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
          <p
            className={cn(
              "text-xs text-muted-foreground",
              isOnboarding
                ? "max-w-sm text-center leading-relaxed"
                : "max-w-xs text-center sm:text-left",
            )}
          >
            You&apos;ll crop to a circle · JPEG/PNG/WebP/GIF · saved under 2&nbsp;MB
          </p>
        </div>
      </div>
    </div>
  );
}
