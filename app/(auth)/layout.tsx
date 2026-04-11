import Image from "next/image";

/** Very subtle noise — barely visible, avoids banding without a gritty look. */
function FilmGrainOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light"
      aria-hidden
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background lg:min-h-0 lg:flex-row">
      {/*
        Mobile: fixed-height hero band so the sign-in card gets predictable space; desktop: half-width column.
        max-lg rounded main below ties the two panels together visually on small screens.
      */}
      <aside className="relative order-1 flex h-[min(40vh,24rem)] w-full shrink-0 flex-col overflow-hidden sm:h-[min(42vh,26rem)] lg:order-none lg:h-auto lg:min-h-full lg:w-1/2 lg:max-w-[50vw] lg:flex-1">
        <div className="absolute inset-0">
          <Image
            src="/signin-page.png"
            alt="Padel on court — LobSmash"
            fill
            priority
            quality={92}
            className="object-cover object-[center_28%] contrast-[1.02] saturate-[1.03]"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/20"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25"
            aria-hidden
          />
          <FilmGrainOverlay />
        </div>

        <div className="pointer-events-none relative z-10 flex h-full min-h-0 flex-col justify-end p-5 pb-6 sm:p-7 sm:pb-9 lg:pb-12">
          <div className="pointer-events-auto flex max-w-sm flex-col items-start gap-2.5 text-left sm:gap-3">
            <Image
              src="/lobsmash-logo-removebg-preview.png"
              alt="LobSmash"
              width={500}
              height={500}
              className="h-9 w-auto max-w-[min(200px,70vw)] object-contain object-left drop-shadow-md sm:h-11"
            />
            <p className="text-pretty text-[13px] font-medium leading-snug text-white/90 drop-shadow-md sm:text-sm sm:text-base">
              One place for the leagues you run, the sessions you play, and the standings everyone can trust.
            </p>
          </div>
        </div>
      </aside>

      <main className="relative order-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pt-5 pb-8 sm:px-6 sm:pt-6 sm:pb-10 lg:w-1/2 lg:justify-center lg:px-10 lg:py-12 max-lg:rounded-t-[1.75rem] max-lg:shadow-[0_-10px_40px_-12px_rgba(0,45,98,0.14)] dark:max-lg:shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.35)]">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-navy/30 via-brand-navy/18 via-40% to-brand-lime/14 dark:from-brand-navy/55 dark:via-brand-navy/32 dark:via-45% dark:to-brand-lime/10 max-lg:rounded-t-[1.75rem]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col justify-start lg:justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
