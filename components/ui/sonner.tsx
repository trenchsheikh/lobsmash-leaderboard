"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useIsMaxSm } from "@/lib/use-is-max-sm";

const Toaster = ({ ...props }: ToasterProps) => {
  const mobile = useIsMaxSm();

  return (
    <Sonner
      theme="system"
      position={mobile ? "bottom-center" : "top-right"}
      className="toaster group max-sm:[--offset-bottom:max(1rem,env(safe-area-inset-bottom,0px))]"
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Spinner className="size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
