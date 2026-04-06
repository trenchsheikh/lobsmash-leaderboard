import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  /** e.g. "Account" on auth flow */
  subtitle?: string;
  /** Link target for logo (default home) */
  href?: string;
  className?: string;
  /** Centre the logo in the header (league invite flow) */
  centered?: boolean;
};

export function BrandShellHeader({ subtitle, href = "/", className, centered }: Props) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 shrink-0 border-b border-border bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/90",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-14 max-w-2xl items-center gap-3 px-4 sm:h-[3.75rem] sm:px-6",
          centered ? "justify-center" : "justify-between",
          "pt-[max(0px,env(safe-area-inset-top))]",
        )}
      >
        <Link
          href={href}
          className={cn(
            "group flex min-w-0 items-center gap-3 rounded-lg outline-none",
            centered && "justify-center",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <Image
            src="/lobsmash-logo-removebg-preview.png"
            alt="LobSmash"
            width={200}
            height={200}
            className="h-9 w-auto shrink-0 sm:h-10"
            priority
          />
          {subtitle ? (
            <span className="min-w-0 text-[10px] font-medium uppercase leading-tight tracking-[0.14em] text-muted-foreground sm:text-[11px]">
              {subtitle}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
