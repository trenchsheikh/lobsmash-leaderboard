"use client";

import { useCallback, useEffect, useState } from "react";
import "react-easy-crop/react-easy-crop.css";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getCroppedCircularJpeg } from "@/lib/avatar-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called with a JPEG file ready for upload. Parent should clear the object URL and upload. */
  onCropped: (file: File) => void;
};

export function AvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onCropped,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setPixels(croppedPixels);
  }, []);

  useEffect(() => {
    if (open && imageSrc) {
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setPixels(null);
    }
  }, [open, imageSrc]);

  const handleSave = async () => {
    if (!imageSrc || !pixels || working) return;
    setWorking(true);
    try {
      const blob = await getCroppedCircularJpeg(imageSrc, pixels);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      onCropped(file);
    } catch {
      toast.error("Could not process this image. Try a different photo.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!working}
        className={cn(
          "!pl-0 !pr-0 !pt-0 !pb-0",
          "flex max-h-[calc(100dvh-1rem)] w-[min(100vw-1rem,28rem)] max-w-none flex-col gap-0 overflow-hidden",
          "sm:w-auto sm:max-w-md",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-[#eef1f6] px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-[17px] font-semibold text-[#00235B]">
            Position your photo
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.4] text-[#6f7d91]">
            Drag to reframe and use the slider to zoom. The circle shows how teammates
            will see your avatar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {imageSrc ? (
            <div className="relative mx-auto aspect-square w-full max-w-[min(100vw-2rem,18rem)] bg-[#0F1E3F]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          ) : null}

          <div className="space-y-2 px-5 pb-4 pt-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="avatar-crop-zoom"
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#00235B]"
              >
                Zoom
              </Label>
              <span className="text-[12px] tabular-nums text-[#6f7d91]">
                {zoom.toFixed(1)}x
              </span>
            </div>
            <input
              id="avatar-crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={working}
              className="h-2 w-full cursor-pointer accent-[#86E10B] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <DialogFooter
          className={cn(
            "!mx-0 !mb-0 shrink-0",
            "flex flex-row flex-nowrap items-center gap-2 rounded-none border-t border-[#eef1f6] bg-[#f7f9fc] p-3 sm:justify-between",
            "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
          )}
        >
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={() => onOpenChange(false)}
            className="h-10 min-w-0 flex-1 rounded-full border-[#E2E8F0] font-medium text-[#00235B] hover:bg-white sm:flex-none sm:min-w-[96px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!pixels || working}
            onClick={() => void handleSave()}
            className="h-10 min-w-0 flex-1 gap-2 rounded-full bg-[#86E10B] font-semibold text-[#00235B] shadow-sm hover:bg-[#95ea1d] disabled:bg-[#d3dde6] disabled:text-[#6f7d91] sm:flex-none sm:min-w-[120px]"
          >
            {working ? (
              <>
                <Spinner className="size-4" />
                Preparing…
              </>
            ) : (
              "Use photo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
