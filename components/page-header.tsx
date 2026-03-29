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
  "rounded-xl border border-white/30 bg-card/80 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-card/75";

export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div className={cn(glassPanel, "p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <div className="mt-1.5 max-w-2xl text-pretty text-foreground/85">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
