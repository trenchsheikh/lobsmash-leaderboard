import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Clock, Inbox, Link2, Sparkles, Trophy, UsersRound } from "lucide-react";
import { isSupabaseJwtExpired, requireOnboarded } from "@/lib/auth/profile";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { DashboardCreateLeagueSection } from "@/components/dashboard-create-league-section";
import { DashboardCreateTournamentSection } from "@/components/dashboard-create-tournament-section";
import { DashboardFriendlySessionSection } from "@/components/dashboard-friendly-session-section";
import type { PendingFriendlyRequestRow } from "@/components/pending-friendly-join-requests-list";
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
import { CancelOpenSessionButton } from "@/components/cancel-open-session-button";
import { CopyTextButton } from "@/components/copy-text-button";
import { formatDisplayName } from "@/lib/league-format";

const glassCard =
  "border border-border bg-card shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-card/90";

/** Shown in Leagues & open sessions when the host did not set a title */
const OPEN_MATCH_LABEL = "Open Match";

/** Always fetch fresh DB rows (open sessions must appear right after create). */
export const dynamic = "force-dynamic";

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

type OpenSessionRole = "host" | "participant" | "pending_join";

type OpenSessionRow = {
  kind: "open_session";
  sessionId: string;
  inviteToken: string;
  sortName: string;
  title: string | null;
  capacity: number;
  startsAt: string | null;
  matchKind: string;
  createdAt: string;
  openRole: OpenSessionRole;
};

type UnifiedRow = MemberRow | PendingRow | OpenSessionRow;

function unifiedSortKey(row: UnifiedRow): string {
  if (row.kind === "open_session") return row.sortName.toLowerCase();
  return row.name.toLowerCase();
}

export default async function DashboardPage() {
  noStore();
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

  // RLS returns sessions you can see (creator, roster, or join request). Classify host vs participant vs pending join.
  const { data: visibleOpenSessions, error: friendlySessionsErr } = await supabase
    .from("friendly_sessions")
    .select(
      "id, invite_token, capacity, title, starts_at, status, match_kind, creator_user_id, created_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (friendlySessionsErr) {
    if (isSupabaseJwtExpired(friendlySessionsErr)) {
      redirect("/login");
    }
    console.error("[dashboard] friendly_sessions:", friendlySessionsErr.message);
  }

  const visible = visibleOpenSessions ?? [];
  const nonHostIds = visible
    .filter((s) => (s.creator_user_id as string) !== user.id)
    .map((s) => s.id as string);

  const rosterSessionIds = new Set<string>();
  const pendingJoinSessionIds = new Set<string>();
  if (nonHostIds.length > 0) {
    const { data: rosterRows } = await supabase
      .from("friendly_session_roster")
      .select("session_id")
      .eq("user_id", user.id)
      .in("session_id", nonHostIds);
    for (const r of rosterRows ?? []) {
      rosterSessionIds.add(r.session_id as string);
    }

    const { data: pendingRows } = await supabase
      .from("friendly_session_join_requests")
      .select("session_id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("session_id", nonHostIds);
    for (const r of pendingRows ?? []) {
      pendingJoinSessionIds.add(r.session_id as string);
    }
  }

  function openRoleForSession(s: (typeof visible)[0]): OpenSessionRole | null {
    if ((s.creator_user_id as string) === user.id) return "host";
    const sid = s.id as string;
    if (rosterSessionIds.has(sid)) return "participant";
    if (pendingJoinSessionIds.has(sid)) return "pending_join";
    return null;
  }

  const openSessionRows: OpenSessionRow[] = visible.flatMap((s) => {
    const openRole = openRoleForSession(s);
    if (!openRole) return [];
    const display = s.title?.trim() || OPEN_MATCH_LABEL;
    return [
      {
        kind: "open_session" as const,
        sessionId: s.id as string,
        inviteToken: s.invite_token as string,
        sortName: display,
        title: s.title,
        capacity: s.capacity as number,
        startsAt: s.starts_at as string | null,
        matchKind: (s.match_kind as string) ?? "friendly",
        createdAt: (s.created_at as string) ?? "",
        openRole,
      },
    ];
  });

  const leagueRowsSorted = [...memberRows, ...pendingRows].sort((a, b) =>
    unifiedSortKey(a).localeCompare(unifiedSortKey(b)),
  );
  const openSessionsSorted = [...openSessionRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  /** Hosted open matches first (newest first), then leagues A–Z */
  const unifiedRows: UnifiedRow[] = [...openSessionsSorted, ...leagueRowsSorted];

  const hostedSessionIds = visible
    .filter((s) => (s.creator_user_id as string) === user.id)
    .map((s) => s.id as string);

  let friendlyPendingRows: PendingFriendlyRequestRow[] = [];
  if (hostedSessionIds.length > 0) {
    const { data: fq } = await supabase
      .from("friendly_session_join_requests")
      .select(
        `
        id,
        session_id,
        friendly_sessions ( title ),
        users ( name, username, avatar_url )
      `,
      )
      .in("session_id", hostedSessionIds)
      .eq("status", "pending");

    friendlyPendingRows =
      fq?.map((row) => {
        const fs = row.friendly_sessions as unknown as { title: string | null } | null;
        const u = row.users as unknown as {
          name: string | null;
          username: string | null;
          avatar_url: string | null;
        } | null;
        return {
          id: row.id as string,
          sessionId: row.session_id as string,
          sessionTitle: fs?.title ?? null,
          name: u?.name ?? null,
          username: u?.username ?? null,
          avatar_url: u?.avatar_url ?? null,
        };
      }) ?? [];
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Dashboard"
        description="Ratings and stats for players and clubs—run a league or spin up an open session; league matches stay under each league."
      />

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-6">
          <DashboardCreateLeagueSection />
          <DashboardCreateTournamentSection />
          <DashboardFriendlySessionSection pendingRequests={friendlyPendingRows} />
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
            <CardTitle>Leagues &amp; open sessions</CardTitle>
            <CardDescription className="text-foreground/80">
              Open matches you host, are in, or are waiting to join (friendly or competitive) appear at the top;
              then leagues and pending league joins, A–Z. Use View to open the lobby.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === "development" && friendlySessionsErr ? (
            <p
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              Could not load open sessions: {friendlySessionsErr.message}
            </p>
          ) : null}
          {unifiedRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/25 py-12 text-center backdrop-blur-sm">
              <Inbox className="size-10 text-muted-foreground/70" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                Nothing here yet. Create a league or an open session above, or request to join a league with an
                invite link or code.
              </p>
            </div>
          ) : (
            <>
              <ul
                className="flex flex-col gap-3 md:hidden"
                aria-label="Leagues and open sessions"
              >
                {unifiedRows.map((row) =>
                  row.kind === "member" ? (
                    <li
                      key={`m-${row.leagueId}`}
                      className={cn("rounded-2xl p-4", glassCard)}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <Trophy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-heading text-base font-semibold leading-tight">{row.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="font-normal">
                                  League
                                </Badge>
                                <Badge variant="outline" className="font-normal">
                                  {formatDisplayName(row.format)}
                                </Badge>
                              </div>
                            </div>
                            <p className="font-mono text-sm text-muted-foreground">{row.code}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                          <span className="text-sm capitalize text-muted-foreground">{row.role}</span>
                          <Link
                            href={`/leagues/${row.leagueId}`}
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                          >
                            View league
                          </Link>
                        </div>
                      </div>
                    </li>
                  ) : row.kind === "pending" ? (
                    <li
                      key={`p-${row.requestId}`}
                      className={cn("rounded-2xl p-4", glassCard)}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600/90 dark:text-amber-400/90" aria-hidden />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-heading text-base font-semibold leading-tight">{row.name}</p>
                              <Badge variant="secondary" className="font-normal">
                                {formatDisplayName(row.format)}
                              </Badge>
                            </div>
                            <p className="font-mono text-sm text-muted-foreground">{row.code}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                          <Badge variant="outline" className="font-normal">
                            Join requested
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
                  ) : (
                    <li
                      key={`o-${row.sessionId}`}
                      className={cn(
                        "rounded-2xl border p-4 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg",
                        row.matchKind === "competitive"
                          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/[0.12] via-card/80 to-card dark:border-amber-400/30 dark:from-amber-500/[0.08] dark:to-card/90"
                          : "border-primary/35 bg-gradient-to-br from-primary/[0.12] via-card/80 to-card dark:border-primary/25 dark:from-primary/[0.08] dark:to-card/90",
                      )}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          {row.matchKind === "competitive" ? (
                            <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                          ) : (
                            <UsersRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  Open match
                                </p>
                                <p className="font-heading text-base font-semibold leading-tight text-foreground">
                                  {row.title?.trim() || OPEN_MATCH_LABEL}
                                </p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <Badge
                                  variant={row.matchKind === "competitive" ? "default" : "secondary"}
                                  className="font-normal shadow-sm"
                                >
                                  {row.matchKind === "competitive" ? "Competitive" : "Friendly"}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {row.capacity} players (2v2)
                              {row.startsAt
                                ? ` · ${new Date(row.startsAt).toLocaleString(undefined, {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {row.openRole === "host"
                              ? "You host"
                              : row.openRole === "participant"
                                ? "In lobby"
                                : "Awaiting host"}
                          </span>
                          <div className="flex flex-wrap justify-end gap-2">
                            {row.openRole === "host" ? (
                              <CopyTextButton
                                text={`${origin}/friendly/invite/${row.inviteToken}`}
                                label="Copy invite"
                                size="sm"
                                variant="outline"
                              />
                            ) : null}
                            <Link
                              href={`/friendly/${row.sessionId}`}
                              className={buttonVariants({ size: "sm", variant: "default" })}
                            >
                              View lobby
                            </Link>
                            {row.openRole === "host" ? (
                              <CancelOpenSessionButton sessionId={row.sessionId} />
                            ) : null}
                          </div>
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
                      <TableHead>Type</TableHead>
                      <TableHead>Code / schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unifiedRows.map((row) =>
                      row.kind === "member" ? (
                        <TableRow key={`m-${row.leagueId}`}>
                          <TableCell className="font-medium">
                            <div className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2">
                              <Trophy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="truncate">{row.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="secondary" className="font-normal">
                                League
                              </Badge>
                              <Badge variant="outline" className="font-normal">
                                {formatDisplayName(row.format)}
                              </Badge>
                            </div>
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
                      ) : row.kind === "pending" ? (
                        <TableRow key={`p-${row.requestId}`}>
                          <TableCell className="font-medium">
                            <div className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2">
                              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="truncate">{row.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="secondary" className="font-normal">
                                League
                              </Badge>
                              <Badge variant="outline" className="font-normal">
                                {formatDisplayName(row.format)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.code}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              Join requested
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
                      ) : (
                        <TableRow
                          key={`o-${row.sessionId}`}
                          className={cn(
                            "border-l-4 transition-colors",
                            row.matchKind === "competitive"
                              ? "border-l-amber-500/70 hover:bg-amber-500/[0.06] dark:hover:bg-amber-500/10"
                              : "border-l-primary/70 hover:bg-primary/[0.06] dark:hover:bg-primary/10",
                          )}
                        >
                          <TableCell className="font-medium">
                            <div className="flex min-w-0 max-w-[min(100%,16rem)] flex-col gap-0.5">
                              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Open match
                              </span>
                              <div className="flex min-w-0 items-center gap-2">
                                {row.matchKind === "competitive" ? (
                                  <Sparkles className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                                ) : (
                                  <UsersRound className="size-4 shrink-0 text-primary" aria-hidden />
                                )}
                                <span className="truncate text-foreground">
                                  {row.title?.trim() || OPEN_MATCH_LABEL}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.matchKind === "competitive" ? "default" : "secondary"}
                              className="font-normal shadow-sm"
                            >
                              {row.matchKind === "competitive" ? "Competitive" : "Friendly"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{row.capacity} players · 2v2</div>
                            {row.startsAt ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(row.startsAt).toLocaleString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            ) : (
                              <div className="mt-0.5 text-xs text-muted-foreground">No start time set</div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-muted-foreground">
                            {row.openRole === "host"
                              ? "You host"
                              : row.openRole === "participant"
                                ? "In lobby"
                                : "Awaiting host"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {row.openRole === "host" ? (
                                <CopyTextButton
                                  text={`${origin}/friendly/invite/${row.inviteToken}`}
                                  label="Copy invite"
                                  size="sm"
                                  variant="outline"
                                />
                              ) : null}
                              <Link
                                href={`/friendly/${row.sessionId}`}
                                className={buttonVariants({ size: "sm", variant: "default" })}
                              >
                                View lobby
                              </Link>
                              {row.openRole === "host" ? (
                                <CancelOpenSessionButton sessionId={row.sessionId} />
                              ) : null}
                            </div>
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
