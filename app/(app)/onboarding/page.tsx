import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/auth/profile";
import { OnboardingFlow } from "@/components/onboarding-flow";

export default async function OnboardingPage() {
  const state = await getOnboardingState();
  if (state.complete) redirect("/dashboard");

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
        <OnboardingFlow variant="onboarding" defaults={defaults} />
      </div>
    </div>
  );
}
