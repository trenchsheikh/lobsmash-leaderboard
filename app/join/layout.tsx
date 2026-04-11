import { BrandShellHeader } from "@/components/brand-shell-header";
import { cn } from "@/lib/utils";

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col bg-transparent">
      <BrandShellHeader centered />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
          style={{
            backgroundImage: `
              radial-gradient(ellipse 90% 55% at 50% -15%, color-mix(in srgb, var(--brand-lime) 18%, transparent), transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 60%, color-mix(in srgb, var(--brand-lime) 10%, transparent), transparent 45%)
            `,
          }}
        />
        <div
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center",
            "px-4 py-6 sm:px-6 sm:py-10",
            "pb-6",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
