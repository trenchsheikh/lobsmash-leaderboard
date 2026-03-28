"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Loader2,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  addMemberByUserId,
  addMemberByUsername,
  getFriendsForLeagueInvite,
  getSuggestedLeagueMates,
  searchUsersForLeague,
  type LeagueMemberPick,
} from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { cn } from "@/lib/utils";

function UserRow({
  u,
  onAdd,
  pending,
  staggerMs = 0,
}: {
  u: LeagueMemberPick;
  onAdd: () => void;
  pending: boolean;
  staggerMs?: number;
}) {
  const handle = u.username ? `@${u.username}` : "—";
  const display = u.name?.trim() || handle;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onAdd}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both",
        pending && "pointer-events-none opacity-70",
      )}
      style={staggerMs ? { animationDelay: `${staggerMs}ms` } : undefined}
    >
      <UserAvatarDisplay
        name={u.name}
        username={u.username}
        avatarUrl={u.avatar_url ?? null}
        size="sm"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{display}</p>
        {u.name?.trim() ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{handle}</p>
        ) : null}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <UserPlus className="size-4" aria-hidden />
        )}
        Add
      </span>
    </button>
  );
}

export function AddMemberForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "player">("player");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<LeagueMemberPick[]>([]);
  const [suggestions, setSuggestions] = useState<LeagueMemberPick[]>([]);
  const [friends, setFriends] = useState<LeagueMemberPick[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [suggestLoading, setSuggestLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setFriendsLoading(true);
    getFriendsForLeagueInvite(leagueId).then((res) => {
      if (cancelled) return;
      if ("error" in res && res.error) {
        toast.error(res.error);
        setFriends([]);
      } else {
        setFriends(res.users);
      }
      setFriendsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  useEffect(() => {
    let cancelled = false;
    setSuggestLoading(true);
    getSuggestedLeagueMates(leagueId).then((res) => {
      if (cancelled) return;
      if ("error" in res && res.error) {
        toast.error(res.error);
        setSuggestions([]);
      } else {
        setSuggestions(res.users);
      }
      setSuggestLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    startSearch(async () => {
      const res = await searchUsersForLeague(leagueId, debouncedSearch);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setSearchResults([]);
        return;
      }
      setSearchResults(res.users);
    });
  }, [leagueId, debouncedSearch]);

  const refresh = useCallback(() => {
    router.refresh();
    setSearch("");
    setDebouncedSearch("");
    setSearchResults([]);
    getSuggestedLeagueMates(leagueId).then((res) => {
      if ("error" in res && res.error) return;
      setSuggestions(res.users);
    });
    getFriendsForLeagueInvite(leagueId).then((res) => {
      if ("error" in res && res.error) return;
      setFriends(res.users);
    });
  }, [leagueId, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("role", role);
    const res = await addMemberByUsername(leagueId, formData);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Member added");
    e.currentTarget.reset();
    setRole("player");
    refresh();
  }

  async function quickAdd(target: LeagueMemberPick) {
    setAddingId(target.id);
    const res = await addMemberByUserId(leagueId, target.id, role);
    setAddingId(null);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added @${target.username}`);
    refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="member-username">Username</Label>
          <Input
            id="member-username"
            name="username"
            required
            placeholder="padel_ninja"
            className="font-mono text-sm lowercase"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, underscores—their unique handle from their profile.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-role">Role</Label>
          <select
            id="member-role"
            name="role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value === "admin" ? "admin" : "player")
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="player">Player</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" className="gap-2 transition-transform active:scale-[0.98]">
          <UserPlus className="size-4" aria-hidden />
          Add member
        </Button>
      </form>

      <div className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Heart className="size-4 text-muted-foreground" aria-hidden />
          Your friends
        </div>
        <p className="text-xs text-muted-foreground">
          Tap a row to add them. Uses the role you selected above (Player or Admin).
        </p>
        {friendsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading friends…
          </div>
        ) : friends.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No friends to add here yet—connect on the Friends page, or search below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((u, i) => (
              <li key={u.id}>
                <UserRow
                  u={u}
                  pending={addingId === u.id}
                  staggerMs={Math.min(i, 8) * 35}
                  onAdd={() => quickAdd(u)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          Search players
        </div>
        <p className="text-xs text-muted-foreground">
          Find people you’ve played with in other leagues (visible to you). Type at least 2 characters.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by @username…"
            className="pl-9 font-mono text-sm"
            autoComplete="off"
            aria-label="Search players by username"
          />
        </div>
        {searchPending && debouncedSearch.length >= 2 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Searching…
          </div>
        ) : null}
        {debouncedSearch.length >= 2 && !searchPending && searchResults.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matches. Try another handle.</p>
        ) : null}
        {searchResults.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {searchResults.map((u, i) => (
              <li key={u.id}>
                <UserRow
                  u={u}
                  pending={addingId === u.id}
                  staggerMs={Math.min(i, 8) * 40}
                  onAdd={() => quickAdd(u)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-border/60 pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          Friends from your other leagues
          <Sparkles className="size-3.5 text-amber-600/80 dark:text-amber-400/90" aria-hidden />
        </div>
        <p className="text-xs text-muted-foreground">
          People you already share a league with elsewhere—add them here in one tap.
        </p>
        {suggestLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading suggestions…
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No suggestions yet. Join another league with friends to see them here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {suggestions.map((u, i) => (
              <li key={u.id}>
                <UserRow
                  u={u}
                  pending={addingId === u.id}
                  staggerMs={Math.min(i, 8) * 45}
                  onAdd={() => quickAdd(u)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
