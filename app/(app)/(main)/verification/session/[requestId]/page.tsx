import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { VerificationSessionPortal } from "@/components/verification/verification-session-portal";

type Props = { params: Promise<{ requestId: string }> };

export default async function VerificationSessionPage({ params }: Props) {
  const { requestId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: req, error } = await supabase
    .from("player_verification_requests")
    .select("id, status, player_id, coach_user_id, slot_id")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !req) notFound();

  const { data: playerRow } = await supabase
    .from("players")
    .select(
      "user_id, name, profile_attributes, coach_verified_attributes, coach_verified_attribute_notes, coach_verified_at, coach_verified_by_display_name, coach_verified_venue",
    )
    .eq("id", req.player_id as string)
    .maybeSingle();

  if (!playerRow?.user_id) notFound();

  const playerUserId = playerRow.user_id as string;
  const isPlayer = user.id === playerUserId;
  const isCoach = user.id === (req.coach_user_id as string);

  if (!isPlayer && !isCoach) notFound();

  const { data: urow } = await supabase
    .from("users")
    .select("username")
    .eq("id", playerUserId)
    .maybeSingle();

  return (
    <VerificationSessionPortal
      requestId={req.id as string}
      status={req.status as string}
      slotId={(req.slot_id as string | null) ?? null}
      isPlayer={isPlayer}
      isCoach={isCoach}
      player={{
        name: (playerRow.name as string) ?? "Player",
        username: urow?.username?.trim() ?? null,
        selfReported: (playerRow.profile_attributes as Record<string, number> | null) ?? null,
        coachVerified: (playerRow.coach_verified_attributes as Record<string, number> | null) ?? null,
        coachVerifiedNotes:
          (playerRow.coach_verified_attribute_notes as Record<string, string> | null) ?? null,
        coachVerifiedAt: (playerRow.coach_verified_at as string | null) ?? null,
        coachVerifiedByLabel: (playerRow.coach_verified_by_display_name as string | null) ?? null,
        coachVerifiedVenue: (playerRow.coach_verified_venue as string | null) ?? null,
      }}
    />
  );
}
