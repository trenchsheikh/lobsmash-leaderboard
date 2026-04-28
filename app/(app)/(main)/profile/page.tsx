import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
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
import { PageHeader } from "@/components/page-header";
import { ProfileEditSheet } from "@/components/profile-edit-sheet";
import { ProfileCoachVerifiedAttributes } from "@/components/profile-coach-verified-attributes";
import { ProfilePlaystyleRadarPanel } from "@/components/profile-playstyle-radar-panel";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { ProfileRatingPanel } from "@/components/profile-rating-panel";
import { ProfileVerificationSeal } from "@/components/profile-verification-seal";
import { DeleteProfileButton } from "@/components/delete-profile-button";
import { DEFAULT_SKILL } from "@/lib/rating";
import { cn } from "@/lib/utils";

const glassIdentity =
  "rounded-xl border border-border bg-card shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-card/90";

export default async function ProfilePage() {
  const { supabase, user } = await requireOnboarded();

  const { data: row } = await supabase
    .from("users")
    .select("name, username, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: player } = await supabase
    .from("players")
    .select(
      "id, play_styles, profile_attributes, preferred_side, experience_level, coach_verified_at, coach_verified_by_display_name, coach_verified_venue, coach_verified_attributes, coach_verified_attribute_notes",
    )
    .eq("user_id", user.id)
    .single();

  if (!row || !player) redirect("/onboarding");

  const { data: ratingRow } = await supabase
    .from("player_ratings")
    .select("skill, rated_games, updated_at")
    .eq("player_id", player.id)
    .maybeSingle();

  const { data: historyRows } = await supabase
    .from("player_rating_history")
    .select("recorded_at, skill, rated_games")
    .eq("player_id", player.id)
    .order("recorded_at", { ascending: true })
    .limit(500);

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    "—";

  const name = row.name?.trim() ?? "";
  const username = row.username?.trim() ?? null;
  const avatarUrl = row.avatar_url?.trim() ?? null;
  const playStyles = (player.play_styles as string[]) ?? [];
  const profileAttributes =
    (player.profile_attributes as Record<string, number> | null) ?? {};

  const defaults = {
    name,
    username: username ?? "",
    avatar_url: avatarUrl,
    playstyle: playStyles[0] ?? null,
    preferred_side: player.preferred_side,
    experience_level: player.experience_level,
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
    experience_level: player.experience_level,
  });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Profile"
        description="How you show up in leagues, draws, and on the friend leaderboard."
      />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div
          className={cn(
            glassIdentity,
            "flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5",
          )}
        >
          <UserAvatarDisplay
            name={name}
            username={username}
            avatarUrl={avatarUrl}
            size="lg"
            className="size-20 shrink-0 ring-2 ring-primary/20"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {name || "Your profile"}
              </h2>
              <ProfileVerificationSeal
                viewerIsSubject
                verified={Boolean(player.coach_verified_at)}
                verifiedAtIso={(player.coach_verified_at as string | null) ?? null}
                coachDisplayName={
                  (player.coach_verified_by_display_name as string | null) ?? null
                }
                venue={(player.coach_verified_venue as string | null) ?? null}
                size="md"
              />
            </div>
            {username ? (
              <p className="mt-1 font-mono text-lg text-foreground/80">@{username}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProfileEditSheet key={username ?? name} defaults={defaults} />
          <Link
            href="/verification"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            {player.coach_verified_at ? "Verification" : "Get coach verified"}
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Dashboard
          </Link>
        </div>
      </div>

      <ProfileRatingPanel
        effectiveSkill={effectiveSkill}
        ratedGames={ratedGames}
        history={ratingHistory}
        updatedAtIso={(ratingRow?.updated_at as string | null) ?? null}
      />

      <ProfilePlaystyleRadarPanel
        baseline={radarBaseline}
        playstyleLabel={labelForPlaystyle(playStyles[0] ?? null) || "—"}
        sideLabel={labelForSide(player.preferred_side) || "—"}
        experienceLabel={labelForExperience(player.experience_level) || "—"}
        strengths={playStyles}
        weaknesses={[]}
      />

      {player.coach_verified_at &&
      player.coach_verified_attributes &&
      typeof player.coach_verified_attributes === "object" ? (
        <ProfileCoachVerifiedAttributes
          scores={player.coach_verified_attributes as Record<string, number>}
          notes={(player.coach_verified_attribute_notes as Record<string, string> | null) ?? null}
          coachDisplayName={
            (player.coach_verified_by_display_name as string | null) ?? null
          }
          venue={(player.coach_verified_venue as string | null) ?? null}
          verifiedAtIso={player.coach_verified_at as string}
        />
      ) : null}

      <Card className="border-border/80 shadow-sm">
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

      <Card className="border-destructive/40 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-destructive">Delete profile</CardTitle>
          <CardDescription>
            Permanently remove your profile from this app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-start">
          <DeleteProfileButton />
        </CardContent>
      </Card>
    </div>
  );
}
