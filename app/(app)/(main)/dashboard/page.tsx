import Link from "next/link";
import { Inbox, Link2 } from "lucide-react";
import { requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { DashboardCreateLeagueSection } from "@/components/dashboard-create-league-section";
import { DashboardCreateTournamentSection } from "@/components/dashboard-create-tournament-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JoinLeagueForm } from "@/components/join-league-form";
import { PasteInviteLinkForm } from "@/components/paste-invite-link-form";
import { formatDisplayName } from "@/lib/league-format";

const glassCard =
  "border border-border bg-card shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-card/90";

type MemberRow = {
  kind: "member";
  leagueId: string;
  name: string;
  format: string;
  code: string;
  role: string;
};

type PendingRow = {
  kind: "pending";
  requestId: string;
  leagueId: string;
  name: string;
  format: string;
  code: string;
};

export default async function DashboardPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: leagues } = await supabase
    .from("league_members")
    .select(
      `
      role,
      leagues (
        id,
        name,
        format,
        code,
        created_at
      )
    `,
    )
    .eq("user_id", user.id);

  const memberRows: MemberRow[] =
    leagues
      ?.map((row) => {
        const league = row.leagues as unknown as {
          id: string;
          name: string;
          format: string;
          code: string;
          created_at: string;
        } | null;
        if (!league) return null;
        return {
          kind: "member" as const,
          leagueId: league.id,
          name: league.name,
          format: league.format,
          code: league.code,
          role: row.role as string,
        };
      })
      .filter((r): r is MemberRow => r != null) ?? [];

  const { data: pendingJoin } = await supabase
    .from("league_join_requests")
    .select(
      `
      id,
      leagues (
        id,
        name,
        format,
        code
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("status", "pending");

  const pendingRows: PendingRow[] =
    pendingJoin
      ?.map((row) => {
        const league = row.leagues as unknown as {
          id: string;
          name: string;
          format: string;
          code: string;
        } | null;
        if (!league?.code) return null;
        return {
          kind: "pending" as const,
          requestId: row.id as string,
          leagueId: league.id,
          name: league.name,
          format: league.format,
          code: league.code,
        };
      })
      .filter((r): r is PendingRow => r != null) ?? [];

  const tableRows: (MemberRow | PendingRow)[] = [...memberRows, ...pendingRows].sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Dashboard"
        description="Run your padel league or club: create a league, join with a code, and follow the season."
      />

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-6">
          <DashboardCreateLeagueSection />
          <DashboardCreateTournamentSection />
        </div>
        <Card className={glassCard}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="size-5 text-primary" aria-hidden />
              Join a league
            </CardTitle>
            <CardDescription className="text-pretty text-foreground/85">
              Paste an invite link or enter the 8-character league code. Every join is a request—
              organisers approve before you are added.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <PasteInviteLinkForm />
            <JoinLeagueForm />
          </CardContent>
        </Card>
      </div>

      <Card className={glassCard}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>My leagues</CardTitle>
            <CardDescription className="text-foreground/80">
              Memberships and pending join requests.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/25 py-12 text-center backdrop-blur-sm">
              <Inbox className="size-10 text-muted-foreground/70" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                No leagues yet. Create one or request to join with an invite link or code above.
              </p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3 md:hidden" aria-label="My leagues">
                {tableRows.map((row) =>
                  row.kind === "member" ? (
                    <li
                      key={`m-${row.leagueId}`}
                      className={cn(
                        "rounded-2xl p-4",
                        glassCard,
                      )}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-heading text-base font-semibold leading-tight">{row.name}</p>
                          <Badge variant="secondary">{formatDisplayName(row.format)}</Badge>
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">{row.code}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                          <span className="text-sm capitalize text-muted-foreground">{row.role}</span>
                          <Link
                            href={`/leagues/${row.leagueId}`}
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={`p-${row.requestId}`}
                      className={cn(
                        "rounded-2xl p-4",
                        glassCard,
                      )}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-heading text-base font-semibold leading-tight">{row.name}</p>
                          <Badge variant="secondary">{formatDisplayName(row.format)}</Badge>
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">{row.code}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                          <Badge variant="outline" className="font-normal">
                            Requested
                          </Badge>
                          <Link
                            href={`/join/${row.code}`}
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                          >
                            Invite page
                          </Link>
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ul>

              <div className="hidden max-h-[min(60vh,36rem)] w-full overflow-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) =>
                      row.kind === "member" ? (
                        <TableRow key={`m-${row.leagueId}`}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{formatDisplayName(row.format)}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.code}</TableCell>
                          <TableCell className="capitalize">{row.role}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/leagues/${row.leagueId}`}
                              className={buttonVariants({ size: "sm", variant: "outline" })}
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={`p-${row.requestId}`}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{formatDisplayName(row.format)}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.code}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              Requested
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/join/${row.code}`}
                              className={buttonVariants({ size: "sm", variant: "outline" })}
                            >
                              Invite page
                            </Link>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
