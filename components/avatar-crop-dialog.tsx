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
import { Loader2 } from "lucide-react";
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
        className="max-w-[min(100vw-1rem,26rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
          <DialogTitle>Position your photo</DialogTitle>
          <DialogDescription>
            Drag to move, use the slider to zoom. The circle is how others will see your
            avatar.
          </DialogDescription>
        </DialogHeader>

        {imageSrc ? (
          <div className="relative mx-auto aspect-square w-full max-w-[min(100vw-2rem,20rem)] bg-muted">
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

        <div className="space-y-2 px-4 pb-2 pt-3">
          <Label htmlFor="avatar-crop-zoom" className="text-xs text-muted-foreground">
            Zoom
          </Label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={working}
            className="h-2 w-full cursor-pointer accent-primary"
          />
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/40 px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={!pixels || working}
            onClick={() => void handleSave()}
          >
            {working ? (
              <>
                <Loader2 className="size-4 animate-spin" />
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
