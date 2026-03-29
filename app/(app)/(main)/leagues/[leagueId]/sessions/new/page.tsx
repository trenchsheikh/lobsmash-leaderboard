import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { BeginSessionWizardButton } from "@/components/begin-session-wizard-button";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function NewSessionPage({ params }: PageProps) {
  noStore();
  const { leagueId: leagueIdRaw } = await params;
  const leagueId = leagueIdRaw.trim().toLowerCase();
  const { supabase, user } = await requireOnboarded();

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("id, name")
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <PageHeader
        title="New session"
        description={
          <>
            Set up teams, courts, and results in{" "}
            <Link
              href={`/leagues/${leagueId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {league.name}
            </Link>
            . A draft is created only when you start the wizard—nothing is added just by opening this page.
          </>
        }
      />

      <BeginSessionWizardButton leagueId={leagueId} />

      <Link
        href={`/leagues/${leagueId}`}
        prefetch={false}
        className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
      >
        Cancel
      </Link>
    </div>
  );
}
