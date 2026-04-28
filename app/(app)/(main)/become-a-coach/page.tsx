import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import { BecomeCoachRequestForm } from "@/components/become-coach-request-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ExternalLink, Sparkles, TrendingUp, Users } from "lucide-react";

const furtherReading = [
  {
    label: "RSPA — Padel certification pathway (US-aligned)",
    href: "https://rspa.net/padel-certification/",
  },
  {
    label: "LTA — Padel Instructor qualification overview (UK)",
    href: "https://www.lta.org.uk/roles-and-venues/coaches/qualifications/lta-padel-coaching/",
  },
  {
    label: "How professional padel coaches evaluate player skills",
    href: "https://padel.tennistonic.com/padel-news/7401/how-professional-padel-coaches-evaluate-player-skills/",
  },
  {
    label: "Competency-based coaching: padel vs tennis",
    href: "https://padelandtennis.co.uk/blog/competency-based-coaching-padel-vs-tennis/",
  },
] as const;

export default async function BecomeACoachPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: coachRow } = await supabase
    .from("coach_profiles")
    .select(
      "bio, evidence_note, already_at_club, credential_document_path, identification_document_path",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Become a coach on LobSmash"
        description="Help players earn a coach-backed verification badge after a real session on court. You publish when and where you are available; players book you through LobSmash."
        actions={
          <Link href="/verification" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Verification hub
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">What happens next</CardTitle>
          <CardDescription>Four simple steps — no technical setup on your side.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="text-foreground">Apply to be listed.</span> Use the form at the bottom
              of this page: a short bio about your coaching, optional extra notes, and two uploads —
              proof of your coaching credentials and a photo or scan of your ID. Our team reviews
              every application before you can appear as an approved coach.
            </li>
            <li>
              <span className="text-foreground">Publish sessions.</span> On{" "}
              <Link
                href="/verification"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Verification
              </Link>
              , add venue, start time, and duration so players can book you.
            </li>
            <li>
              <span className="text-foreground">Meet on court,</span> watch them play, then complete
              the assessment in your coach inbox (the same six areas players self-rate: serve
              &amp; return, net game, power, consistency, movement, tactical IQ).
            </li>
            <li>
              <span className="text-foreground">Give clear feedback.</span> Short, specific notes
              tied to what you saw work best — the same idea competency-based padel coaching
              emphasizes elsewhere.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Why coach on LobSmash</CardTitle>
          <CardDescription>Built for trust and repeat bookings — not just a one-off rating.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <ul className="grid gap-4 sm:grid-cols-3">
            <li className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-4">
              <TrendingUp className="size-5 text-primary" aria-hidden />
              <span className="font-medium text-foreground">Potential earnings</span>
              <span>
                You agree session pricing with the player or your club outside the app today. LobSmash
                is where players find you and book the slot — so a strong profile and good reviews
                here can fill your diary faster.
              </span>
            </li>
            <li className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-4">
              <Users className="size-5 text-primary" aria-hidden />
              <span className="font-medium text-foreground">Coach-backed ratings</span>
              <span>
                Verified players show ratings that came from a real coach session, not only
                self-assessment. That badge helps serious players stand out — and they remember who
                verified them.
              </span>
            </li>
            <li className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-4">
              <Sparkles className="size-5 text-primary" aria-hidden />
              <span className="font-medium text-foreground">On-court, at a venue</span>
              <span>
                Verification is always live play at a padel club or venue. You need access to a
                court (for example through a club you coach at) so sessions are real and fair for
                everyone.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Padel coaching you should reflect</CardTitle>
          <CardDescription>
            Not a certification requirement for LobSmash — orientation for quality verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="text-foreground">Technique &amp; footwork</span> — bandeja/volley
              mechanics, recovery steps, balance in tight spaces.
            </li>
            <li>
              <span className="text-foreground">Tactics &amp; doubles teamwork</span> — court
              positioning, communication, anticipation, shot selection under pressure.
            </li>
            <li>
              <span className="text-foreground">Physical &amp; mental readiness</span> — endurance in
              long rallies, composure after errors.
            </li>
            <li>
              <span className="text-foreground">Consistency &amp; adaptability</span> — repeatable
              quality across match situations, not one-off highlights.
            </li>
          </ul>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
              Further reading
            </p>
            <ul className="flex flex-col gap-1.5">
              {furtherReading.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {item.label}
                    <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Request coach listing</CardTitle>
          <CardDescription>
            Tell us about your coaching and upload your documents. We only use this to review who can
            appear as an approved coach for bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BecomeCoachRequestForm
            initialBio={coachRow?.bio}
            initialEvidence={coachRow?.evidence_note}
            initialAlreadyAtClub={Boolean(coachRow?.already_at_club)}
            hasCredentialDocument={Boolean(coachRow?.credential_document_path)}
            hasIdentificationDocument={Boolean(coachRow?.identification_document_path)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
