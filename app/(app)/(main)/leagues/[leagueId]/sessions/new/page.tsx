import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { createSessionDraft } from "@/app/actions/session-wizard";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { SessionCreateWizard } from "@/components/session-create-wizard";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

/** One draft insert per request (dedupes if React runs the tree twice in dev). */
const createDraftForNewSessionPage = cache(
  async (leagueId: string, date: string, numCourts: number) =>
    createSessionDraft(
      leagueId,
      {
        date,
        numCourts,
        inputMode: "full",
      },
      { revalidate: false },
    ),
);

export default async function NewSessionPage({ params }: PageProps) {
  const { leagueId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (lErr || !league) notFound();

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect(`/leagues/${leagueId}`);
  }

  const { data: rosterRows } = await supabase
    .from("league_players")
    .select(
      `
      player_id,
      players (
        id,
        name,
        user_id,
        users ( username )
      )
    `,
    )
    .eq("league_id", leagueId);

  const roster =
    rosterRows?.map((r) => {
      const p = r.players as unknown as {
        id: string;
        name: string;
        user_id: string | null;
        users: { username: string | null } | null;
      } | null;
      const un = p?.users?.username?.trim() ?? null;
      return {
        playerId: p?.id ?? (r.player_id as string),
        displayName: p?.name ?? "Player",
        username: un,
        isGuest: !p?.user_id,
      };
    }) ?? [];

  const lc = (league as { last_court_count?: number | null }).last_court_count;
  const defaultCourts =
    typeof lc === "number" && lc >= 1 && lc <= 12 ? lc : 4;

  const today = new Date().toISOString().slice(0, 10);
  const draftResult = await createDraftForNewSessionPage(leagueId, today, defaultCourts);

  if ("error" in draftResult && draftResult.error) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader title="New session" description="Could not create a draft session." />
        <p className="text-sm text-destructive">{draftResult.error}</p>
        <Link
          href={`/leagues/${leagueId}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
        >
          Back to league
        </Link>
      </div>
    );
  }

  const initialSessionId = draftResult.sessionId as string;

  after(() => {
    revalidatePath(`/leagues/${leagueId}`);
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <PageHeader
        title="New session"
        description={
          <>
            In{" "}
            <Link href={`/leagues/${leagueId}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {league.name}
            </Link>
          </>
        }
      />

      <SessionCreateWizard
        leagueId={leagueId}
        sessionId={initialSessionId}
        defaultCourts={defaultCourts}
        roster={roster}
      />

      <Link href={`/leagues/${leagueId}`} className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
        Cancel
      </Link>
    </div>
  );
}
