import { requireOnboarded } from "@/lib/auth/profile";
import { MainHeader } from "@/components/main-header";
import { MainRouteTransition } from "@/components/main-route-transition";

export default async function MainShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireOnboarded();

  return (
    <>
      <MainHeader
        user={{
          name: profile?.name?.trim() ?? null,
          username: profile?.username?.trim() ?? null,
          avatarUrl: profile?.avatar_url?.trim() ?? null,
        }}
      />
      <MainRouteTransition>
        <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-3 py-8 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] sm:px-4">
          {children}
        </main>
      </MainRouteTransition>
    </>
  );
}
