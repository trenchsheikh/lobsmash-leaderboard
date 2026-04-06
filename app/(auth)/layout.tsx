import { BrandShellHeader } from "@/components/brand-shell-header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <BrandShellHeader subtitle="Account" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--brand-lime) 14%, transparent), transparent 55%)",
        }}
      />
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
