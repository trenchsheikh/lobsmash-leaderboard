import Image from "next/image";
import { Inter, Manrope } from "next/font/google";

const fontAuthDisplay = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope-auth",
  weight: ["500", "600", "700", "800"],
});

const fontAuthSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter-auth",
});

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-bold tabular-nums text-[#86E10B] sm:text-xl">{value}</span>
      <span className="text-xs font-medium text-white/55 sm:text-sm">{label}</span>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fontAuthSans.variable} ${fontAuthDisplay.variable} fixed inset-0 z-0 flex flex-col overflow-hidden bg-transparent font-[family-name:var(--font-inter-auth),ui-sans-serif,system-ui,sans-serif] antialiased lg:static lg:z-auto lg:min-h-[100dvh] lg:flex-row lg:overflow-visible`}
    >
      <div className="flex flex-1 flex-col overflow-hidden lg:min-h-0 lg:flex-row lg:overflow-visible">
        <aside className="relative order-1 flex w-full shrink-0 flex-col overflow-hidden bg-[#00235B] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-8 sm:pb-8 sm:pt-[calc(env(safe-area-inset-top)+1.75rem)] lg:order-none lg:w-[42%] lg:max-w-[min(32rem,42vw)] lg:min-h-[100dvh] lg:justify-between lg:px-10 lg:pb-[calc(env(safe-area-inset-bottom)+3rem)] lg:pt-[calc(env(safe-area-inset-top)+2.5rem)]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[#86E10B]/[0.07] blur-3xl max-lg:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-20 size-64 rounded-full bg-black/25 blur-2xl max-lg:hidden"
            aria-hidden
          />

          <header className="relative z-10 flex items-center gap-2.5 sm:gap-3">
            <Image
              src="/lobsmash-logo-removebg-preview.png"
              alt="LobSmash"
              width={160}
              height={160}
              className="h-7 w-auto shrink-0 object-contain object-left brightness-0 invert sm:h-10"
            />
            <span
              className={`${fontAuthDisplay.className} text-base font-bold tracking-tight text-white sm:text-xl`}
            >
              LobSmash
            </span>
          </header>

          <p
            className={`${fontAuthDisplay.className} relative z-10 mt-1.5 text-[12px] font-semibold leading-snug text-white/70 sm:hidden`}
          >
            Your game. Elevated.
          </p>

          <div className="relative z-10 mt-6 hidden flex-col gap-3 sm:mt-8 sm:flex lg:mt-0 lg:flex-1 lg:justify-center lg:gap-4">
            <h1
              className={`${fontAuthDisplay.className} max-w-[16rem] text-pretty text-2xl font-bold leading-tight tracking-tight text-white sm:max-w-xl sm:text-3xl lg:text-4xl`}
            >
              Your game. Elevated.
            </h1>
            <p className="max-w-md text-pretty text-sm leading-relaxed text-white/65 sm:text-base">
              Performance analytics, leagues & matchmaking for serious padel players.
            </p>
          </div>

          <div className="relative z-10 mt-8 hidden grid-cols-3 gap-3 border-t border-white/10 pt-6 sm:grid sm:gap-4 sm:pt-8 lg:mt-10 lg:pt-10">
            <StatBlock value="2.4K+" label="Players" />
            <StatBlock value="140+" label="Leagues" />
            <StatBlock value="98%" label="Match rate" />
          </div>
        </aside>

        <main className="relative order-2 flex flex-1 flex-col justify-start overflow-y-auto bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 sm:justify-center sm:px-6 sm:py-10 lg:min-h-[100dvh] lg:flex-1 lg:justify-center lg:overflow-visible lg:px-12 lg:py-12 xl:px-16">
          <div className="relative z-10 mx-auto w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
