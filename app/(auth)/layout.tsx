import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="relative order-1 flex min-h-0 flex-1 flex-col justify-end lg:min-h-dvh lg:w-1/2 lg:max-w-[50vw]">
        <div className="relative min-h-[32vh] w-full flex-1 lg:absolute lg:inset-0 lg:min-h-0">
          <Image
            src="/signin-page.png"
            alt="Padel on court — LobSmash"
            fill
            priority
            className="object-cover object-[center_30%]"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/40"
            aria-hidden
          />
        </div>

        <div className="relative z-10 flex flex-col gap-3 p-6 pb-8 text-white sm:p-8 sm:pb-10 lg:absolute lg:bottom-0 lg:right-0 lg:max-w-md lg:items-end lg:text-right">
          <Image
            src="/lobsmash-logo-removebg-preview.png"
            alt="LobSmash"
            width={160}
            height={48}
            className="h-9 w-auto drop-shadow-md sm:h-10 lg:ml-auto"
          />
          <p className="text-pretty text-sm font-medium leading-relaxed text-white/95 drop-shadow-md sm:text-base">
            The lob gives you room to breathe; the smash is where you mean it. LobSmash is that rhythm—patience,
            then conviction—played together on court.
          </p>
        </div>
      </aside>

      <main className="relative order-2 flex flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:w-1/2 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
