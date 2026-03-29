import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/auth/profile";
import { isSafeJoinRedirectPath } from "@/lib/safe-redirect-url";
import { OnboardingFlow } from "@/components/onboarding-flow";

type PageProps = { searchParams: Promise<{ redirect_url?: string }> };

export default async function OnboardingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const joinRedirectUrl = isSafeJoinRedirectPath(sp.redirect_url)
    ? sp.redirect_url
    : undefined;

  const state = await getOnboardingState();
  if (state.complete) {
    redirect(joinRedirectUrl ?? "/dashboard");
  }

  const p = state.player;
  const defaults = {
    name: state.profile?.name,
    username: state.profile?.username,
    avatar_url: state.profile?.avatar_url,
    playstyle: p?.playstyle,
    preferred_side: p?.preferred_side,
    experience_level: p?.experience_level,
    strengths: p?.strengths,
    weaknesses: p?.weaknesses,
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full min-w-0 max-w-2xl rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-6">
        <OnboardingFlow
          variant="onboarding"
          defaults={defaults}
          joinRedirectUrl={joinRedirectUrl}
        />
      </div>
    </div>
  );
}
