import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { FriendlySessionLobbyPanel } from "@/components/friendly/friendly-session-lobby-panel";
import type { FriendlySlotDisplay } from "@/components/friendly/friendly-session-card";
import { PageHeader } from "@/components/page-header";
import { DEFAULT_SKILL, formatDisplayLevel } from "@/lib/rating";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ sessionId: string }> };

async function absoluteUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return path;
  return `${proto}://${host}${path}`;
}

export default async function FriendlySessionPage({ params }: PageProps) {
  noStore();
  const { sessionId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: session, error: sErr } = await supabase
    .from("friendly_sessions")
    .select(
      "id, creator_user_id, invite_token, capacity, title, starts_at, status, created_at, match_kind, skill_rating_applied_at",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session) notFound();

  const { data: rosterRows, error: rErr } = await supabase
    .from("friendly_session_roster")
    .select("user_id, slot_index")
    .eq("session_id", sessionId)
    .order("slot_index", { ascending: true });

  if (rErr) notFound();

  const roster = rosterRows ?? [];
  const userIds = roster.map((r) => r.user_id as string);

  let userRows: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  }[] = [];
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select("id, name, username, avatar_url")
      .in("id", userIds);
    userRows = data ?? [];
  }

  let playerByUserId = new Map<string, string>();
  let skillByPlayerId = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: playerRows } = await supabase
      .from("players")
      .select("id, user_id")
      .in("user_id", userIds);

    playerByUserId = new Map(
      (playerRows ?? []).map((p) => [p.user_id as string, p.id as string]),
    );

    const playerIds = [...playerByUserId.values()];
    if (playerIds.length > 0) {
      const { data: ratingRows } = await supabase
        .from("player_ratings")
        .select("player_id, skill")
        .in("player_id", playerIds);

      skillByPlayerId = new Map(
        (ratingRows ?? []).map((row) => [row.player_id as string, row.skill as number]),
      );
    }
  }

  const userById = new Map(
    (userRows ?? []).map((u) => [
      u.id as string,
      {
        name: u.name as string | null,
        username: u.username as string | null,
        avatarUrl: u.avatar_url as string | null,
      },
    ]),
  );

  const capacity = session.capacity as number;
  const half = capacity / 2;

  const slotByIndex = new Map<number, (typeof roster)[0]>();
  for (const row of roster) {
    slotByIndex.set(row.slot_index as number, row);
  }

  const skillsNumeric: number[] = [];
  function slotDisplay(i: number): FriendlySlotDisplay {
    const row = slotByIndex.get(i);
    if (!row) {
      return {
        slotIndex: i,
        userId: null,
        name: null,
        username: null,
        avatarUrl: null,
        displayLevel: null,
      };
    }
    const uid = row.user_id as string;
    const u = userById.get(uid);
    const pid = playerByUserId.get(uid);
    const sk = pid ? skillByPlayerId.get(pid) : undefined;
    const skill = typeof sk === "number" && Number.isFinite(sk) ? sk : DEFAULT_SKILL;
    skillsNumeric.push(skill);
    return {
      slotIndex: i,
      userId: uid,
      name: u?.name ?? null,
      username: u?.username ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      displayLevel: formatDisplayLevel(skill),
    };
  }

  const teamA: FriendlySlotDisplay[] = [];
  const teamB: FriendlySlotDisplay[] = [];
  for (let i = 0; i < half; i++) teamA.push(slotDisplay(i));
  for (let i = half; i < capacity; i++) teamB.push(slotDisplay(i));

  let ratingBandLabel: string | null = null;
  if (skillsNumeric.length >= 2) {
    const mn = Math.min(...skillsNumeric);
    const mx = Math.max(...skillsNumeric);
    ratingBandLabel = `${formatDisplayLevel(mn)} – ${formatDisplayLevel(mx)}`;
  } else if (skillsNumeric.length === 1) {
    ratingBandLabel = formatDisplayLevel(skillsNumeric[0]!);
  }

  const invitePath = `/friendly/invite/${session.invite_token as string}`;
  const inviteUrl = await absoluteUrl(invitePath);

  const isCreator = user.id === session.creator_user_id;
  const matchKind =
    (session as { match_kind?: string }).match_kind === "competitive" ? "competitive" : "friendly";
  const skillRatingAppliedAt =
    (session as { skill_rating_applied_at?: string | null }).skill_rating_applied_at ?? null;

  const { data: gameRows } = await supabase
    .from("friendly_session_games")
    .select("court_number, team_a_players, team_b_players, team_a_score, team_b_score, winner")
    .eq("friendly_session_id", sessionId)
    .order("court_number", { ascending: true });

  let competitiveApprovalUserIds: string[] = [];
  if (matchKind === "competitive") {
    const { data: appr } = await supabase
      .from("friendly_session_competitive_approvals")
      .select("user_id")
      .eq("session_id", sessionId);
    competitiveApprovalUserIds = (appr ?? []).map((r) => r.user_id as string);
  }

  const playerIdBySlot: (string | null)[] = Array.from({ length: capacity }, (_, i) => {
    const row = slotByIndex.get(i);
    if (!row) return null;
    return playerByUserId.get(row.user_id as string) ?? null;
  });
  const rosterFull = playerIdBySlot.every((p) => p !== null);
  const leftPlayerIds = playerIdBySlot.slice(0, half).filter((p): p is string => p !== null);
  const rightPlayerIds = playerIdBySlot.slice(half).filter((p): p is string => p !== null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Open session"
        description={
          matchKind === "competitive"
            ? "Competitive — organiser enters scores; every other player approves before global skill updates."
            : "Friendly — global skill does not change. Complete when everyone has joined."
        }
      />
      <FriendlySessionLobbyPanel
        sessionId={sessionId}
        title={session.title as string | null}
        startsAt={session.starts_at as string | null}
        capacity={capacity}
        status={session.status as string}
        matchKind={matchKind}
        ratingBandLabel={ratingBandLabel}
        teamA={teamA}
        teamB={teamB}
        isCreator={isCreator}
        creatorUserId={session.creator_user_id as string}
        currentUserId={user.id}
        inviteUrl={inviteUrl}
        skillRatingAppliedAt={skillRatingAppliedAt}
        leftPlayerIds={leftPlayerIds}
        rightPlayerIds={rightPlayerIds}
        rosterFull={rosterFull}
        competitiveApprovalUserIds={competitiveApprovalUserIds}
        rosterUserIds={userIds}
        initialGames={
          (gameRows ?? []) as Array<{
            court_number: number;
            team_a_players: string[];
            team_b_players: string[];
            team_a_score: number;
            team_b_score: number;
            winner: string;
          }>
        }
      />
    </div>
  );
}
