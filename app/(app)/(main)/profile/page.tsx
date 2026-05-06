import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  labelForExperience,
  labelForPlaystyle,
  labelForSide,
} from "@/lib/onboarding-options";
import { computeRadarFromProfile } from "@/lib/player-radar-scores";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileCoachVerifiedAttributes } from "@/components/profile-coach-verified-attributes";
import { ProfilePlaystyleRadarPanel } from "@/components/profile-playstyle-radar-panel";
import { ProfileRatingPanel } from "@/components/profile-rating-panel";
import { ProfileRankHero } from "@/components/profile-rank-hero";
import { ProfileTabs } from "@/components/profile-tabs";
import { ProfileMomentumCard } from "@/components/profile-momentum-card";
import { ProfileBestPartnerCard } from "@/components/profile-best-partner-card";
import { ProfileActiveRivalCard } from "@/components/profile-active-rival-card";
import { DeleteProfileButton } from "@/components/delete-profile-button";
import { DEFAULT_SKILL, formatDisplayLevel, skillToDisplayLevel } from "@/lib/rating";
import { profileCardShell } from "@/lib/profile-styles";
import { nowMs } from "@/lib/server-time";
import { cn } from "@/lib/utils";

const SHOT_ROWS: Array<{
  key: "consistency" | "netPlay" | "offense" | "wallsLobs" | "defense";
  label: string;
  tone: string;
}> = [
  { key: "consistency", label: "Consistency", tone: "bg-chart-2" },
  { key: "netPlay", label: "Net play", tone: "bg-chart-2" },
  { key: "offense", label: "Vibora", tone: "bg-chart-2" },
  { key: "wallsLobs", label: "Def. lob", tone: "bg-amber-500" },
  { key: "defense", label: "Defense", tone: "bg-slate-400" },
];

type ProfilePlayerRow = {
  id: string;
  play_styles: unknown;
  profile_attributes: unknown;
  preferred_side: string | null;
  experience_level: string | null;
  coach_verified_at: string | null;
  coach_verified_by_display_name?: string | null;
  coach_verified_venue?: string | null;
  coach_verified_attributes?: Record<string, number> | null;
  coach_verified_attribute_notes?: Record<string, string> | null;
};

type RecentFormRow = {
  played_at: string;
  won: boolean;
  opponent_ids: string[] | null;
};

type PartnerRow = {
  partner_id: string;
  wins: number;
  losses: number;
  games_played: number;
  current_streak: number;
  last_played_at: string | null;
};

type RivalRow = {
  rival_id: string;
  wins_for_player: number;
  losses_for_player: number;
  games_played: number;
  current_streak: number;
  last_meeting_at: string | null;
};

/** Walk back from the most recent form row counting consecutive same results. */
function deriveCurrentStreak(form: Array<{ won: boolean }>): number {
  if (form.length === 0) return 0;
  const latestWon = form[0].won;
  let count = 0;
  for (const row of form) {
    if (row.won === latestWon) count += 1;
    else break;
  }
  return latestWon ? count : -count;
}

export default async function ProfilePage() {
  const { supabase, user } = await requireOnboarded();

  const { data: row } = await supabase
    .from("users")
    .select("name, username, avatar_url")
    .eq("id", user.id)
    .single();

  let player: ProfilePlayerRow | null = null;

  {
    const extendedSelect =
      "id, play_styles, profile_attributes, preferred_side, experience_level, " +
      "coach_verified_at, coach_verified_by_display_name, coach_verified_venue, " +
      "coach_verified_attributes, coach_verified_attribute_notes";
    const baseSelect =
      "id, play_styles, profile_attributes, preferred_side, experience_level, coach_verified_at";

    const { data: extendedRow, error: extendedErr } = await supabase
      .from("players")
      .select(extendedSelect)
      .eq("user_id", user.id)
      .single();

    if (!extendedErr) {
      player = extendedRow as unknown as ProfilePlayerRow;
    } else {
      // Backward-compatible fallback if hosted DB is missing new verification columns.
      const { data: baseRow } = await supabase
        .from("players")
        .select(baseSelect)
        .eq("user_id", user.id)
        .single();
      player = baseRow as unknown as ProfilePlayerRow;
    }
  }

  if (!row || !player) redirect("/onboarding");
  const playerRow = player;

  const [
    { data: ratingRow },
    { data: historyRows },
    { data: partnerRow },
    { data: rivalRow },
    { data: recentFormRows },
  ] = await Promise.all([
    supabase
      .from("player_ratings")
      .select("skill, rated_games, updated_at")
      .eq("player_id", playerRow.id)
      .maybeSingle(),
    supabase
      .from("player_rating_history")
      .select("recorded_at, skill, rated_games")
      .eq("player_id", playerRow.id)
      .order("recorded_at", { ascending: true })
      .limit(500),
    supabase
      .from("player_partner_stats")
      .select("partner_id, wins, losses, games_played, current_streak, last_played_at")
      .eq("player_id", playerRow.id)
      .gte("games_played", 4)
      .order("wins", { ascending: false })
      .order("games_played", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("player_rival_stats")
      .select(
        "rival_id, wins_for_player, losses_for_player, games_played, current_streak, last_meeting_at",
      )
      .eq("player_id", playerRow.id)
      .gte("games_played", 3)
      .order("losses_for_player", { ascending: false })
      .order("games_played", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("player_recent_form_v")
      .select("played_at, won, opponent_ids")
      .eq("player_id", playerRow.id)
      .order("played_at", { ascending: false })
      .limit(20),
  ]);

  const partner = (partnerRow as PartnerRow | null) ?? null;
  const rival = (rivalRow as RivalRow | null) ?? null;
  const recentForm = (recentFormRows as RecentFormRow[] | null) ?? [];

  // Resolve partner/rival -> name + avatar in one batched query.
  const otherPlayerIds = [partner?.partner_id, rival?.rival_id].filter(
    (id): id is string => Boolean(id),
  );
  type PlayerLookup = {
    id: string;
    name: string | null;
    user_id: string | null;
    users: { name: string | null; username: string | null; avatar_url: string | null } | null;
  };
  let lookupRows: PlayerLookup[] = [];
  if (otherPlayerIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select("id, name, user_id, users ( name, username, avatar_url )")
      .in("id", otherPlayerIds);
    lookupRows = (data as unknown as PlayerLookup[] | null) ?? [];
  }
  const lookupById = new Map(lookupRows.map((r) => [r.id, r]));

  function resolvePlayer(id: string | undefined | null) {
    if (!id) return null;
    const row = lookupById.get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.users?.name ?? row.name ?? null,
      username: row.users?.username ?? null,
      avatarUrl: row.users?.avatar_url ?? null,
    };
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    "—";

  const name = row.name?.trim() ?? "";
  const username = row.username?.trim() ?? null;
  const avatarUrl = row.avatar_url?.trim() ?? null;
  const playStyles = (playerRow.play_styles as string[]) ?? [];
  const profileAttributes =
    (playerRow.profile_attributes as Record<string, number> | null) ?? {};

  const defaults = {
    name,
    username: username ?? "",
    avatar_url: avatarUrl,
    playstyle: playStyles[0] ?? null,
    preferred_side: playerRow.preferred_side,
    experience_level: playerRow.experience_level,
    strengths: playStyles,
    weaknesses: [],
  };

  const effectiveSkill =
    typeof ratingRow?.skill === "number" && Number.isFinite(ratingRow.skill)
      ? ratingRow.skill
      : DEFAULT_SKILL;
  const ratedGames =
    typeof ratingRow?.rated_games === "number" && ratingRow.rated_games >= 0
      ? ratingRow.rated_games
      : 0;
  const ratingHistory = (historyRows ?? []).map((h) => ({
    recorded_at: h.recorded_at as string,
    skill: h.skill as number,
    rated_games: h.rated_games as number,
  }));

  const radarBaseline = computeRadarFromProfile({
    play_styles: playStyles,
    profile_attributes: profileAttributes,
    experience_level: playerRow.experience_level,
  });

  // Hero data derivations.
  const formForHero = recentForm.slice(0, 10).map((r) => ({
    played_at: r.played_at,
    won: r.won,
  }));
  const last30Cutoff = nowMs() - 30 * 24 * 60 * 60 * 1000;
  const last30 = ratingHistory.filter(
    (h) => new Date(h.recorded_at).getTime() >= last30Cutoff,
  );
  // Delta is expressed in display-level units (0-7) to match the hero's big
  // number, which now shows the level (e.g. 4.62 +0.08).
  const deltaEndpoints =
    last30.length >= 2
      ? [last30[0].skill, last30[last30.length - 1].skill]
      : ratingHistory.length >= 2
        ? [ratingHistory[0].skill, ratingHistory[ratingHistory.length - 1].skill]
        : null;
  const ratingDelta30d = deltaEndpoints
    ? skillToDisplayLevel(deltaEndpoints[1]) - skillToDisplayLevel(deltaEndpoints[0])
    : 0;
  const currentStreak = deriveCurrentStreak(formForHero);

  // Mastery: shot bar derivations (kept from prior design).
  const recentSnapshots = ratingHistory
    .slice(-4)
    .reverse()
    .map((rowItem, idx, list) => {
      const baseline = list[idx + 1]?.skill ?? rowItem.skill;
      return {
        recordedAt: rowItem.recorded_at,
        level: formatDisplayLevel(rowItem.skill),
        delta: Math.round(rowItem.skill - baseline),
      };
    });

  // Rival recent H2H derived from recent form rows.
  const recentH2H = rival
    ? recentForm
        .filter((r) => Array.isArray(r.opponent_ids) && r.opponent_ids?.includes(rival.rival_id))
        .slice(0, 8)
        .map((r) => ({ played_at: r.played_at, won: r.won }))
    : [];

  const partnerResolved = resolvePlayer(partner?.partner_id);
  const rivalResolved = resolvePlayer(rival?.rival_id);

  const partnerCardData = partner && partnerResolved
    ? {
        id: partnerResolved.id,
        name: partnerResolved.name,
        username: partnerResolved.username,
        avatarUrl: partnerResolved.avatarUrl,
        wins: partner.wins,
        losses: partner.losses,
        gamesPlayed: partner.games_played,
        currentStreak: partner.current_streak,
        lastPlayedAt: partner.last_played_at,
      }
    : null;

  const rivalCardData = rival && rivalResolved
    ? {
        id: rivalResolved.id,
        name: rivalResolved.name,
        username: rivalResolved.username,
        avatarUrl: rivalResolved.avatarUrl,
        winsForPlayer: rival.wins_for_player,
        lossesForPlayer: rival.losses_for_player,
        gamesPlayed: rival.games_played,
        currentStreak: rival.current_streak,
        lastMeetingAt: rival.last_meeting_at,
        recentH2H,
      }
    : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-1 sm:max-w-6xl sm:gap-5 sm:px-0">
        <ProfileRankHero
          name={name}
          username={username}
          avatarUrl={avatarUrl}
          verified={Boolean(playerRow.coach_verified_at)}
          verifiedAtIso={(playerRow.coach_verified_at as string | null) ?? null}
          coachDisplayName={
            (playerRow.coach_verified_by_display_name as string | null) ?? null
          }
          coachVenue={(playerRow.coach_verified_venue as string | null) ?? null}
          skill={effectiveSkill}
          ratedGames={ratedGames}
          ratingDelta={ratingDelta30d}
          formResults={formForHero}
          editDefaults={defaults}
        />

        <ProfileTabs
          overview={
            <>
              <ProfileMomentumCard history={ratingHistory} currentStreak={currentStreak} />
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                <ProfileBestPartnerCard partner={partnerCardData} />
                <ProfileActiveRivalCard rival={rivalCardData} />
              </div>
            </>
          }
          mastery={
            <>
              <ProfilePlaystyleRadarPanel
                baseline={radarBaseline}
                playstyleLabel={labelForPlaystyle(playStyles[0] ?? null) || "—"}
                sideLabel={labelForSide(playerRow.preferred_side) || "—"}
                experienceLabel={labelForExperience(playerRow.experience_level) || "—"}
                strengths={playStyles}
                weaknesses={[]}
              />
              <Card className={profileCardShell}>
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
                    Shots
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-5">
                  {SHOT_ROWS.map((shotRow) => {
                    const value = Math.max(
                      0,
                      Math.min(100, Math.round(radarBaseline[shotRow.key] ?? 0)),
                    );
                    return (
                      <div
                        key={shotRow.key}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
                      >
                        <span className="text-sm text-foreground/90">{shotRow.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", shotRow.tone)}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              {playerRow.coach_verified_at &&
              playerRow.coach_verified_attributes &&
              typeof playerRow.coach_verified_attributes === "object" ? (
                <ProfileCoachVerifiedAttributes
                  scores={playerRow.coach_verified_attributes as Record<string, number>}
                  notes={
                    (playerRow.coach_verified_attribute_notes as
                      | Record<string, string>
                      | null) ?? null
                  }
                  coachDisplayName={
                    (playerRow.coach_verified_by_display_name as string | null) ?? null
                  }
                  venue={(playerRow.coach_verified_venue as string | null) ?? null}
                  verifiedAtIso={playerRow.coach_verified_at as string}
                />
              ) : null}
            </>
          }
          recap={
            <>
              <ProfileRatingPanel
                effectiveSkill={effectiveSkill}
                ratedGames={ratedGames}
                history={ratingHistory}
                updatedAtIso={(ratingRow?.updated_at as string | null) ?? null}
              />
              {recentSnapshots.length > 0 ? (
                <Card className={profileCardShell}>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
                      Recent updates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    {recentSnapshots.map((item) => (
                      <div
                        key={item.recordedAt}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border/50 bg-muted/15 px-3 py-2"
                      >
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.recordedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-foreground">Level {item.level}</p>
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            item.delta > 0
                              ? "text-chart-2"
                              : item.delta < 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground",
                          )}
                        >
                          {item.delta > 0 ? "+" : ""}
                          {item.delta}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          }
        />

        {/* Account + danger zone live outside the tabs so they're always pinned
            at the very bottom of the profile page regardless of which tab the
            user is viewing. The hairline divider + extra top spacing make it
            visually clear this is a separate footer area, not part of any tab. */}
        <section
          aria-label="Account settings"
          className="mt-6 grid gap-3 border-t border-border/60 pt-6 sm:mt-10 sm:gap-4 sm:pt-8 lg:grid-cols-2"
        >
          <Card className={profileCardShell}>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Account</CardTitle>
              <CardDescription>Managed by your sign-in provider.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-[120px_1fr] sm:gap-x-4">
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 font-mono text-sm">
                  {email}
                </dd>
              </dl>
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] border-destructive/35 bg-card/90 shadow-md backdrop-blur-xl sm:rounded-2xl sm:shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg text-destructive">
                Delete profile
              </CardTitle>
              <CardDescription>
                Permanently remove your profile from this app.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-start">
              <DeleteProfileButton />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
