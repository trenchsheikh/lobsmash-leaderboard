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
      <aside className="relative order-1 flex min-h-[38vh] w-full flex-1 flex-col lg:min-h-full lg:w-1/2 lg:max-w-[50vw]">
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

        <div className="pointer-events-none relative z-10 mt-auto w-full p-6 pb-8 sm:p-8 sm:pb-10 lg:pb-12">
          <div className="pointer-events-auto flex max-w-lg flex-col gap-3">
            <Image
              src="/lobsmash-logo-removebg-preview.png"
              alt="LobSmash"
              width={500}
              height={500}
              className="h-10 w-auto max-w-[min(140px,38vw)] shrink-0 object-contain object-left brightness-0 invert drop-shadow-md sm:h-11 sm:max-w-[160px]"
            />
            <p className="max-w-[20rem] text-pretty text-base font-semibold leading-tight tracking-tight text-white drop-shadow-md sm:max-w-none sm:text-lg">
              Performance analytics engineered for competitive padel.
            </p>
          </div>
        </div>
      </aside>

      <main className="relative order-2 flex min-h-0 flex-1 flex-col justify-center overflow-hidden bg-background px-4 py-8 sm:px-6 sm:py-10 lg:w-1/2 lg:px-10 lg:py-12">
        <div className="relative z-10 mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
