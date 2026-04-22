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
    <div className="relative flex min-h-full flex-1 flex-col bg-white">
      <MainHeader
        user={{
          name: profile?.name?.trim() ?? null,
          username: profile?.username?.trim() ?? null,
          avatarUrl: profile?.avatar_url?.trim() ?? null,
        }}
      />
      <MainRouteTransition>
        <main className="relative z-10 mx-auto w-full min-w-0 max-w-5xl flex-1 px-3 py-5 pb-10 sm:px-4 sm:py-6">
          {children}
        </main>
      </MainRouteTransition>
    </div>
  );
}
