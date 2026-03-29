import Link from "next/link";
import { cn } from "@/lib/utils";

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col bg-background">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border/70 bg-card/80 backdrop-blur-lg supports-[backdrop-filter]:bg-card/65">
        <div
          className={cn(
            "mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4 sm:h-[3.75rem] sm:px-6",
            "pt-[max(0px,env(safe-area-inset-top))]",
          )}
        >
          <Link
            href="/"
            className={cn(
              "group flex items-center gap-2.5 rounded-lg outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl",
                "bg-primary text-sm font-bold text-primary-foreground shadow-sm",
                "ring-1 ring-primary/25 transition-transform duration-200",
                "group-hover:scale-[1.02] group-active:scale-[0.98]",
              )}
              aria-hidden
            >
              LS
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-heading text-[1.05rem] font-bold tracking-tight text-foreground sm:text-lg">
                <span className="text-primary">Lob</span>
                <span className="text-foreground">Smash</span>
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
                League invites
              </span>
            </span>
          </Link>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          aria-hidden
          style={{
            backgroundImage: `
              radial-gradient(ellipse 90% 55% at 50% -15%, oklch(0.52 0.1 145 / 14%), transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 60%, oklch(0.55 0.06 145 / 8%), transparent 45%)
            `,
          }}
        />
        <div
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center",
            "px-4 py-6 sm:px-6 sm:py-10",
            "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
