import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/profile";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { buttonVariants } from "@/lib/button-variants";
import {
  getDemoInboxRows,
  isDemoVerificationId,
  seedDemoInboxProfileMaps,
  verificationMocksEnabled,
} from "@/lib/verification-mocks";
import { cn } from "@/lib/utils";

function isDemoLocalEntityId(id: string): boolean {
  return id.startsWith("demo-");
}

export default async function VerificationInboxPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: coach } = await supabase
    .from("coach_profiles")
    .select("approved_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!coach?.approved_at) {
    redirect("/verification");
  }

  const { data: rows } = await supabase
    .from("player_verification_requests")
    .select("id, player_id, status, created_at")
    .eq("coach_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const useMocks = verificationMocksEnabled();
  const demoRows = useMocks ? getDemoInboxRows() : [];
  const displayRows = [...demoRows, ...(rows ?? [])];

  const playerIds = [...new Set(displayRows.map((r) => r.player_id as string))];
  const playersById = new Map<
    string,
    { name: string; user_id: string | null }
  >();

  const realPlayerIds = playerIds.filter((id) => !isDemoLocalEntityId(id));
  if (realPlayerIds.length > 0) {
    const { data: plist } = await supabase
      .from("players")
      .select("id, name, user_id")
      .in("id", realPlayerIds);
    for (const p of plist ?? []) {
      playersById.set(p.id, { name: p.name, user_id: p.user_id });
    }
  }

  const usersById = new Map<string, { username: string | null; avatar_url: string | null }>();

  const userIds = [
    ...new Set(
      [...playersById.values()]
        .map((p) => p.user_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ].filter((id) => !isDemoLocalEntityId(id));

  if (userIds.length > 0) {
    const { data: ulist } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", userIds);
    for (const u of ulist ?? []) {
      usersById.set(u.id, { username: u.username, avatar_url: u.avatar_url });
    }
  }

  if (useMocks) seedDemoInboxProfileMaps(playersById, usersById);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Coach inbox
        </h1>
        <Link
          href="/verification"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          Verification home
        </Link>
      </div>
      {useMocks && demoRows.length > 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Sample pending requests (London players) are shown at the top for layout preview — they are
          not clickable.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Pending verification requests from players. Open a request for the session portal — use Coach
        view to enter ratings after you play together.
      </p>
      <ul className="flex flex-col gap-3">
        {displayRows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            No pending requests.
          </li>
        ) : (
          displayRows.map((r) => {
            const p = playersById.get(r.player_id as string);
            const u = p?.user_id ? usersById.get(p.user_id) : undefined;
            const name = p?.name ?? "Player";
            const username = u?.username?.trim() ?? null;
            const isDemo = isDemoVerificationId(r.id as string);

            const inner = (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatarDisplay
                    name={name}
                    username={username}
                    avatarUrl={u?.avatar_url ?? null}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{name}</p>
                    {username ? (
                      <p className="truncate font-mono text-sm text-muted-foreground">@{username}</p>
                    ) : null}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                    isDemo
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {isDemo ? "Preview" : "Open"}
                </span>
              </>
            );

            return (
              <li key={r.id}>
                {isDemo ? (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 ring-1 ring-foreground/5",
                    )}
                  >
                    {inner}
                  </div>
                ) : (
                  <Link
                    href={`/verification/session/${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-foreground/5 transition-colors hover:border-primary/35 hover:ring-primary/15"
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
