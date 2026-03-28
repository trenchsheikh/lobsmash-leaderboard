import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
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
import { DeleteGameButton } from "@/components/delete-game-button";
import { CompleteSessionButton } from "@/components/complete-session-button";

type PageProps = {
  params: Promise<{ leagueId: string; sessionId: string }>;
};

type PlayerRow = {
  id: string;
  name: string;
  user_id: string | null;
  users: { username: string | null } | null;
};

export default async function SessionPage({ params }: PageProps) {
  const { leagueId, sessionId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, format")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) notFound();

  const { data: membership } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const canAdmin =
    membership.role === "owner" || membership.role === "admin";

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session || session.league_id !== leagueId) notFound();

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("session_id", sessionId)
    .order("court_number", { ascending: true });

  const playerIds = new Set<string>();
  for (const g of games ?? []) {
    for (const id of (g.team_a_players as string[]) ?? []) playerIds.add(id);
    for (const id of (g.team_b_players as string[]) ?? []) playerIds.add(id);
  }

  const { data: nameRows } =
    playerIds.size > 0
      ? await supabase
          .from("players")
          .select("id, name, user_id, users ( username )")
          .in("id", [...playerIds])
      : { data: [] as PlayerRow[] };

  const playerById = new Map(
    (nameRows ?? []).map((p) => [p.id, p as PlayerRow]),
  );

  function formatTeam(ids: string[]) {
    return ids
      .map((id) => {
        const p = playerById.get(id);
        if (!p) return id.slice(0, 8);
        const un = p.users?.username?.trim();
        if (un) return `@${un}`;
        return p.name;
      })
      .join(" · ");
  }

  const isDraft = session.status === "draft";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Session · ${session.date}`}
        description={
          <>
            <Link href={`/leagues/${leagueId}`} className="hover:underline">
              {league.name}
            </Link>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <Badge variant="outline" className="align-middle capitalize">
              {session.status}
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground">
              {(session.num_courts as number) ?? "—"} courts · {session.input_mode ?? "—"}
            </span>
          </>
        }
        actions={
          <Link href={`/leagues/${leagueId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to league
          </Link>
        }
      />

      {canAdmin && isDraft ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Finalize session</CardTitle>
            <CardDescription>
              Save games from the session wizard first. When results are correct, mark the session
              complete to update the leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompleteSessionButton leagueId={leagueId} sessionId={sessionId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Games</CardTitle>
          <CardDescription>Courts, teams, and results for this session.</CardDescription>
        </CardHeader>
        <CardContent>
          {!games?.length ? (
            <p className="text-sm text-muted-foreground">No games logged yet.</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Court</TableHead>
                    <TableHead>Team A</TableHead>
                    <TableHead>Team B</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Winner</TableHead>
                    {canAdmin && isDraft ? (
                      <TableHead className="text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.court_number}</TableCell>
                      <TableCell className="max-w-[220px] text-sm">
                        {formatTeam((g.team_a_players as string[]) ?? [])}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm">
                        {formatTeam((g.team_b_players as string[]) ?? [])}
                      </TableCell>
                      <TableCell>
                        {g.team_a_score} – {g.team_b_score}
                      </TableCell>
                      <TableCell className="capitalize">
                        {(g.winner as string)?.replace("_", " ")}
                      </TableCell>
                      {canAdmin && isDraft ? (
                        <TableCell className="text-right">
                          <DeleteGameButton
                            leagueId={leagueId}
                            sessionId={sessionId}
                            gameId={g.id as string}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
