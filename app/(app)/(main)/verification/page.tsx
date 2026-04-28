import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/profile";
import { CoachVerificationSlotsPanel } from "@/components/verification/coach-verification-slots-panel";
import { HowWeVerifyDialog } from "@/components/verification/how-we-verify-dialog";
import { PageHeader } from "@/components/page-header";
import {
  VerificationPlayerFlow,
  type ServerVerificationRequest,
} from "@/components/verification/verification-player-flow";
import {
  DEMO_COACH_A,
  DEMO_COACH_B,
  getDemoBookableSlots,
  seedDemoCoachLabels,
  verificationMocksEnabled,
} from "@/lib/verification-mocks";
import type { BookableSlot } from "@/components/verification/verification-slots-book-grid";
import { BadgeCheck } from "lucide-react";

export default async function VerificationPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: player } = await supabase
    .from("players")
    .select("id, coach_verified_at")
    .eq("user_id", user.id)
    .single();

  if (!player) {
    return (
      <p className="text-sm text-muted-foreground">
        Complete onboarding first, then return here.
      </p>
    );
  }

  const { data: coachRow } = await supabase
    .from("coach_profiles")
    .select("approved_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const isApprovedCoach = Boolean(coachRow?.approved_at);

  const nowIso = new Date().toISOString();

  const { data: openSlotRows } = await supabase
    .from("coach_verification_slots")
    .select("id, coach_user_id, venue, starts_at, duration_minutes, notes, status")
    .eq("status", "open")
    .gt("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(80);

  const slotCoachIds = [...new Set((openSlotRows ?? []).map((r) => r.coach_user_id))];
  const slotUsersMap = new Map<
    string,
    { name: string | null; username: string | null; avatar_url: string | null }
  >();
  const coachIdSet = new Set(slotCoachIds);
  coachIdSet.add(user.id);
  const allSlotUserIds = [...coachIdSet];
  if (allSlotUserIds.length > 0) {
    const { data: urows } = await supabase
      .from("users")
      .select("id, name, username, avatar_url")
      .in("id", allSlotUserIds);
    for (const u of urows ?? []) {
      slotUsersMap.set(u.id, {
        name: u.name,
        username: u.username,
        avatar_url: u.avatar_url,
      });
    }
  }

  const realBookableSlots: BookableSlot[] = (openSlotRows ?? []).map((s) => ({
    id: s.id as string,
    coach_user_id: s.coach_user_id as string,
    venue: s.venue as string,
    starts_at: s.starts_at as string,
    duration_minutes: s.duration_minutes as number,
    notes: (s.notes as string | null) ?? null,
    coach: slotUsersMap.get(s.coach_user_id as string) ?? null,
  }));

  const useMocks = verificationMocksEnabled();
  const bookableSlots: BookableSlot[] = useMocks
    ? [...getDemoBookableSlots(), ...realBookableSlots]
    : realBookableSlots;

  let coachOwnSlots: (BookableSlot & { status: string })[] = [];
  if (isApprovedCoach) {
    const { data: mine } = await supabase
      .from("coach_verification_slots")
      .select("id, coach_user_id, venue, starts_at, duration_minutes, notes, status")
      .eq("coach_user_id", user.id)
      .in("status", ["open", "booked"])
      .order("starts_at", { ascending: false })
      .limit(25);

    coachOwnSlots = (mine ?? []).map((s) => ({
      id: s.id as string,
      coach_user_id: s.coach_user_id as string,
      venue: s.venue as string,
      starts_at: s.starts_at as string,
      duration_minutes: s.duration_minutes as number,
      notes: (s.notes as string | null) ?? null,
      coach: slotUsersMap.get(s.coach_user_id as string) ?? {
        name: null,
        username: null,
        avatar_url: null,
      },
      status: s.status as string,
    }));
  }

  const { data: myRequests } = await supabase
    .from("player_verification_requests")
    .select("id, status, coach_user_id, created_at, slot_id")
    .eq("player_id", player.id)
    .order("created_at", { ascending: false });

  const pendingCoachIds =
    (myRequests ?? [])
      .filter((r) => r.status === "pending")
      .map((r) => r.coach_user_id as string) ?? [];

  const coachNames = new Map<string, { name: string | null; username: string | null }>();
  const coachIdsForLabels = [...new Set((myRequests ?? []).map((r) => r.coach_user_id))];
  const coachIdsForDb = coachIdsForLabels.filter((id) => id !== DEMO_COACH_A && id !== DEMO_COACH_B);
  if (coachIdsForDb.length > 0) {
    const { data: cu } = await supabase
      .from("users")
      .select("id, name, username")
      .in("id", coachIdsForDb);
    for (const row of cu ?? []) {
      coachNames.set(row.id, { name: row.name, username: row.username });
    }
  }
  if (useMocks) seedDemoCoachLabels(coachNames);

  const coachNamesRecord = Object.fromEntries(coachNames);

  const verified = Boolean(player.coach_verified_at);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Coach verification"
        description={
          <>
            Book an open session: venue, time, and coach are listed on each card. After you play,
            your coach submits your verified ratings from their inbox.
          </>
        }
        actions={<HowWeVerifyDialog />}
      />

      {verified ? (
        <div className="flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-sm text-foreground">
          <BadgeCheck className="size-5 shrink-0 text-primary" aria-hidden />
          <span>
            Your profile is coach-verified
            {player.coach_verified_at
              ? ` · ${new Date(player.coach_verified_at as string).toLocaleDateString()}`
              : null}
          </span>
        </div>
      ) : null}

      <VerificationPlayerFlow
        bookableSlots={bookableSlots}
        currentUserId={user.id}
        serverPendingCoachIds={pendingCoachIds}
        showDemoStrip={useMocks}
        myRequests={(myRequests ?? []) as ServerVerificationRequest[]}
        coachNames={coachNamesRecord}
        isApprovedCoach={isApprovedCoach}
      />

      {isApprovedCoach ? <CoachVerificationSlotsPanel slots={coachOwnSlots} /> : null}

      {!isApprovedCoach ? (
        <p className="text-center text-sm text-muted-foreground">
          Want to list sessions?{" "}
          <Link href="/become-a-coach" className="font-medium text-primary underline-offset-2 hover:underline">
            Become a coach on LobSmash
          </Link>
        </p>
      ) : null}
    </div>
  );
}
