import { redirect } from "next/navigation";
import { getOnboardingState } from "@/lib/auth/profile";
import { isSafePostAuthRedirectPath } from "@/lib/safe-redirect-url";
import { OnboardingFlow } from "@/components/onboarding-flow";

type PageProps = { searchParams: Promise<{ redirect_url?: string }> };

export default async function OnboardingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const joinRedirectUrl = isSafePostAuthRedirectPath(sp.redirect_url)
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
    preferred_side: p?.preferred_side,
    experience_level: p?.experience_level,
    strengths: p?.play_styles,
    profile_attributes: (p?.profile_attributes as Record<string, number> | null) ?? null,
    improvement_areas: (p?.improvement_areas as string[] | null) ?? null,
    city_or_postcode: (p?.city_or_postcode as string | null) ?? null,
    travel_distance_km: (p?.travel_distance_km as number | null) ?? null,
    usual_play_times: (p?.usual_play_times as string[] | null) ?? null,
  };

  return (
    <OnboardingFlow
      variant="onboarding"
      defaults={defaults}
      joinRedirectUrl={joinRedirectUrl}
    />
  );
}
