import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  sortLeaderboard,
  sortLeaderboardChampionshipPlayers,
  sortPairChampionship,
  type LeaderboardRow,
  type LeagueFormat,
  type PairChampionshipRow,
} from "@/lib/leaderboard";
import {
  formatDisplayName,
  isLeagueFormat,
  sessionInputModeForFormat,
} from "@/lib/league-format";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DeleteLeagueButton } from "@/components/delete-league-button";
import { LeaguePageTabs } from "@/components/league/league-page-tabs";
import type { LeagueOverviewNextSessionPayload } from "@/components/league/league-overview-next-session";
import { displayFirstName } from "@/lib/display-name";
import { MAX_SESSION_COURTS, MIN_SESSION_COURTS } from "@/lib/session-courts";
import { DEFAULT_SKILL } from "@/lib/rating";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ leagueId: string }> };

export default async function LeaguePage({ params }: PageProps) {
  noStore();
  const { leagueId: leagueIdRaw } = await params;
  const leagueId = leagueIdRaw.trim().toLowerCase();
  const { supabase, user } = await requireOnboarded();

  const { data: league, error: leagueErr } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (leagueErr || !league) notFound();

  const { data: members } = await supabase
    .from("league_members")
    .select(
      `
      id,
      role,
      user_id,
      users ( name, username, avatar_url )
    `,
    )
    .eq("league_id", leagueId);

  const memberRows =
    members?.map((m) => {
      const u = m.users as unknown as {
        name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
      return {
        id: m.id as string,
        role: m.role as string,
        user_id: m.user_id as string,
        name: u?.name ?? "—",
        username: u?.username?.trim() ?? null,
        avatar_url: u?.avatar_url?.trim() ?? null,
      };
    }) ?? [];

  const myMembership = memberRows.find((m) => m.user_id === user.id);
  if (!myMembership) notFound();

  const viewerRoleLabel =
    myMembership.role === "owner"
      ? "Owner"
      : myMembership.role === "admin"
        ? "Admin"
        : "Member";

  const canAdmin = myMembership.role === "owner" || myMembership.role === "admin";
  const isOwner = myMembership.role === "owner";

  const memberUserIds = memberRows.map((m) => m.user_id);
  const { data: memberPlayers } = await supabase
    .from("players")
    .select("id, user_id, name")
    .in("user_id", memberUserIds);

  const playerByUserId = new Map(
    (memberPlayers ?? []).map((p) => [p.user_id as string, p]),
  );

  const memberRowsEnriched = memberRows.map((m) => ({
    ...m,
    player_id: (playerByUserId.get(m.user_id) as { id: string } | undefined)?.id,
  }));

  const { data: rosterRows } = await supabase
    .from("league_players")
    .select(
      `
      player_id,
      players (
        id,
        name,
        user_id,
        playstyle,
        users ( username, avatar_url )
      )
    `,
    )
    .eq("league_id", leagueId);

  const rosterPlayerIds = new Set(
    (rosterRows ?? []).map((r) => r.player_id as string),
  );

  const { data: rosterRatingRows } =
    rosterPlayerIds.size > 0
      ? await supabase
          .from("player_ratings")
          .select("player_id, skill")
          .in("player_id", [...rosterPlayerIds])
      : { data: [] as { player_id: string; skill: number }[] | null };

  const rosterSkillByPlayerId = new Map<string, number>();
  for (const row of rosterRatingRows ?? []) {
    rosterSkillByPlayerId.set(row.player_id as string, row.skill as number);
  }

  const rosterDisplay =
    rosterRows?.map((r) => {
      const p = r.players as unknown as {
        id: string;
        name: string;
        user_id: string | null;
        playstyle: string | null;
        users: { username: string | null; avatar_url: string | null } | null;
      } | null;
      const un = p?.users?.username?.trim() ?? null;
      const av = p?.users?.avatar_url?.trim() ?? null;
      return {
        id: p?.id ?? "",
        name: p?.name ?? "",
        username: un,
        avatar_url: av,
        isGuest: !p?.user_id,
        playstyle: p?.playstyle?.trim() ? p.playstyle : null,
      };
    }) ?? [];

  const membersNeedingLink = memberRows.filter((m) => {
    const p = playerByUserId.get(m.user_id);
    if (!p) return false;
    return !rosterPlayerIds.has(p.id);
  });

  const { data: sessionRows, error: sessionsErr } = await supabase
    .from("sessions")
    .select("id, date, status, num_courts, created_at")
    .eq("league_id", leagueId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (sessionsErr) {
    console.error("league page sessions list", sessionsErr.message, sessionsErr);
  }

  const sessionIds = (sessionRows ?? []).map((s) => s.id as string);
  const teamCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: teamRows, error: teamsErr } = await supabase
      .from("session_teams")
      .select("session_id")
      .in("session_id", sessionIds);
    if (teamsErr) {
      console.error("league page session_teams counts", teamsErr.message, teamsErr);
    }
    for (const t of teamRows ?? []) {
      const sid = t.session_id as string;
      teamCountBySession.set(sid, (teamCountBySession.get(sid) ?? 0) + 1);
    }
  }

  const sessions = (sessionRows ?? []).map((s) => {
    const id = s.id as string;
    const n = teamCountBySession.get(id) ?? 0;
    return {
      ...s,
      session_teams: [{ count: n }] as { count: number }[],
    };
  });

  const { data: statsRows } = await supabase
    .from("player_stats")
    .select(
      `
      player_id,
      total_games,
      total_wins,
      court1_wins,
      total_points,
      sessions_played,
      players ( name, users ( username, avatar_url ) )
    `,
    )
    .eq("league_id", leagueId);

  const leaderboardRaw: LeaderboardRow[] =
    statsRows?.map((s) => {
      const p = s.players as unknown as {
        name: string;
        users: { username: string | null; avatar_url: string | null } | null;
      } | null;
      const u = p?.users;
      return {
        player_id: s.player_id as string,
        name: p?.name ?? "Player",
        username: u?.username?.trim() ?? null,
        avatar_url: u?.avatar_url?.trim() ?? null,
        total_games: s.total_games as number,
        total_wins: s.total_wins as number,
        court1_wins: s.court1_wins as number,
        total_points: s.total_points as number,
        sessions_played: (s.sessions_played as number) ?? 0,
      };
    }) ?? [];

  const leagueFormat: LeagueFormat = isLeagueFormat(String(league.format))
    ? (league.format as LeagueFormat)
    : "americano";

  const leagueResultsMode = sessionInputModeForFormat(leagueFormat);

  const playerLeaderboardSummitStyle = leagueResultsMode === "champ_court_only";

  const leaderboard =
    leagueResultsMode === "champ_court_only"
      ? sortLeaderboardChampionshipPlayers(leaderboardRaw)
      : sortLeaderboard(leagueFormat, leaderboardRaw);

  const { data: pairStatsRows } =
    leagueResultsMode === "champ_court_only"
      ? await supabase
          .from("pair_championship_stats")
          .select("player_low, player_high, championship_wins, sessions_played")
          .eq("league_id", leagueId)
      : { data: null };

  const pairPlayerIds = new Set<string>();
  for (const r of pairStatsRows ?? []) {
    pairPlayerIds.add(r.player_low as string);
    pairPlayerIds.add(r.player_high as string);
  }

  const { data: pairPlayerRows } =
    pairPlayerIds.size > 0
      ? await supabase
          .from("players")
          .select("id, name, users ( username, avatar_url )")
          .in("id", [...pairPlayerIds])
      : { data: [] as { id: string; name: string; users: unknown }[] | null };

  const pairPlayerMetaById = new Map<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >();
  for (const p of pairPlayerRows ?? []) {
    const u = p.users as { username: string | null; avatar_url: string | null } | null;
    pairPlayerMetaById.set(p.id as string, {
      name: (p.name as string)?.trim() || "Player",
      username: u?.username?.trim() ?? null,
      avatar_url: u?.avatar_url?.trim() ?? null,
    });
  }

  const pairLeaderboardRaw: PairChampionshipRow[] =
    pairStatsRows?.map((row) => {
      const pl = row.player_low as string;
      const ph = row.player_high as string;
      const n1 = pairPlayerMetaById.get(pl)?.name ?? "Player";
      const n2 = pairPlayerMetaById.get(ph)?.name ?? "Player";
      const sorted = [n1, n2].sort((a, b) => a.localeCompare(b));
      const label = `${displayFirstName(sorted[0])} & ${displayFirstName(sorted[1])}`;
      return {
        player_low: pl,
        player_high: ph,
        label,
        championship_wins: row.championship_wins as number,
        sessions_played: (row.sessions_played as number) ?? 0,
      };
    }) ?? [];

  const pairLeaderboard = sortPairChampionship(pairLeaderboardRaw);

  const rosterByPlayerId = new Map<
    string,
    { name: string; username: string | null; avatar_url: string | null }
  >();
  for (const p of rosterDisplay) {
    if (p.id) {
      rosterByPlayerId.set(p.id, {
        name: p.name,
        username: p.username,
        avatar_url: p.avatar_url,
      });
    }
  }

  const currentPlayerIdForOverview =
    memberRowsEnriched.find((m) => m.user_id === user.id)?.player_id ?? null;

  const upcomingCandidates = (sessionRows ?? [])
    .filter((s) => String(s.status) !== "completed")
    .sort((a, b) => {
      const da = String(a.date);
      const db = String(b.date);
      if (da !== db) return da.localeCompare(db);
      const ca = String(a.created_at ?? "");
      const cb = String(b.created_at ?? "");
      if (ca !== cb) return ca.localeCompare(cb);
      return String(a.id).localeCompare(String(b.id));
    });

  let overviewNextSession: LeagueOverviewNextSessionPayload | null = null;

  if (upcomingCandidates.length > 0) {
    if (!currentPlayerIdForOverview) {
      overviewNextSession = { kind: "no_player" };
    } else {
      const upcomingIds = upcomingCandidates.map((s) => s.id as string);
      const { data: teamRowsForPlayer, error: overviewTeamsErr } = await supabase
        .from("session_teams")
        .select("session_id, player_a, player_b")
        .in("session_id", upcomingIds)
        .or(`player_a.eq.${currentPlayerIdForOverview},player_b.eq.${currentPlayerIdForOverview}`);

      if (overviewTeamsErr) {
        console.error(
          "league page overview session_teams",
          overviewTeamsErr.message,
          overviewTeamsErr,
        );
      }

      const pairedSessionIdToPartner = new Map<string, string>();
      for (const t of teamRowsForPlayer ?? []) {
        const sid = t.session_id as string;
        const pa = t.player_a as string;
        const pb = t.player_b as string;
        const partnerId = pa === currentPlayerIdForOverview ? pb : pa;
        if (!pairedSessionIdToPartner.has(sid)) pairedSessionIdToPartner.set(sid, partnerId);
      }

      let chosen: (typeof upcomingCandidates)[number] | null = null;
      let partnerId: string | null = null;
      for (const s of upcomingCandidates) {
        const sid = s.id as string;
        const p = pairedSessionIdToPartner.get(sid);
        if (p) {
          chosen = s;
          partnerId = p;
          break;
        }
      }

      if (chosen && partnerId) {
        const r = rosterDisplay.find((x) => x.id === partnerId);
        overviewNextSession = {
          kind: "session",
          sessionId: chosen.id as string,
          date: String(chosen.date),
          status: String(chosen.status),
          partner: {
            playerId: partnerId,
            name: r?.name?.trim() || "Player",
            username: r?.username ?? null,
            avatar_url: r?.avatar_url ?? null,
            isGuest: r ? r.isGuest : true,
            playstyle: r?.playstyle ?? null,
            skill: rosterSkillByPlayerId.get(partnerId) ?? DEFAULT_SKILL,
          },
        };
      } else {
        const first = upcomingCandidates[0];
        overviewNextSession = {
          kind: "session",
          sessionId: first.id as string,
          date: String(first.date),
          status: String(first.status),
          partner: null,
        };
      }
    }
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";
  const refCode = String(league.code ?? "").trim();
  const inviteUrl = refCode && origin ? `${origin}/join/${refCode}` : "";

  const { data: pendingJoinRows } = canAdmin
    ? await supabase
        .from("league_join_requests")
        .select(
          `
          id,
          users!league_join_requests_user_id_fkey ( name, username, avatar_url )
        `,
        )
        .eq("league_id", leagueId)
        .eq("status", "pending")
    : { data: null };

  const pendingJoinRequests =
    pendingJoinRows?.map((r) => {
      const u = r.users as unknown as {
        name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
      return {
        id: r.id as string,
        name: u?.name ?? null,
        username: u?.username ?? null,
        avatar_url: u?.avatar_url ?? null,
      };
    }) ?? [];

  const rosterSkillRecord = Object.fromEntries(rosterSkillByPlayerId);

  const lastCourtCount = (league as { last_court_count?: number | null }).last_court_count;
  const sessionWizardDefaultCourts =
    typeof lastCourtCount === "number" &&
    lastCourtCount >= MIN_SESSION_COURTS &&
    lastCourtCount <= MAX_SESSION_COURTS
      ? lastCourtCount
      : 4;

  const newSessionWizard =
    canAdmin
      ? {
          roster: rosterDisplay.map((r) => ({
            playerId: r.id,
            displayName: r.name.trim() || "Player",
            username: r.username,
            isGuest: r.isGuest,
          })),
          defaultCourts: sessionWizardDefaultCourts,
        }
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={league.name}
        description={
          <>
            <Badge variant="secondary" className="mr-2 align-middle">
              {formatDisplayName(String(league.format))}
            </Badge>
            <span className="text-muted-foreground">Reference code: </span>
            <span className="font-mono font-medium text-foreground">{league.code}</span>
          </>
        }
        actions={
          isOwner ? (
            <DeleteLeagueButton leagueId={leagueId} leagueName={league.name} />
          ) : null
        }
      />

      <LeaguePageTabs
        leagueId={leagueId}
        leagueName={String(league.name)}
        leagueFormatLabel={formatDisplayName(String(league.format))}
        memberCount={memberRows.length}
        viewerRoleLabel={viewerRoleLabel}
        leagueFormat={leagueFormat}
        currentUserId={user.id}
        leagueResultsMode={leagueResultsMode}
        playerLeaderboardSummitStyle={playerLeaderboardSummitStyle}
        canAdmin={canAdmin}
        isOwner={isOwner}
        inviteUrl={inviteUrl}
        refCode={refCode}
        pendingJoinRequests={pendingJoinRequests}
        membersNeedingLink={membersNeedingLink.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          name: m.name,
          username: m.username,
          avatar_url: m.avatar_url,
        }))}
        memberRows={memberRowsEnriched}
        rosterDisplay={rosterDisplay}
        rosterSkillByPlayerId={rosterSkillRecord}
        sessions={sessions}
        sessionsErr={sessionsErr ? { message: sessionsErr.message } : null}
        leaderboard={leaderboard}
        pairLeaderboard={pairLeaderboard}
        newSessionWizard={newSessionWizard}
        pairPlayerMetaById={Object.fromEntries(pairPlayerMetaById)}
        overviewNextSession={overviewNextSession}
      />
    </div>
  );
}
