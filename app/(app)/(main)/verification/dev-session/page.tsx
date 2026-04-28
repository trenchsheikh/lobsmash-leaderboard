import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { VerificationDevSessionPortal } from "@/components/verification/verification-dev-session-portal";
import { getDemoBookableSlots, verificationMocksEnabled } from "@/lib/verification-mocks";

type Search = { coachId?: string; slotId?: string };

export default async function VerificationDevSessionPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  if (!verificationMocksEnabled()) notFound();

  const q = await searchParams;
  const coachId = (q.coachId ?? "").trim();
  const slotId = (q.slotId ?? "").trim();
  if (!coachId || !slotId) notFound();

  const slot = getDemoBookableSlots().find((s) => s.id === slotId && s.coach_user_id === coachId);
  if (!slot) notFound();

  const { supabase, user } = await requireOnboarded();
  const { data: player } = await supabase
    .from("players")
    .select("name, profile_attributes")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: urow } = await supabase
    .from("users")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const coachLabel =
    slot.coach?.name?.trim() ||
    (slot.coach?.username ? `@${slot.coach.username}` : "Demo coach");

  return (
    <VerificationDevSessionPortal
      slotId={slot.id}
      coachUserId={slot.coach_user_id}
      coachLabel={coachLabel}
      slotVenue={slot.venue}
      playerName={(player?.name as string) ?? "You"}
      playerUsername={urow?.username?.trim() ?? null}
      selfReported={(player?.profile_attributes as Record<string, number> | null) ?? null}
    />
  );
}
