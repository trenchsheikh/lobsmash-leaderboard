import { UserPlus, Users } from "lucide-react";
import { requireOnboarded } from "@/lib/auth/profile";
import { loadFriendsPageData } from "@/lib/friends-data";
import { buttonVariants } from "@/lib/button-variants";
import { PageHeader } from "@/components/page-header";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
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
import {
  FriendCard,
  FriendSearch,
} from "@/components/friends-interactive";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDisplayLevel } from "@/lib/rating";

export default async function FriendsPage() {
  const { user } = await requireOnboarded();
  const { friendships, leaderboard } = await loadFriendsPageData();

  const incoming = friendships.filter(
    (f) => f.status === "pending" && f.requested_by !== user.id,
  );
  const outgoing = friendships.filter(
    (f) => f.status === "pending" && f.requested_by === user.id,
  );
  const accepted = friendships.filter((f) => f.status === "accepted");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Friends"
        description="Send requests, accept invites, and compare stats with people you play with."
        actions={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Dashboard
          </Link>
        }
      />

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-xl">
            <UserPlus className="size-5 text-primary" aria-hidden />
            Add a friend
          </CardTitle>
          <CardDescription>
            Search by username. They’ll need to accept your request before you appear in each
            other’s friend list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FriendSearch />
        </CardContent>
      </Card>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {incoming.length > 0 ? (
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Incoming requests</CardTitle>
                <CardDescription>Accept or decline these invitations.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {incoming.map((f) => (
                  <FriendCard key={f.id} item={f} currentUserId={user.id} />
                ))}
              </CardContent>
            </Card>
          ) : null}
          {outgoing.length > 0 ? (
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Outgoing requests</CardTitle>
                <CardDescription>Waiting for them to respond.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {outgoing.map((f) => (
                  <FriendCard key={f.id} item={f} currentUserId={user.id} />
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Your friends</CardTitle>
          <CardDescription>
            {accepted.length === 0
              ? "No friends yet—send a request above."
              : `${accepted.length} friend${accepted.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {accepted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 py-8 text-center">
              <Users className="size-8 text-muted-foreground/70" aria-hidden />
              <p className="text-sm text-muted-foreground">No friends yet—search above to connect.</p>
            </div>
          ) : (
            accepted.map((f) => (
              <FriendCard key={f.id} item={f} currentUserId={user.id} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Friends leaderboard</CardTitle>
          <CardDescription>
            Sorted by global skill level, then wins and points across all leagues. Includes you and
            accepted friends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Play in leagues with sessions to see stats here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Skill</TableHead>
                    <TableHead className="text-right">Games</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Court 1</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((row, i) => (
                    <TableRow key={row.player_id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-3">
                          <UserAvatarDisplay
                            name={row.name}
                            username={row.username}
                            avatarUrl={row.avatar_url}
                            size="sm"
                          />
                          <span className="font-medium">{row.name}</span>
                          {row.user_id === user.id ? (
                            <Badge variant="secondary">You</Badge>
                          ) : null}
                          {row.username ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              @{row.username}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        Lv {formatDisplayLevel(row.skill)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_games}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_wins}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.court1_wins}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_points}
                      </TableCell>
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
