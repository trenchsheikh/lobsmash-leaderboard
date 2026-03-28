import Link from "next/link";
import { Hash, Inbox, PlusCircle } from "lucide-react";
import { requireOnboarded } from "@/lib/auth/profile";
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
import { Badge } from "@/components/ui/badge";
import { CreateLeagueForm } from "@/components/create-league-form";
import { JoinLeagueForm } from "@/components/join-league-form";

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

  const rows =
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
        return { ...league, role: row.role as string };
      })
      .filter(Boolean) ?? [];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Dashboard"
        description="My leagues, join codes, and new seasons."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlusCircle className="size-5 text-primary" aria-hidden />
              Create league
            </CardTitle>
            <CardDescription>Name, format, and an auto-generated join code.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateLeagueForm />
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Hash className="size-5 text-primary" aria-hidden />
              Join league
            </CardTitle>
            <CardDescription>Enter the code from your organiser.</CardDescription>
          </CardHeader>
          <CardContent>
            <JoinLeagueForm />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>My leagues</CardTitle>
            <CardDescription>Everything you are part of right now.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 py-12 text-center">
              <Inbox className="size-10 text-muted-foreground/70" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">
                No leagues yet. Create one or join with a code above.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
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
                  {rows.map((league) => (
                    <TableRow key={league!.id}>
                      <TableCell className="font-medium">{league!.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{league!.format}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{league!.code}</TableCell>
                      <TableCell className="capitalize">{league!.role}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/leagues/${league!.id}`}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          View
                        </Link>
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
