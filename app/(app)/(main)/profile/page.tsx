import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import {
  labelForExperience,
  labelForPlaystyle,
  labelForSide,
  labelForStrength,
  labelForWeakness,
} from "@/lib/onboarding-options";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ProfileEditSheet } from "@/components/profile-edit-sheet";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { ProfileRatingPanel } from "@/components/profile-rating-panel";
import { DEFAULT_SKILL } from "@/lib/rating";

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
      "id, playstyle, strengths, weaknesses, preferred_side, experience_level",
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
  const strengths = (player.strengths as string[]) ?? [];
  const weaknesses = (player.weaknesses as string[]) ?? [];

  const defaults = {
    name,
    username: username ?? "",
    avatar_url: avatarUrl,
    playstyle: player.playstyle,
    preferred_side: player.preferred_side,
    experience_level: player.experience_level,
    strengths,
    weaknesses,
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

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Profile"
        description="How you show up in leagues, draws, and on the friend leaderboard."
      />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <UserAvatarDisplay
            name={name}
            username={username}
            avatarUrl={avatarUrl}
            size="lg"
            className="size-20 ring-2 ring-primary/20"
          />
          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {name || "Your profile"}
            </h2>
            {username ? (
              <p className="mt-1 font-mono text-lg text-muted-foreground">@{username}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProfileEditSheet key={username ?? name} defaults={defaults} />
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 lg:col-span-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Play style</CardTitle>
            <CardDescription>Your on-court identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Style
              </p>
              <p className="mt-1 text-base font-medium">
                {labelForPlaystyle(player.playstyle) || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preferred side
              </p>
              <p className="mt-1 text-base font-medium">
                {labelForSide(player.preferred_side) || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Experience
              </p>
              <p className="mt-1 text-base font-medium">
                {labelForExperience(player.experience_level) || "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Strengths & growth</CardTitle>
            <CardDescription>What you bring—and what you’re working on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Strengths
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {strengths.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  strengths.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {labelForStrength(s)}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Areas to grow
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {weaknesses.length === 0 ? (
                  <span className="text-sm text-muted-foreground">—</span>
                ) : (
                  weaknesses.map((w) => (
                    <Badge
                      key={w}
                      variant="outline"
                      className="border-amber-400/40 bg-amber-500/10 font-normal dark:border-amber-500/30"
                    >
                      {labelForWeakness(w)}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
