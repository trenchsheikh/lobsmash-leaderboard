import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Extra classes on the glass panel wrapper. */
  className?: string;
};

const glassPanel =
  "rounded-xl border border-border bg-card shadow-md backdrop-blur-sm dark:border-white/12 dark:bg-card/90";

export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div className={cn(glassPanel, "p-3.5 sm:p-4", className)}>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-row items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            {title}
          </h1>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-0.5">
              {actions}
            </div>
          ) : null}
        </div>
        {description ? (
          <div className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
