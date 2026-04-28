"use client";

import { useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Home,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MainHeaderUser = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", Icon: Home },
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/profile", label: "Profile", Icon: UserRound },
  { href: "/verification", label: "Verification", Icon: ShieldCheck },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function MainHeader({ user }: { user: MainHeaderUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const displayName = user.name?.trim() || user.username?.trim() || "Account";

  return (
    <>
    <header className="z-30 border-0 bg-transparent px-0 pt-[env(safe-area-inset-top,0px)] sm:px-4 sm:pt-4">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-2 rounded-t-none rounded-b-xl border-b border-border bg-card/95 px-3 shadow-md backdrop-blur-xl ring-1 ring-black/[0.04] sm:h-14 sm:gap-4 sm:rounded-2xl sm:border sm:px-4 dark:border-white/12 dark:bg-white/10 dark:ring-white/10">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-10">
          <Link
            href="/dashboard"
            transitionTypes={["nav"]}
            className={cn(
              "inline-flex min-w-0 shrink-0 items-center rounded-md",
              "transition-[opacity,transform] duration-200 ease-out hover:opacity-90",
              "motion-safe:active:scale-[0.98] motion-reduce:active:scale-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <Image
              src="/lobsmash-logo-removebg-preview.png"
              alt="LobSmash"
              width={160}
              height={160}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex md:gap-2"
            aria-label="Main"
          >
            {navItems.map(({ href, label }) => {
              const active = isNavActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  transitionTypes={["nav"]}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-sm font-medium md:px-3",
                    "transition-[color,background-color,transform] duration-200 ease-out",
                    "motion-safe:active:scale-[0.98] motion-reduce:active:scale-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary/12 text-brand-navy dark:text-sky-300"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex max-w-[min(100%,220px)] items-center gap-2 rounded-full py-1 pr-1.5 pl-1 outline-none",
                "ring-offset-background hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              aria-label="Account menu"
            >
              <UserAvatarDisplay
                name={user.name}
                username={user.username}
                avatarUrl={user.avatarUrl}
                size="sm"
                className="ring-2 ring-background"
              />
              <span className="hidden min-w-0 truncate text-left text-sm font-medium lg:inline">
                {displayName}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{displayName}</span>
                    {user.username ? (
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        @{user.username}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/become-a-coach")}>
                  Become a coach
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/verification")}>
                  Verification
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  Dashboard
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOut({ redirectUrl: "/login" })}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
      aria-label="Bottom navigation"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-4 gap-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              transitionTypes={["nav"]}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary/12 text-brand-navy dark:text-sky-300"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
